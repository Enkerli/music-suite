#!/usr/bin/env python3
"""
Analyze VP-GRIT/VP-VIBE intensity progression for each pattern.

For each (source, pattern) group the 7 intensity variants (1,3,5,6,8,10,10a)
and compute per-variant musical metrics. Then report:
  - How each metric changes across intensities
  - What distinguishes intensity 10 from 10a (the "Busyness" variant)
  - Which patterns are shared across GRIT / VIBE Basic / VIBE Advanced

Outputs:
  - vp-intensity-analysis.json  (full stats)
  - vp-intensity-report.md      (human-readable summary)

Usage:
    python3 scripts/analyze-vp-intensity.py [MIDI_DIR]
"""

import struct
import re
import json
import math
import statistics
import sys
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# MIDI parsing (same utilities as tag-vp-midi.py)
# ---------------------------------------------------------------------------

def read_varlen(data: bytes, pos: int) -> tuple[int, int]:
    value = 0
    while True:
        b = data[pos]; pos += 1
        value = (value << 7) | (b & 0x7F)
        if not (b & 0x80):
            break
    return value, pos


def parse_notes(path: Path) -> tuple[list, int, int]:
    """
    Returns (notes, ppq, num_bars) where notes is a list of
    (onset_tick, pitch, velocity, duration_ticks).
    num_bars derived from ceil(last_note_end / (ppq*4)).
    """
    with open(path, 'rb') as f:
        data = f.read()

    hlen = struct.unpack('>I', data[4:8])[0]
    _fmt, _ntracks, ppq = struct.unpack('>HHH', data[8:14])

    pos = 8 + hlen
    tlen = struct.unpack('>I', data[pos + 4:pos + 8])[0]
    end = pos + 8 + tlen
    tpos = pos + 8
    time = 0
    last_status = 0

    # Active notes: pitch -> (onset_tick, velocity)
    active: dict[int, tuple[int, int]] = {}
    notes = []

    while tpos < end:
        delta, tpos = read_varlen(data, tpos)
        time += delta
        b = data[tpos]

        if b == 0xFF:
            tpos += 1
            mtype = data[tpos]; tpos += 1
            mlen, tpos = read_varlen(data, tpos)
            tpos += mlen
            last_status = 0
        elif b == 0xF0 or b == 0xF7:
            tpos += 1
            mlen, tpos = read_varlen(data, tpos)
            tpos += mlen
            last_status = 0
        elif b & 0x80:
            last_status = b
            tpos += 1
            cmd = (b >> 4)
            if cmd in (0x8, 0x9, 0xA, 0xB, 0xE):
                d1, d2 = data[tpos], data[tpos + 1]; tpos += 2
                if cmd == 0x9 and d2 > 0:
                    active[d1] = (time, d2)
                elif cmd == 0x8 or (cmd == 0x9 and d2 == 0):
                    if d1 in active:
                        onset, vel = active.pop(d1)
                        notes.append((onset, d1, vel, time - onset))
            elif cmd in (0xC, 0xD):
                tpos += 1
        else:
            # Running status
            cmd = (last_status >> 4)
            if cmd in (0x8, 0x9, 0xA, 0xB, 0xE):
                d1, d2 = data[tpos], data[tpos + 1]; tpos += 2
                if cmd == 0x9 and d2 > 0:
                    active[d1] = (time, d2)
                elif cmd == 0x8 or (cmd == 0x9 and d2 == 0):
                    if d1 in active:
                        onset, vel = active.pop(d1)
                        notes.append((onset, d1, vel, time - onset))
            elif cmd in (0xC, 0xD):
                tpos += 1

    # Close any still-open notes (use last time as end)
    for pitch, (onset, vel) in active.items():
        notes.append((onset, pitch, vel, time - onset))

    notes.sort(key=lambda n: n[0])

    ticks_per_bar = ppq * 4
    last_end = max((n[0] + n[3] for n in notes), default=0)
    num_bars = max(1, math.ceil(last_end / ticks_per_bar))

    return notes, ppq, num_bars


# ---------------------------------------------------------------------------
# Metrics computation
# ---------------------------------------------------------------------------

INTENSITY_ORDER = ['1', '3', '5', '6', '8', '10', '10a']


def compute_metrics(notes: list, ppq: int, num_bars: int) -> dict:
    if not notes:
        return {}

    ticks_per_bar = ppq * 4
    onsets = [n[0] for n in notes]
    pitches = [n[1] for n in notes]
    velocities = [n[2] for n in notes]
    durations = [n[3] for n in notes]

    # Quantize onsets to 8th-note grid for rhythmic density
    eighth = ppq // 2
    quantized_onsets = sorted(set(round(o / eighth) for o in onsets))
    onset_count = len(quantized_onsets)

    # Inter-onset intervals (raw, not quantized)
    sorted_onsets = sorted(set(onsets))
    iois = [sorted_onsets[i + 1] - sorted_onsets[i] for i in range(len(sorted_onsets) - 1)]
    ioi_cv = (statistics.stdev(iois) / statistics.mean(iois)) if len(iois) > 1 else 0.0

    # Polyphony: at each onset, how many notes are sounding?
    # Build a list of (onset, pitch) groups
    onset_to_notes: dict[int, list] = defaultdict(list)
    for n in notes:
        onset_to_notes[n[0]].append(n)
    poly_values = [len(v) for v in onset_to_notes.values()]

    return {
        'note_count': len(notes),
        'notes_per_bar': round(len(notes) / num_bars, 2),
        'bars': num_bars,
        'pitch_min': min(pitches),
        'pitch_max': max(pitches),
        'pitch_range': max(pitches) - min(pitches),
        'pitch_mean': round(statistics.mean(pitches), 1),
        'vel_min': min(velocities),
        'vel_max': max(velocities),
        'vel_mean': round(statistics.mean(velocities), 1),
        'vel_std': round(statistics.stdev(velocities) if len(velocities) > 1 else 0.0, 1),
        'duration_mean': round(statistics.mean(durations), 0),
        'onset_count': onset_count,
        'onset_density': round(onset_count / num_bars, 2),  # unique 8th-grid slots per bar
        'ioi_cv': round(ioi_cv, 3),  # rhythmic irregularity (0=metronomic, high=varied)
        'poly_mean': round(statistics.mean(poly_values), 2),
        'poly_max': max(poly_values),
    }


def delta_metrics(m_lo: dict, m_hi: dict) -> dict:
    """Compute absolute and relative changes between two intensity levels."""
    keys = ['note_count', 'notes_per_bar', 'pitch_range', 'pitch_mean',
            'vel_mean', 'onset_count', 'onset_density', 'ioi_cv', 'poly_mean']
    result = {}
    for k in keys:
        a, b = m_lo.get(k, 0), m_hi.get(k, 0)
        result[k + '_delta'] = round(b - a, 2)
        result[k + '_pct'] = round((b - a) / a * 100, 1) if a else None
    return result


# ---------------------------------------------------------------------------
# Filename parsing (duplicate from tagger for standalone use)
# ---------------------------------------------------------------------------

INTENSITY_RE = r'(1|3|5|6|8|10|10a)'
GRIT_RE = re.compile(r'^VP-GRIT - (\d+) bpm - (.+?) - ' + INTENSITY_RE + r' - \d+$')
VIBE_RE = re.compile(r'^VP-VIBE - (Advanced|Basic)[：:] (\d+) bpm - (.+?) - ' + INTENSITY_RE + r' - \d+$')


def parse_filename(stem: str):
    m = GRIT_RE.match(stem)
    if m:
        return 'VP-GRIT', int(m.group(1)), m.group(2), m.group(3)
    m = VIBE_RE.match(stem)
    if m:
        return f'VP-VIBE-{m.group(1)}', int(m.group(2)), m.group(3), m.group(4)
    return None, None, None, None


# ---------------------------------------------------------------------------
# Pattern group analysis
# ---------------------------------------------------------------------------

def analyze_group(group_key: str, variants: dict) -> dict:
    """
    variants: {intensity_str: {'path': Path, 'notes': list, 'ppq': int, 'bars': int}}
    Returns full analysis dict.
    """
    intensity_stats = {}
    for intens, info in variants.items():
        m = compute_metrics(info['notes'], info['ppq'], info['bars'])
        intensity_stats[intens] = m

    # Sequential deltas (1→3, 3→5, etc.)
    ordered = [i for i in INTENSITY_ORDER if i in intensity_stats]
    step_deltas = {}
    for i in range(len(ordered) - 1):
        lo, hi = ordered[i], ordered[i + 1]
        step_deltas[f'{lo}→{hi}'] = delta_metrics(intensity_stats[lo], intensity_stats[hi])

    # Special: 10 vs 10a (Busyness dimension)
    busyness_delta = None
    if '10' in intensity_stats and '10a' in intensity_stats:
        busyness_delta = delta_metrics(intensity_stats['10'], intensity_stats['10a'])

    # Overall 1→10 delta (ignoring 10a)
    overall_delta = None
    if '1' in intensity_stats and '10' in intensity_stats:
        overall_delta = delta_metrics(intensity_stats['1'], intensity_stats['10'])

    return {
        'group': group_key,
        'intensities': intensity_stats,
        'step_deltas': step_deltas,
        'busyness_delta': busyness_delta,
        'overall_delta': overall_delta,
    }


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']

def midi_note_name(n: int) -> str:
    return f'{NOTE_NAMES[n % 12]}{n // 12 - 1}'


def fmt(val, width=6, decimals=1):
    if val is None:
        return ' ' * width
    if isinstance(val, float):
        return f'{val:{width}.{decimals}f}'
    return f'{val:>{width}}'


def write_markdown(analyses: list[dict], output_path: Path, cross_title: dict):
    lines = []
    lines.append('# VP Virtual Pianist — Intensity Analysis Report\n')

    # Cross-title shared patterns
    lines.append('## Patterns shared across titles\n')
    if cross_title:
        for pattern, sources in sorted(cross_title.items()):
            lines.append(f'- **{pattern}**: {", ".join(sorted(sources))}')
    else:
        lines.append('_(none found)_')
    lines.append('')

    # Summary table: all patterns, note count at each intensity
    lines.append('## Note count by pattern and intensity\n')
    header = f'{"Pattern":<35} {"Source":<18} ' + ' '.join(f'{i:>5}' for i in INTENSITY_ORDER)
    lines.append(header)
    lines.append('-' * len(header))
    for a in analyses:
        parts = a['group'].split('|')
        src, pat = parts[0], parts[1]
        counts = a['intensities']
        row = f'{pat:<35} {src:<18} '
        row += ' '.join(f'{counts.get(i, {}).get("note_count", ""):>5}' for i in INTENSITY_ORDER)
        lines.append(row)
    lines.append('')

    # Onset density table
    lines.append('## Onset density (unique 8th-grid slots per bar)\n')
    header2 = f'{"Pattern":<35} {"Source":<18} ' + ' '.join(f'{i:>5}' for i in INTENSITY_ORDER)
    lines.append(header2)
    lines.append('-' * len(header2))
    for a in analyses:
        parts = a['group'].split('|')
        src, pat = parts[0], parts[1]
        counts = a['intensities']
        row = f'{pat:<35} {src:<18} '
        row += ' '.join(
            f'{counts.get(i, {}).get("onset_density", ""):>5.1f}' if counts.get(i) else '     '
            for i in INTENSITY_ORDER
        )
        lines.append(row)
    lines.append('')

    # Pitch range table
    lines.append('## Pitch range (semitones) by pattern and intensity\n')
    lines.append(f'{"Pattern":<35} {"Source":<18} ' + ' '.join(f'{i:>5}' for i in INTENSITY_ORDER))
    lines.append('-' * len(header2))
    for a in analyses:
        parts = a['group'].split('|')
        src, pat = parts[0], parts[1]
        counts = a['intensities']
        row = f'{pat:<35} {src:<18} '
        row += ' '.join(
            f'{counts.get(i, {}).get("pitch_range", ""):>5}' if counts.get(i) else '     '
            for i in INTENSITY_ORDER
        )
        lines.append(row)
    lines.append('')

    # Mean velocity table
    lines.append('## Mean velocity by pattern and intensity\n')
    lines.append(f'{"Pattern":<35} {"Source":<18} ' + ' '.join(f'{i:>5}' for i in INTENSITY_ORDER))
    lines.append('-' * len(header2))
    for a in analyses:
        parts = a['group'].split('|')
        src, pat = parts[0], parts[1]
        counts = a['intensities']
        row = f'{pat:<35} {src:<18} '
        row += ' '.join(
            f'{counts.get(i, {}).get("vel_mean", ""):>5.1f}' if counts.get(i) else '     '
            for i in INTENSITY_ORDER
        )
        lines.append(row)
    lines.append('')

    # Busyness (10 vs 10a) summary
    lines.append('## Busyness: intensity 10 → 10a delta\n')
    lines.append(f'{"Pattern":<35} {"Source":<18} {"Δnotes":>7} {"Δonsets":>8} {"Δdensity":>9} {"Δpitch_rng":>11} {"Δvel":>6}')
    lines.append('-' * 100)
    for a in analyses:
        bd = a.get('busyness_delta')
        if not bd:
            continue
        parts = a['group'].split('|')
        src, pat = parts[0], parts[1]
        row = (f'{pat:<35} {src:<18} '
               f'{bd.get("note_count_delta", 0):>+7} '
               f'{bd.get("onset_count_delta", 0):>+8} '
               f'{bd.get("onset_density_delta", 0):>+9.2f} '
               f'{bd.get("pitch_range_delta", 0):>+11} '
               f'{bd.get("vel_mean_delta", 0):>+6.1f}')
        lines.append(row)
    lines.append('')

    # Aggregate analysis
    lines.append('## Aggregate intensity progression analysis\n')

    # Collect all patterns' step deltas
    all_step_deltas: dict[str, list] = defaultdict(list)
    all_busyness: list[dict] = []
    for a in analyses:
        for step, d in a['step_deltas'].items():
            all_step_deltas[step].append(d)
        if a.get('busyness_delta'):
            all_busyness.append(a['busyness_delta'])

    def mean_delta(deltas_list: list[dict], key: str) -> float:
        vals = [d.get(key, 0) for d in deltas_list if d.get(key) is not None]
        return statistics.mean(vals) if vals else 0.0

    metrics_show = [
        ('note_count_delta', 'Δ notes'),
        ('onset_density_delta', 'Δ onset/bar'),
        ('pitch_range_delta', 'Δ pitch range'),
        ('vel_mean_delta', 'Δ mean vel'),
        ('poly_mean_delta', 'Δ polyphony'),
    ]

    lines.append('### Average change per intensity step (across all patterns)\n')
    header_row = f'{"Metric":<20}' + ''.join(f'{s:>12}' for s in [k for k in all_step_deltas])
    lines.append(header_row)
    lines.append('-' * len(header_row))
    for key, label in metrics_show:
        row = f'{label:<20}'
        for step in all_step_deltas:
            row += f'{mean_delta(all_step_deltas[step], key):>+12.2f}'
        lines.append(row)
    lines.append('')

    if all_busyness:
        lines.append('### Average 10→10a (Busyness) delta\n')
        for key, label in metrics_show:
            val = mean_delta(all_busyness, key)
            lines.append(f'  {label:<20} {val:>+8.2f}')
        lines.append('')

    # Hypothesis evaluation
    lines.append('## Interpretation notes\n')
    lines.append('Intensity axis (1→10):')
    for step, d_list in all_step_deltas.items():
        nc = mean_delta(d_list, 'note_count_delta')
        od = mean_delta(d_list, 'onset_density_delta')
        vd = mean_delta(d_list, 'vel_mean_delta')
        pr = mean_delta(d_list, 'pitch_range_delta')
        lines.append(f'  {step}: notes {nc:+.1f}  onset_density {od:+.2f}  pitch_range {pr:+.1f} sem  vel {vd:+.1f}')

    if all_busyness:
        lines.append('\nBusyness axis (10→10a):')
        for key, label in metrics_show:
            val = mean_delta(all_busyness, key)
            lines.append(f'  {label}: {val:>+.2f}')

    output_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {output_path}')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('midi_dir', nargs='?',
                        default=str(Path(__file__).parent.parent / 'VP Vibe and GRIT MIDI'),
                        help='Directory containing tagged VP MIDI files')
    args = parser.parse_args()

    midi_dir = Path(args.midi_dir)
    if not midi_dir.is_dir():
        print(f'ERROR: {midi_dir}', file=sys.stderr); sys.exit(1)

    out_dir = Path(__file__).parent.parent

    # Group files by (source, pattern_name)
    groups: dict[str, dict] = defaultdict(dict)  # group_key -> {intensity -> info}
    pattern_sources: dict[str, set] = defaultdict(set)  # pattern_name -> {sources}

    midi_files = sorted(midi_dir.glob('*.mid'))
    print(f'Loading {len(midi_files)} files…')

    for path in midi_files:
        source, bpm, pattern, intensity = parse_filename(path.stem)
        if source is None:
            continue
        group_key = f'{source}|{pattern}|{bpm}bpm'
        pattern_sources[pattern].add(source)
        try:
            notes, ppq, bars = parse_notes(path)
        except Exception as e:
            print(f'  ERROR {path.name}: {e}', file=sys.stderr)
            continue
        groups[group_key][intensity] = {
            'path': str(path),
            'notes': notes,
            'ppq': ppq,
            'bars': bars,
        }

    # Find shared patterns (same name in multiple sources)
    cross_title = {p: s for p, s in pattern_sources.items() if len(s) > 1}
    print(f'Found {len(groups)} pattern groups; {len(cross_title)} patterns shared across titles')

    # Analyze each group
    analyses = []
    for group_key in sorted(groups):
        a = analyze_group(group_key, groups[group_key])
        analyses.append(a)

    # Serialize (convert path back, drop notes arrays for JSON)
    json_output = []
    for a in analyses:
        entry = {k: v for k, v in a.items() if k != 'intensities'}
        entry['intensities'] = {}
        for intens, stats in a['intensities'].items():
            entry['intensities'][intens] = stats
        json_output.append(entry)

    json_path = out_dir / 'vp-intensity-analysis.json'
    json_path.write_text(json.dumps(json_output, indent=2), encoding='utf-8')
    print(f'Wrote {json_path}')

    md_path = out_dir / 'vp-intensity-report.md'
    write_markdown(analyses, md_path, cross_title)

    # Print a quick terminal summary
    print('\n=== Quick summary: average metric change per intensity step ===\n')
    all_step_deltas: dict[str, list] = defaultdict(list)
    all_busyness: list[dict] = []
    for a in analyses:
        for step, d in a['step_deltas'].items():
            all_step_deltas[step].append(d)
        if a.get('busyness_delta'):
            all_busyness.append(a['busyness_delta'])

    def mean_d(dl, key):
        vals = [d.get(key, 0) for d in dl if d.get(key) is not None]
        return statistics.mean(vals) if vals else 0.0

    steps = list(all_step_deltas.keys())
    print(f'{"Step":<10} {"Δnotes":>8} {"Δonset/bar":>11} {"Δpitch_rng":>11} {"Δvel_mean":>10} {"Δpolyphony":>11}')
    print('-' * 60)
    for step in steps:
        dl = all_step_deltas[step]
        print(f'{step:<10} {mean_d(dl,"note_count_delta"):>+8.1f} '
              f'{mean_d(dl,"onset_density_delta"):>+11.2f} '
              f'{mean_d(dl,"pitch_range_delta"):>+11.1f} '
              f'{mean_d(dl,"vel_mean_delta"):>+10.1f} '
              f'{mean_d(dl,"poly_mean_delta"):>+11.2f}')

    if all_busyness:
        print(f'\n{"10→10a":<10} {mean_d(all_busyness,"note_count_delta"):>+8.1f} '
              f'{mean_d(all_busyness,"onset_density_delta"):>+11.2f} '
              f'{mean_d(all_busyness,"pitch_range_delta"):>+11.1f} '
              f'{mean_d(all_busyness,"vel_mean_delta"):>+10.1f} '
              f'{mean_d(all_busyness,"poly_mean_delta"):>+11.2f}')


if __name__ == '__main__':
    main()
