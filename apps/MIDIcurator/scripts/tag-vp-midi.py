#!/usr/bin/env python3
"""
Tag VP-GRIT/VP-VIBE MIDI files with:
  - vpSource, vpPattern, vpIntensity fields in the MCURATOR file-level event
  - A MCURATOR leadsheet event (C6add9, bars=N)

Usage:
    python3 scripts/tag-vp-midi.py [--dry-run] [MIDI_DIR]

MIDI_DIR defaults to "VP Vibe and GRIT MIDI" relative to the project root.
"""

import struct
import re
import json
import math
import argparse
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# MIDI low-level utilities
# ---------------------------------------------------------------------------

def read_varlen(data: bytes, pos: int) -> tuple[int, int]:
    value = 0
    while True:
        b = data[pos]; pos += 1
        value = (value << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return value, pos


def write_varlen(value: int) -> bytes:
    if value == 0:
        return bytes([0])
    result = []
    result.append(value & 0x7F)
    value >>= 7
    while value:
        result.append((value & 0x7F) | 0x80)
        value >>= 7
    return bytes(reversed(result))


def parse_events(data: bytes, pos: int, end: int) -> list:
    """
    Parse a MIDI track into a list of event tuples.
    Each event is one of:
      ('meta', abs_tick, meta_type:int, payload:bytes)
      ('sysex', abs_tick, status:int, payload:bytes)
      ('midi', abs_tick, status:int, data:bytes)   # data = channel data bytes only
    """
    events = []
    time = 0
    last_status = 0

    while pos < end:
        delta, pos = read_varlen(data, pos)
        time += delta

        b = data[pos]

        if b == 0xFF:
            # Meta event — always starts with 0xFF (no running status possible)
            pos += 1
            mtype = data[pos]; pos += 1
            mlen, pos = read_varlen(data, pos)
            mdata = data[pos:pos + mlen]; pos += mlen
            events.append(('meta', time, mtype, mdata))
            last_status = 0  # Meta resets running status
        elif b == 0xF0 or b == 0xF7:
            pos += 1
            mlen, pos = read_varlen(data, pos)
            sdata = data[pos:pos + mlen]; pos += mlen
            events.append(('sysex', time, b, sdata))
            last_status = 0
        elif b & 0x80:
            # New status byte
            last_status = b
            pos += 1
            cmd = (b >> 4)
            if cmd in (0x8, 0x9, 0xA, 0xB, 0xE):
                d1, d2 = data[pos], data[pos + 1]; pos += 2
                events.append(('midi', time, b, bytes([d1, d2])))
            elif cmd in (0xC, 0xD):
                d1 = data[pos]; pos += 1
                events.append(('midi', time, b, bytes([d1])))
        else:
            # Running status
            cmd = (last_status >> 4)
            if cmd in (0x8, 0x9, 0xA, 0xB, 0xE):
                d1, d2 = data[pos], data[pos + 1]; pos += 2
                events.append(('midi', time, last_status, bytes([d1, d2])))
            elif cmd in (0xC, 0xD):
                d1 = data[pos]; pos += 1
                events.append(('midi', time, last_status, bytes([d1])))

    return events


def encode_events(events: list) -> bytes:
    """Encode a list of event tuples to delta-time MIDI bytes (no EOT added)."""
    result = bytearray()
    prev_tick = 0
    for ev in sorted(events, key=lambda e: e[1]):
        kind, tick = ev[0], ev[1]
        delta = tick - prev_tick
        prev_tick = tick
        result.extend(write_varlen(delta))

        if kind == 'meta':
            _, _, mtype, mdata = ev
            result.append(0xFF)
            result.append(mtype)
            result.extend(write_varlen(len(mdata)))
            result.extend(mdata)
        elif kind == 'sysex':
            _, _, status, sdata = ev
            result.append(status)
            result.extend(write_varlen(len(sdata)))
            result.extend(sdata)
        elif kind == 'midi':
            _, _, status, mdata = ev
            result.append(status)
            result.extend(mdata)

    return bytes(result)


def compute_num_bars(events: list, ppq: int) -> int:
    """Compute bar count from the latest note-off (or note-on velocity=0)."""
    last_off = 0
    for ev in events:
        if ev[0] != 'midi':
            continue
        _, tick, status, mdata = ev
        cmd = (status >> 4)
        if cmd == 0x8 or (cmd == 0x9 and len(mdata) >= 2 and mdata[1] == 0):
            last_off = max(last_off, tick)
    ticks_per_bar = ppq * 4  # 4/4
    return max(1, math.ceil(last_off / ticks_per_bar))


# ---------------------------------------------------------------------------
# Filename parsing
# ---------------------------------------------------------------------------

INTENSITY_RE = r'(1|3|5|6|8|10|10a)'

GRIT_RE = re.compile(
    r'^VP-GRIT - (\d+) bpm - (.+?) - ' + INTENSITY_RE + r' - \d+$'
)
VIBE_RE = re.compile(
    r'^VP-VIBE - (Advanced|Basic)[：:] (\d+) bpm - (.+?) - ' + INTENSITY_RE + r' - \d+$'
)


def parse_filename(stem: str) -> tuple[str | None, int | None, str | None, str | None]:
    """Returns (vp_source, bpm, pattern_name, intensity) or (None,None,None,None)."""
    m = GRIT_RE.match(stem)
    if m:
        return 'VP-GRIT', int(m.group(1)), m.group(2), m.group(3)

    m = VIBE_RE.match(stem)
    if m:
        level = m.group(1)
        return f'VP-VIBE-{level}', int(m.group(2)), m.group(3), m.group(4)

    return None, None, None, None


# ---------------------------------------------------------------------------
# Core tagging logic
# ---------------------------------------------------------------------------

def tag_file(path: Path, dry_run: bool = False) -> tuple[bool, str]:
    """
    Read path, inject VP metadata + leadsheet, write back.
    Returns (success, message).
    """
    stem = path.stem
    vp_source, bpm, pattern_name, intensity = parse_filename(stem)
    if vp_source is None:
        return False, f'Could not parse filename: {path.name}'

    with open(path, 'rb') as f:
        data = f.read()

    if data[:4] != b'MThd':
        return False, f'Not a MIDI file: {path.name}'

    hlen = struct.unpack('>I', data[4:8])[0]
    _fmt, _ntracks, ppq = struct.unpack('>HHH', data[8:14])
    header = data[:8 + hlen]

    pos = 8 + hlen
    if data[pos:pos + 4] != b'MTrk':
        return False, f'Expected MTrk in {path.name}'
    tlen = struct.unpack('>I', data[pos + 4:pos + 8])[0]
    events = parse_events(data, pos + 8, pos + 8 + tlen)

    num_bars = compute_num_bars(events, ppq)

    # Rebuild event list, updating/adding MCURATOR events
    new_events: list = []
    has_leadsheet = False
    file_meta_updated = False

    for ev in events:
        if ev[0] == 'meta' and ev[2] == 0x01:  # Text event
            _, tick, _, mdata = ev
            try:
                text = mdata.decode('utf-8')
                if text.startswith('MCURATOR:v1 '):
                    obj = json.loads(text[12:])
                    if obj.get('type') == 'file':
                        obj['vpSource'] = vp_source
                        obj['vpPattern'] = pattern_name
                        obj['vpIntensity'] = intensity
                        new_text = 'MCURATOR:v1 ' + json.dumps(obj, separators=(',', ':'))
                        new_events.append(('meta', tick, 0x01, new_text.encode('utf-8')))
                        file_meta_updated = True
                        continue
                    elif obj.get('type') == 'leadsheet':
                        has_leadsheet = True
            except Exception:
                pass
        new_events.append(ev)

    if not has_leadsheet:
        ls_obj = {'type': 'leadsheet', 'text': 'C6add9', 'bars': num_bars}
        ls_text = 'MCURATOR:v1 ' + json.dumps(ls_obj, separators=(',', ':'))
        new_events.append(('meta', 0, 0x01, ls_text.encode('utf-8')))

    track_bytes = encode_events(new_events)
    new_data = header + b'MTrk' + struct.pack('>I', len(track_bytes)) + track_bytes

    status_parts = []
    status_parts.append(f'src={vp_source}')
    status_parts.append(f'pattern="{pattern_name}"')
    status_parts.append(f'intensity={intensity}')
    status_parts.append(f'bars={num_bars}')
    if not file_meta_updated:
        status_parts.append('WARNING:no-file-meta-found')
    if has_leadsheet:
        status_parts.append('leadsheet=existing')
    else:
        status_parts.append('leadsheet=added')

    if not dry_run:
        with open(path, 'wb') as f:
            f.write(new_data)

    return True, '  '.join(status_parts)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('midi_dir', nargs='?',
                        default=str(Path(__file__).parent.parent / 'VP Vibe and GRIT MIDI'),
                        help='Directory containing VP MIDI files')
    parser.add_argument('--dry-run', action='store_true',
                        help='Parse and report without writing any files')
    args = parser.parse_args()

    midi_dir = Path(args.midi_dir)
    if not midi_dir.is_dir():
        print(f'ERROR: directory not found: {midi_dir}', file=sys.stderr)
        sys.exit(1)

    midi_files = sorted(midi_dir.glob('*.mid'))
    print(f'Found {len(midi_files)} .mid files in {midi_dir}')
    if args.dry_run:
        print('(DRY RUN — no files will be modified)')
    print()

    ok_count = 0
    skip_count = 0
    for path in midi_files:
        ok, msg = tag_file(path, dry_run=args.dry_run)
        marker = 'OK  ' if ok else 'SKIP'
        print(f'[{marker}] {path.name[:55]:<55}  {msg}')
        if ok:
            ok_count += 1
        else:
            skip_count += 1

    print()
    verb = 'Would tag' if args.dry_run else 'Tagged'
    print(f'{verb} {ok_count} files. Skipped {skip_count}.')


if __name__ == '__main__':
    main()
