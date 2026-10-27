#!/usr/bin/env python3
"""Fit the Surge XT patches' numbers to Twirl's own voices (fitted.json).

    python3 -m venv /tmp/fitenv && /tmp/fitenv/bin/pip install pedalboard mido numpy
    /tmp/fitenv/bin/python apps/twirl/surge/fit.py [Paper Chip/Bell …]    # a pack, or one patch; all, if none named

Needs Surge XT's VST3 (/usr/lib/vst3, or SURGE_VST3=…), Node and Playwright's
Chromium (as Twirl's tests do). It renders Twirl's voices offline in the page
(test/render-voices.mjs: dry, through Twirl's volume), renders each patch in
Surge XT (pedalboard; the patch goes in as Surge's VST3 state, which is the
.fxp's chunk inside JUCE's wrapper), and moves the patch's free numbers
(make_patches.PATCHES) one at a time, halving the steps each round, to
match the two: loudness (dB in 10 ms frames, for 1.6 s, wherever either is
heard), the peak, and brightness (the spectral centroid, in semitones from
the note) over time (the volume, a pure gain, is set from the renders at each
step rather than fitted, so it never fights the rest), at each voice's
notes and three velocities, each note as long as Twirl sends it. What it
can't match (Surge's envelopes aren't Web Audio's ramps) shows in the report.
"""
import json, math, os, re, struct, subprocess, sys, tempfile
from pathlib import Path

import mido
import numpy as np
import pedalboard

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_patches as mp  # noqa: E402

SR, DUR, HOP, WIN = 48000, 1.6, 480, 2048
VELS = [0.4, 0.8, 1]
NOTES = [48, 60, 72, 84]
# patch (in any pack): (Twirl's voice, its notes as Twirl sends them, the note's length as Twirl sends it, the page's pitch and height for drums)
CASES = {
    "Pluck": ("pluck", NOTES, 0.22, {}), "Bell": ("bell", NOTES, 0.6, {}), "Blip": ("blip", NOTES, 0.22, {}),
    "Kick": ("drum", [36], 0.08, {"midi": 60, "yN": 0.8}), "Snare": ("drum", [38], 0.08, {"midi": 60, "yN": 0.45}),
    "Hat": ("drum", [42], 0.08, {"midi": 60, "yN": 0.1}), "Shaker": ("shake", [70], 0.08, {"yN": 0.5}),
    **{k: ("shake", [note], 0.08, {"yN": 0.5, "shaker": k.lower()}) for k, (*_, note) in mp.SHAKER_KINDS.items()},
}


# patches whose loudness is compared over longer frames (s): the rain stick's grains fall at
# random within 20 ms in Twirl, so 10 ms frames would set a grain against a gap
SPAN = {"Rainstick": 0.05}


def page_pack(pack):
    """The page's name for a pack (PACKS in index.html); the shakers are played in Paper."""
    return "paper" if pack == "Shakers" else pack.lower().replace(" ", "")

# ── Surge XT, offline ──────────────────────────────────────────────────────

ALPHA = ".ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+"


def j64(b):
    """JUCE's MemoryBlock::toBase64Encoding: "size." then 6 bits a character, least significant first."""
    n, out = len(b) * 8, []
    for i in range(0, n, 6):
        v = 0
        for k in range(6):
            p = i + k
            if p < n and b[p >> 3] & (1 << (p & 7)):
                v |= 1 << k
        out.append(ALPHA[v])
    return f"{len(b)}." + "".join(out)


_surge = None


def surge():
    global _surge
    if _surge is None:
        _surge = pedalboard.load_plugin(os.environ.get("SURGE_VST3", "/usr/lib/vst3/Surge XT.vst3"))
    return _surge


def render(xml, note, vel, length):
    p = surge()
    x = p.raw_state[p.raw_state.find(b"<?xml"):].decode()
    chunk = mp.fxp(xml, "fit")[60:]
    x = re.sub(r"<IComponent>[^<]*</IComponent>", "<IComponent>" + j64(chunk) + "</IComponent>", x).encode()
    p.raw_state = b"VC2!" + struct.pack("<I", len(x) + 1) + x + b"\0"
    msgs = [(mido.Message("note_on", note=note, velocity=vel).bytes(), 0.01),
            (mido.Message("note_off", note=note, velocity=0).bytes(), 0.01 + length)]
    return p(msgs, duration=DUR, sample_rate=SR, num_channels=2, buffer_size=256, reset=True)[0]

# ── Twirl, offline ─────────────────────────────────────────────────────────


def twirl(pack, patch, tmp):
    voice, notes, _, extra = CASES[patch]
    jobs = [dict(pack=page_pack(pack), voice=voice, note=n, vel=v, **extra) for n in notes for v in VELS]
    subprocess.run(["node", str(HERE.parent / "test" / "render-voices.mjs"), tmp, json.dumps(jobs)], check=True, capture_output=True)
    kind = f"-{extra['shaker']}" if "shaker" in extra else ""
    return {(n, v): np.fromfile(f"{tmp}/{page_pack(pack)}-{voice}-{n}-{v}{kind}.f32", dtype=np.float32) for n in notes for v in VELS}

# ── Matching ───────────────────────────────────────────────────────────────


def features(m, note, span=HOP / SR):
    n = int(DUR * SR)
    m = np.pad(m[:n], (0, max(0, n - len(m))))
    f0 = 440 * 2 ** ((note - 69) / 12)
    hz = np.fft.rfftfreq(WIN, 1 / SR)
    db, cen = [], []
    for i in range(0, n - WIN, HOP):
        s = m[i:i + WIN]
        db.append(max(-80, 20 * math.log10(np.sqrt(np.mean(m[i:i + round(span * SR)] ** 2)) + 1e-9)))
        a = np.abs(np.fft.rfft(s * np.hanning(WIN)))
        cen.append(12 * math.log2(max(f0 / 4, (a * hz).sum() / (a.sum() + 1e-12)) / f0))
    return np.array(db), np.array(cen)


def span(patch):
    return [SPAN[patch]] if patch in SPAN else []


def score(tdb, tcen, sdb, scen):
    heard = np.maximum(tdb, sdb) > -70                             # where either sounds (silence would dilute short drums)
    loud = np.mean(np.abs(tdb - sdb)[heard])
    peak = abs(tdb.max() - sdb.max())
    live = (tdb > tdb.max() - 40) & (sdb > sdb.max() - 40)
    bright = np.mean(np.abs(tcen[live] - scen[live])) if live.any() else 24
    return loud + 0.5 * peak + 0.5 * bright, loud, bright


def cost(pack, patch, values, targets, report=False):
    """How far the patch is from Twirl, at the patch's best volume: the volume is a pure gain,
    so it's found from the renders (dB shifts) rather than fitted, and it never fights the
    shape. Returns the cost and the volume (and, to report, each case's distances)."""
    xml = mp.PATCHES[pack][patch][0](values)
    rendered = [(t, features(render(xml, n, max(1, round(v * 127)), CASES[patch][2]), n, *span(patch)), (n, v)) for (n, v), t in targets.items()]

    def at(shift):
        out = []
        for (tdb, tcen), (sdb, scen), nv in rendered:
            s = np.where(sdb > -80, np.maximum(-80, sdb + shift), -80)
            out.append((score(tdb, tcen, s, scen), tdb.max(), s.max(), nv))
        return sum(r[0][0] for r in out) / len(out), out

    shifts = np.arange(-24, 24.01, 1.0)
    coarse = min(shifts, key=lambda d: at(d)[0])
    shift = min(np.arange(coarse - 1, coarse + 1.01, 0.125), key=lambda d: at(d)[0])
    total, out = at(shift)
    vol = values["vol"] + shift
    if not report:
        return total, vol
    rows = [f"  note {n} vel {v}: loudness off {loud:.1f} dB, brightness off {bright:.1f} st, peak {tp:.0f} dB (Twirl) / {sp:.0f} dB (Surge)"
            for (_, loud, bright), tp, sp, (n, v) in out]
    return total, vol, rows


def fit(pack, patch, start, rounds=6):
    spec = mp.PATCHES[pack][patch][2]
    with tempfile.TemporaryDirectory() as tmp:
        targets = {k: features(m, k[0], *span(patch)) for k, m in twirl(pack, patch, tmp).items()}
    vals = {k: start.get(k, s[0]) for k, s in spec.items()}
    steps = {k: s[1] for k, s in spec.items()}
    best, vals["vol"] = cost(pack, patch, vals, targets)
    for r in range(rounds):
        for k, (_, _, lo, hi) in spec.items():
            if k == "vol":                                           # found, not fitted (cost())
                continue
            for sgn in (1, -1):
                while True:
                    trial = dict(vals, **{k: min(hi, max(lo, vals[k] + sgn * steps[k]))})
                    if trial[k] == vals[k]:
                        break
                    c, vol = cost(pack, patch, trial, targets)
                    if c >= best - 1e-3:
                        break
                    best, vals = c, dict(trial, vol=vol)
        print(f"{pack} {patch}, round {r}: {best:.2f}", flush=True)
        steps = {k: s / 2 for k, s in steps.items()}
    total, vals["vol"], rows = cost(pack, patch, vals, targets, report=True)
    print("\n".join(rows))
    return {k: round(float(v), 4) for k, v in vals.items()}, total


def main():
    todo = []
    for arg in sys.argv[1:] or [p for p in mp.PATCHES if p]:   # not "": the Drone, made by hand
        pack, _, name = arg.partition("/")
        todo += [(pack, name)] if name else [(pack, n) for n in mp.PATCHES[pack]]
    path = HERE / "fitted.json"
    read = lambda: json.loads(path.read_text()) if path.exists() else {}
    for pack, name in todo:
        vals, total = fit(pack, name, read().get(pack, {}).get(name, {}))
        data = read()                                    # again: other fits may have run meanwhile
        data.setdefault(pack, {})[name] = vals
        data.setdefault("score", {}).setdefault(pack, {})[name] = round(total, 2)
        path.write_text(json.dumps(data, indent=1, sort_keys=True) + "\n")
        print(f"{pack} {name}: {total:.2f}", flush=True)


if __name__ == "__main__":
    main()
