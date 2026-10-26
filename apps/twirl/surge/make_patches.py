#!/usr/bin/env python3
"""Twirl's voices as Surge XT patches (PLAN.md, 1e). Standard library only.

    python3 apps/twirl/surge/make_patches.py [out dir]    # apps/twirl/surge/patches/ by default

Each patch starts from one of Surge's own templates (templates/, CC0, from
Surge XT's factory patches) and sets what makes Twirl's voice: oscillator,
filter, envelopes, FM. Its numbers come from fitted.json, which fit.py makes
by rendering Twirl's voices (test/render-voices.mjs) and Surge's patches
(pedalboard) and matching their loudness and brightness over time;
corrections go there (or into the structure below), not by hand into a patch.

Surge's units, as found: times are log2 seconds; cutoffs are semitones from
440 Hz; envelopes in "analog" mode fall in a straight line in dB, like Twirl's
exponential ramps; filter type 1 is a 12 dB lowpass, 4 a highpass, 6 a
bandpass; modulation sources: 1 velocity, 16 the filter envelope; the
amp's velocity sensitivity (a_vca_velsense) is in dB below full level for
soft notes (velocity 127 is always full; positive makes soft notes louder).

A .fxp is a 60-byte FXP header (CcnK, FPCh, id cjs3, the chunk's size), then
Surge's chunk: "sub3", the XML's length, six wavetable sizes (zero here),
then the XML.
"""
import json, math, re, struct, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
L2 = math.log2
VEL, FILTEG = 1, 16
# Twirl's loudness is proportional to velocity (-8 dB at 0.4, -1.9 at 0.8);
# Surge's velocity sensitivity of -13 dB follows that within about a dB
# (velocity 127 is always full level, whatever the setting).
VELSENSE = -13.0


def template(name):
    return (HERE / "templates" / f"{name}.xml").read_text()


SAW, SINE = template("Init Saw"), template("Init Sine")


def setp(xml, name, value, mods=None, **attrs):
    """A parameter's value (and attributes), with modulation routings: [(source, depth)]."""
    m = re.search(rf'<{name} ([^>]*?)(/>|>(.*?)</{name}>)', xml)
    assert m, name
    a = re.sub(r'value="[^"]*"', f'value="{value:.8f}"' if isinstance(value, float) else f'value="{value}"', m.group(1).rstrip())
    for k, v in attrs.items():
        a = re.sub(rf'{k}="[^"]*"', f'{k}="{v}"', a) if f'{k}="' in a else a + f' {k}="{v}"'
    el = f'<{name} {a} />'
    if mods:
        el = f'<{name} {a}>' + "".join(f'<modrouting source="{s}" depth="{d:.6f}" muted="0" source_index="0" />' for s, d in mods) + f'</{name}>'
    return xml[:m.start()] + el + xml[m.end():]


def meta(xml, name, comment):
    new = (f'<meta name="{name}" category="Twirl" comment="{comment}" author="Twirl (music-suite), generated" '
           'license="CC0, like Twirl and Surge\'s templates"><tags /></meta>')
    return re.sub(r'<meta [^>]*>(<tags />|<tags>.*?</tags>)</meta>', new, xml, count=1)


def fxp(xml, name):
    x = xml.encode()
    chunk = b"sub3" + struct.pack("<I", len(x)) + b"\0" * 24 + x
    head = b"CcnK" + struct.pack(">i", 0) + b"FPCh" + struct.pack(">i", 1) + b"cjs3" + struct.pack(">ii", 1, 1)
    head += name.encode()[:28].ljust(28, b"\0") + struct.pack(">i", len(chunk))
    assert len(head) == 60
    return head + chunk


def env2(x, decay):
    x = setp(x, "a_env2_attack", -9.0)
    x = setp(x, "a_env2_decay", decay)
    return setp(x, "a_env2_release", decay)


def common(x, v, attack):
    """Both envelopes analog (straight lines in dB), sustain 0, released as they decay (Twirl's voices are one-shots)."""
    for e in (1, 2):
        x = setp(x, f"a_env{e}_mode", 1)
        x = setp(x, f"a_env{e}_sustain", 0.0)
    x = setp(x, "a_env1_attack", L2(attack))
    x = setp(x, "a_env1_decay", v["d1"])
    x = setp(x, "a_env1_release", v["d1"])
    x = setp(x, "a_vca_velsense", VELSENSE)
    return setp(x, "volume", v["vol"])


# ── The voices: (Twirl's recipe, in index.html section 3) → Surge ───────────

def pluck(v):
    """Saw through a closing lowpass (Q 3), opening wider the harder it's hit."""
    x = setp(SAW, "a_osc1_param0", 0.0)
    x = setp(x, "a_filter1_type", 1)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    x = setp(x, "a_filter1_resonance", v["res"])
    x = setp(x, "a_filter1_envmod", v["env"], mods=[(VEL, v["venv"])])
    return common(env2(x, v["d2"]), v, 0.004)


def bell(v):
    """Two-operator FM: oscillator 2 (silent) at 3.5 times into oscillator 1, the depth falling with the filter envelope."""
    x = setp(SINE, "a_fm_switch", 1)                           # 2 > 1
    x = setp(x, "a_osc2_octave", 2)
    x = setp(x, "a_osc2_pitch", 12 * L2(3.5) - 24)             # 3.5 times: two octaves, less 2.31 semitones
    x = setp(x, "a_mute_o2", 1)
    x = setp(x, "a_fm_depth", v["fm"], mods=[(FILTEG, v["fmenv"]), (VEL, v["fmvel"])])
    return common(env2(x, v["d2"]), v, 0.002)


def blip(v):
    """A square chirping down a fifth into its note, through a fixed lowpass."""
    x = setp(SAW, "a_osc1_param0", -1.0)
    x = setp(x, "a_osc1_pitch", 0.0, mods=[(FILTEG, v["chirp"])])
    x = setp(x, "a_filter1_type", 1)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    return common(env2(x, v["d2"]), v, 0.002)


def noise_only(x):
    x = setp(x, "a_mute_o1", 1)
    return setp(x, "a_mute_noise", 0)


def kick(v):
    """A sine falling from three times its pitch to the note's (36: C2, as Twirl's plugin plays it)."""
    x = setp(SINE, "a_osc1_pitch", 0.0, mods=[(FILTEG, v["drop"])], extend_range=1)
    return common(env2(x, v["d2"]), v, 0.002)


def snare(v):
    """Noise through a bandpass near 1.9 kHz, and a shorter tone (a sine; Twirl's is a triangle) at Twirl's pitch."""
    x = setp(SINE, "a_mute_noise", 0)
    x = setp(x, "a_level_noise", v["noise"])
    x = setp(x, "a_osc1_pitch", 10.0, extend_range=1)          # note 38 → Twirl's 48
    x = setp(x, "a_level_o1", 0.0, mods=[(FILTEG, v["tone"])])
    x = setp(x, "a_filter1_type", 6)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    x = setp(x, "a_filter1_resonance", v["res"])
    x = setp(x, "a_filter1_keytrack", 0.0)
    return common(env2(x, v["d2"]), v, 0.001)


def hat(v):
    """Noise through a highpass, very short."""
    x = noise_only(SINE)
    x = setp(x, "a_filter1_type", 4)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    x = setp(x, "a_filter1_keytrack", 0.0)
    return common(x, v, 0.001)


def shaker(v):
    """Beads: noise through a bandpass and a highpass (1.8 kHz), a soft attack."""
    x = noise_only(SINE)
    x = setp(x, "a_filter1_type", 6)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    x = setp(x, "a_filter1_resonance", v["res"])
    x = setp(x, "a_filter1_keytrack", 0.0)
    x = setp(x, "a_filter2_type", 4)
    x = setp(x, "a_filter2_cutoff", 12 * L2(1800 / 440))
    x = setp(x, "a_filter2_keytrack", 0.0)
    return common(x, v, 0.007)


# name: (builder, what it's for, the starting values and how the fit may move them: [value, step, low, high])
PATCHES = {
    "Pluck": (pluck, "Twirl's pluck (channel 1)",
              {"cut": [-5.5, 4, -30, 40], "res": [0.3, 0.15, 0, 0.9], "env": [30, 6, 0, 70], "venv": [15, 5, -40, 60],
               "d2": [-1.5, 0.5, -6, 2], "d1": [-1.0, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}),
    "Bell": (bell, "Twirl's bell (channel 2)",
             {"fm": [-36, 4, -60, 0], "fmenv": [18, 4, 0, 60], "fmvel": [4, 2, 0, 30],
              "d2": [-0.5, 0.5, -6, 2], "d1": [0.0, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}),
    "Blip": (blip, "Twirl's blip (channel 3)",
             {"chirp": [7.02, 1, 0, 14], "cut": [12 * L2(3200 / 440), 3, 0, 60], "d2": [-4.5, 0.5, -9, 0],
              "d1": [-2.5, 0.5, -6, 2], "vol": [-6, 3, -30, 24]}),
    "Kick": (kick, "Twirl's kick (channel 10, note 36), for a drum machine's pad",
             {"drop": [19, 3, 0, 40], "d2": [-3.5, 0.5, -8, 0], "d1": [-1.5, 0.5, -6, 2], "vol": [-6, 3, -30, 24]}),
    "Snare": (snare, "Twirl's snare (channel 10, note 38), for a drum machine's pad",
              {"noise": [0.7, 0.2, 0, 1], "tone": [0.7, 0.2, 0, 1], "cut": [12 * L2(1900 / 440), 3, -20, 50], "res": [0.2, 0.15, 0, 0.9],
               "d2": [-3.0, 0.5, -8, 0], "d1": [-2.3, 0.5, -6, 1], "vol": [-6, 3, -30, 24]}),
    "Hat": (hat, "Twirl's hat (channel 10, note 42), for a drum machine's pad",
            {"cut": [12 * L2(8000 / 440), 3, 0, 70], "d1": [-4.0, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
    "Shaker": (shaker, "Twirl's shaker (channel 10, note 70), for a drum machine's pad",
               {"cut": [12 * L2(5800 / 440), 3, 0, 70], "res": [0.3, 0.15, 0, 0.9], "d1": [-3.3, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
}


def fitted():
    p = HERE / "fitted.json"
    return json.loads(p.read_text()) if p.exists() else {}


def build(name, values=None):
    make, what, start = PATCHES[name]
    v = {k: s[0] for k, s in start.items()}
    v.update(values if values is not None else fitted().get("Paper", {}).get(name, {}))
    return meta(make(v), f"Twirl Paper {name}", f"{what}. Generated by apps/twirl/surge/make_patches.py")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "patches"
    out.mkdir(exist_ok=True)
    for name in PATCHES:
        path = out / f"Twirl Paper {name}.fxp"
        path.write_bytes(fxp(build(name), f"Twirl Paper {name}"))
        print(path)


if __name__ == "__main__":
    main()
