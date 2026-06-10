#!/usr/bin/env python3
"""
dump-sequ.py — Apple Loop AIFF Sequ chunk reverse-engineering tool.

For each chord event in the Sequ chunk, dumps the full 32-byte record as hex
and correlates it with the MIDI note group that starts at the same approximate
tick position.

Usage:
    python3 scripts/dump-sequ.py <file.aif> [<file2.aif> ...]

Output columns (per chord event):
    [event #]  rawBe22(hex)  hi16  lo16  b8  b9  mask  |  midi_beat  sequ_beat  notes
"""

import struct
import sys
from pathlib import Path


# ─── AIFF chunk reader ────────────────────────────────────────────────────────

def read_aiff_chunks(data: bytes) -> dict[bytes, bytes]:
    """Return {chunk_id: chunk_data} for all top-level AIFF chunks."""
    if data[:4] != b"FORM":
        raise ValueError("Not an AIFF file")
    pos = 12  # skip FORM + size + AIFF
    chunks: dict[bytes, bytes] = {}
    while pos + 8 <= len(data):
        ck_id = data[pos:pos+4]
        ck_size = struct.unpack(">I", data[pos+4:pos+8])[0]
        chunks[ck_id] = data[pos+8:pos+8+ck_size]
        pos += 8 + ck_size
        if pos % 2 == 1:
            pos += 1
    return chunks


# ─── MIDI parser (minimal) ────────────────────────────────────────────────────

def read_vlq(data: bytes, pos: int) -> tuple[int, int]:
    """Read variable-length quantity. Returns (value, new_pos)."""
    value = 0
    while True:
        b = data[pos]
        pos += 1
        value = (value << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return value, pos


def parse_midi_track(data: bytes) -> list[tuple[int, str, int, int]]:
    """
    Returns list of (absolute_tick, event_type, note, velocity).
    event_type is 'noteOn' or 'noteOff'.
    Normalises so first noteOn is at tick 0.
    """
    pos = 0
    tick = 0
    events: list[tuple[int, str, int, int]] = []
    running_status = 0
    pending_delta = 0

    while pos < len(data):
        delta, pos = read_vlq(data, pos)
        pending_delta += delta

        if pos >= len(data):
            break

        b = data[pos]

        # Meta event
        if b == 0xFF:
            pos += 1
            meta_type = data[pos]; pos += 1
            meta_len, pos = read_vlq(data, pos)
            pos += meta_len
            # Don't reset pending_delta — carry it across meta events
            continue

        # SysEx
        if b == 0xF0 or b == 0xF7:
            pos += 1
            sysex_len, pos = read_vlq(data, pos)
            pos += sysex_len
            continue

        # Status byte?
        if b & 0x80:
            running_status = b
            pos += 1

        status = running_status & 0xF0
        if status == 0x90:  # Note On
            note = data[pos]; pos += 1
            vel = data[pos]; pos += 1
            tick += pending_delta
            pending_delta = 0
            events.append((tick, 'noteOn' if vel > 0 else 'noteOff', note, vel))
        elif status == 0x80:  # Note Off
            note = data[pos]; pos += 1
            vel = data[pos]; pos += 1
            tick += pending_delta
            pending_delta = 0
            events.append((tick, 'noteOff', note, vel))
        else:
            # Other channel messages (skip 1 or 2 data bytes)
            if status in (0xA0, 0xB0, 0xE0):
                pos += 2
            elif status in (0xC0, 0xD0):
                pos += 1
            tick += pending_delta
            pending_delta = 0

    # Normalise: shift all ticks so first noteOn is at 0
    note_ons = [t for t, typ, _, v in events if typ == 'noteOn' and v > 0]
    if note_ons:
        offset = min(note_ons)
        events = [(t - offset, typ, n, v) for t, typ, n, v in events]

    return events


def parse_midi(midi_bytes: bytes) -> tuple[int, list[tuple[int, str, int, int]]]:
    """
    Parse a MIDI file. Returns (ticks_per_beat, events).
    Handles multi-track: merges all tracks.
    """
    if midi_bytes[:4] != b"MThd":
        raise ValueError("Not a MIDI file")
    tpb = struct.unpack(">H", midi_bytes[12:14])[0]
    pos = 14
    all_events: list[tuple[int, str, int, int]] = []
    while pos + 8 <= len(midi_bytes):
        ck_id = midi_bytes[pos:pos+4]
        ck_size = struct.unpack(">I", midi_bytes[pos+4:pos+8])[0]
        ck_data = midi_bytes[pos+8:pos+8+ck_size]
        pos += 8 + ck_size
        if ck_id == b"MTrk":
            all_events.extend(parse_midi_track(ck_data))

    all_events.sort(key=lambda e: e[0])
    return tpb, all_events


# ─── Sequ record parser ────────────────────────────────────────────────────────

RECORD_SIZE = 32

def iter_sequ_records(data: bytes):
    """
    Yield (offset, raw_bytes) for every 32-byte record whose first u16-LE == 103.
    Scans at 2-byte boundaries.
    """
    view = memoryview(data)
    for off in range(0, len(data) - RECORD_SIZE + 1, 2):
        type_val = struct.unpack_from("<H", data, off)[0]
        if type_val == 103:
            yield off, bytes(view[off:off+RECORD_SIZE])


def decode_record(raw: bytes) -> dict:
    """Decode all known fields of a 32-byte Sequ record."""
    type_val = struct.unpack_from("<H", raw, 0x00)[0]
    mask     = struct.unpack_from("<H", raw, 0x04)[0]
    b8       = raw[0x08]
    b9       = raw[0x09]
    be22     = struct.unpack_from(">I", raw, 0x18)[0]  # big-endian u32

    hi16 = (be22 >> 16) & 0xFFFF
    lo16 =  be22 & 0xFFFF

    # All other bytes for inspection
    other = {}
    for i in range(RECORD_SIZE):
        if i not in (0, 1, 4, 5, 8, 9, 0x18, 0x19, 0x1a, 0x1b):
            other[f"b{i:02x}"] = raw[i]

    return {
        "type": type_val,
        "mask": mask,
        "b8": b8,
        "b9": b9,
        "be22": be22,
        "hi16": hi16,
        "lo16": lo16,
        "raw_hex": raw.hex(" "),
        "other": other,
    }


# ─── Note grouping ────────────────────────────────────────────────────────────

def group_note_ons(events: list[tuple[int, str, int, int]], tol_ticks: int = 30) -> list[tuple[int, list[int]]]:
    """
    Group simultaneous (within tol_ticks) noteOn events into chord groups.
    Returns [(onset_tick, [pitches...])] sorted by onset.
    """
    groups: list[tuple[int, list[int]]] = []
    note_ons = [(t, n) for t, typ, n, v in events if typ == "noteOn" and v > 0]
    note_ons.sort()
    i = 0
    while i < len(note_ons):
        t0, n0 = note_ons[i]
        group = [n0]
        j = i + 1
        while j < len(note_ons) and note_ons[j][0] - t0 <= tol_ticks:
            group.append(note_ons[j][1])
            j += 1
        groups.append((t0, group))
        i = j
    return groups


NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]

def pitch_name(p: int) -> str:
    return f"{NOTE_NAMES[p % 12]}{p // 12 - 1}"


# ─── Main ────────────────────────────────────────────────────────────────────

def analyse_file(path: str):
    print(f"\n{'='*80}")
    print(f"FILE: {path}")
    print(f"{'='*80}")

    data = Path(path).read_bytes()
    chunks = read_aiff_chunks(data)

    if b"Sequ" not in chunks:
        print("  !! No Sequ chunk found")
        return

    # Parse MIDI
    tpb = 480
    note_groups: list[tuple[int, list[int]]] = []
    if b".mid" in chunks:
        try:
            tpb, midi_events = parse_midi(chunks[b".mid"])
            note_groups = group_note_ons(midi_events, tol_ticks=tpb // 16)
            print(f"MIDI: {tpb} ticks/beat, {len(note_groups)} note groups")
        except Exception as e:
            print(f"MIDI parse error: {e}")
    else:
        print("  (no .mid chunk)")

    # Parse basc chunk for loop metadata
    if b"basc" in chunks:
        basc = chunks[b"basc"]
        # Known fields (empirical)
        if len(basc) >= 8:
            num_beats = struct.unpack_from(">f", basc, 0)[0]  # float32 at 0?
            key_sig   = basc[48] if len(basc) > 48 else 0
            print(f"basc: length={len(basc)}, key_sig_byte={key_sig}")
            # Try to get beats/tempo
            for off in range(0, min(len(basc), 40), 4):
                val_f = struct.unpack_from(">f", basc, off)[0]
                val_i = struct.unpack_from(">I", basc, off)[0]
                if 60 <= val_f <= 200:
                    print(f"  basc[{off}] as float32 BE = {val_f:.3f} (looks like BPM/beat count?)")
                if 1 <= val_i <= 16:
                    print(f"  basc[{off}] as uint32 BE = {val_i} (looks like bar count?)")

    # Parse Sequ chunk
    sequ = chunks[b"Sequ"]
    print(f"\nSequ chunk: {len(sequ)} bytes")

    records = list(iter_sequ_records(sequ))
    print(f"  {len(records)} type-103 records found\n")

    # Column header
    print(f"{'#':>3}  {'offset':>6}  {'be22 (hex)':>10}  {'hi16':>5}  {'lo16':>5}  "
          f"{'b8':>3}  {'b9':>3}  {'mask':>6}  "
          f"{'MIDI beat':>10}  {'MIDI tick':>10}  {'notes'}")
    print("-" * 110)

    for idx, (off, raw) in enumerate(records):
        rec = decode_record(raw)
        hi16 = rec["hi16"]
        lo16 = rec["lo16"]
        be22 = rec["be22"]

        # Match to MIDI group by proximity: assign sequentially if possible
        if idx < len(note_groups):
            midi_tick, pitches = note_groups[idx]
            midi_beat = midi_tick / tpb
            midi_notes = " ".join(pitch_name(p) for p in sorted(pitches))
        else:
            midi_tick = -1
            midi_beat = -1.0
            midi_notes = "(no group)"

        print(f"{idx:>3}  {off:>6}  0x{be22:08x}  "
              f"0x{hi16:04x}  0x{lo16:04x}  "
              f"{rec['b8']:>3}  {rec['b9']:>3}  "
              f"0x{rec['mask']:04x}  "
              f"{midi_beat:>10.4f}  {midi_tick:>10}  {midi_notes}")

    # Now print the raw hex of each record for deep inspection
    print("\n--- Raw record bytes (hex) ---")
    for idx, (off, raw) in enumerate(records):
        print(f"[{idx:>2}] offset={off:5d}: {raw.hex(' ')}")

    # Print all unique byte values at each offset position (for pattern detection)
    if len(records) > 1:
        print("\n--- Per-byte-offset variation across records ---")
        print(f"{'offset':>6}  {'hex':>4}  {'values (hex)'}")
        for byte_off in range(RECORD_SIZE):
            vals = [raw[byte_off] for _, raw in records]
            unique = sorted(set(vals))
            # Flag bytes that vary (interesting) or are always 0 (boring)
            flag = "  <-- varies" if len(unique) > 1 else ("  (constant)" if unique[0] == 0 else "  [const non-0]")
            print(f"  [{byte_off:02x}]  {byte_off:>3}  {' '.join(f'{v:02x}' for v in vals)}{flag}")

    # Print MIDI note groups for reference
    if note_groups:
        print("\n--- MIDI note groups (beat, tick, pitches) ---")
        for tick, pitches in note_groups:
            beat = tick / tpb
            print(f"  beat {beat:6.3f}  tick {tick:6}  {' '.join(pitch_name(p) for p in sorted(pitches))}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 dump-sequ.py <file.aif> [<file2.aif> ...]")
        sys.exit(1)

    for path in sys.argv[1:]:
        try:
            analyse_file(path)
        except Exception as e:
            print(f"ERROR processing {path}: {e}")
            import traceback; traceback.print_exc()
