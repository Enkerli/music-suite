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
soft notes (velocity 127 is always full; positive makes soft notes louder);
an oscillator's pitch is in semitones (within its +-7; its octave beyond),
and so is a modulation of it, as far as you like, but with "extend_range"
both count in octaves; keytracking off, an oscillator plays C4.

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


def common(x, v, attack, scenes="a", decays=None):
    """Both envelopes analog (straight lines in dB), sustain 0, released as they decay (Twirl's voices are one-shots).
    decays: each scene's amp envelope's (log2 s); v["d1"] for all of them otherwise."""
    for i, sc in enumerate(scenes):
        d = decays[i] if decays else v["d1"]
        for e in (1, 2):
            x = setp(x, f"{sc}_env{e}_mode", 1)
            x = setp(x, f"{sc}_env{e}_sustain", 0.0)
        x = setp(x, f"{sc}_env1_attack", L2(attack))
        x = setp(x, f"{sc}_env1_decay", d)
        x = setp(x, f"{sc}_env1_release", d)
        x = setp(x, f"{sc}_vca_velsense", VELSENSE)
    return setp(x, "volume", v["vol"])


# ── The voices: (Twirl's recipe, in index.html section 3) → Surge ───────────

def tune(x, sc, osc, semis):
    """An oscillator `semis` semitones from the note (or from C4, keytracking off): its octave, then the rest."""
    o = max(-3, min(3, round(semis / 12)))
    x = setp(x, f"{sc}_osc{osc}_octave", o)
    return setp(x, f"{sc}_osc{osc}_pitch", float(semis - 12 * o))



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
    x = setp(SINE, "a_osc1_pitch", 0.0, mods=[(FILTEG, v["drop"])])
    return common(env2(x, v["d2"]), v, 0.002)


def snare(v):
    """Noise through a bandpass near 1.9 kHz, and a shorter tone (a sine; Twirl's is a triangle) at Twirl's pitch."""
    x = setp(SINE, "a_mute_noise", 0)
    x = setp(x, "a_level_noise", v["noise"])
    x = tune(x, "a", 1, 10.0)                                  # note 38 → Twirl's 48
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


# ── The other packs (index.html, section 3a) ───────────────────────────────
# A pack only changes some voices; the rest are Paper's (above).

LFO = 17                                                       # modulation source of a scene's first voice LFO (17 to 22)
C4 = 440 * 2 ** (-9 / 12)                                      # what an oscillator plays with keytracking off


def lfo_env(x, sc, k, attack, decay, delay=None):
    """Voice LFO k of a scene as an envelope (shape 6): Surge's way of giving an oscillator its own."""
    x = setp(x, f"{sc}_lfo{k}_shape", 6)
    x = setp(x, f"{sc}_lfo{k}_attack", L2(attack))
    x = setp(x, f"{sc}_lfo{k}_decay", decay)
    x = setp(x, f"{sc}_lfo{k}_sustain", 0.0)
    x = setp(x, f"{sc}_lfo{k}_release", decay)
    return setp(x, f"{sc}_lfo{k}_delay", L2(delay)) if delay else x


def layered(x):
    """Scene B made like scene A, and both playing (Surge's "dual" scene mode): six oscillators."""
    for name, rest in re.findall(r'<a_([a-z0-9_]+) (type="\d" value="[^"]*"[^>]*?)\s*/>', x):
        x = re.sub(rf'<b_{name} [^>]*?/>', lambda _: f'<b_{name} {rest} />', x, count=1)
    return setp(x, "scenemode", 2)


def struck(ratios, semis=0.0, attack=0.003, click=False):
    """A struck tone from partials (Twirl's partials()): a sine each, at `ratios` times the note
    (`semis` above it). The first in each scene has the scene's amp envelope (its decay "d{i}");
    the others an LFO envelope each, under it (level "l{i}", decay "d{i}"). Three a scene,
    so up to six. Each partial's level and decay are fitted; the first's level is the patch's."""
    def make(v):
        n = len(ratios)
        x = layered(SINE) if n > 3 else SINE
        scenes = "ab"[:(n + 2) // 3]
        for i, r in enumerate(ratios):
            sc, osc = scenes[i // 3], i % 3 + 1
            x = setp(x, f"{sc}_osc{osc}_type", 1)
            x = tune(x, sc, osc, semis + 12 * L2(r))
            x = setp(x, f"{sc}_mute_o{osc}", 0)
            if osc == 1:
                x = setp(x, f"{sc}_level_o1", v.get(f"l{i}", 1.0))
            else:
                x = setp(x, f"{sc}_level_o{osc}", 0.0, mods=[(LFO + osc - 2, v[f"l{i}"])])
                x = lfo_env(x, sc, osc - 2, attack, v[f"d{i}"])
        if click:                                              # the kalimba's: a tick of noise
            x = setp(x, "a_mute_noise", 0)
            x = setp(x, "a_level_noise", 0.0, mods=[(LFO + 3, v["click"])])
            x = lfo_env(x, "a", 3, 0.001, v["dclick"])
        return common(x, v, attack, scenes, [v[f"d{3 * j}"] for j in range(len(scenes))])
    return make


def struck_spec(partials, click=False):
    """Fit's starting values for struck(): Twirl's levels (relative to the first) and decays
    (log2 s, less about one: Surge's analog decay falls 35 dB a second at 1 s, Twirl's 67 dB over its decay)."""
    spec = {"vol": [-6, 3, -30, 24]}
    for i, (_, amp, dec) in enumerate(partials):
        spec[f"d{i}"] = [round(L2(dec) - 0.94, 3), 0.5, -9, 4]
        if i % 3:
            spec[f"l{i}"] = [round(amp / partials[i - i % 3][1], 3), 0.15, 0, 1]
        elif i:
            spec[f"l{i}"] = [round(amp / partials[0][1], 3), 0.15, 0, 1]
    if click:
        spec.update(click=[0.2, 0.1, 0, 1], dclick=[-6.6, 0.5, -10, -3])
    return spec


def partials_patch(partials, semis=0.0, attack=0.003, click=False, what=""):
    return (struck([r for r, _, _ in partials], semis, attack, click), what, struck_spec(partials, click))


def vibes(v):
    """A sine with a slow shimmer: a 5.5 Hz tremolo (Mallets' bell)."""
    x = setp(SINE, "a_level_o1", 1.0, mods=[(LFO, v["trem"])])
    x = setp(x, "a_lfo0_shape", 0)
    x = setp(x, "a_lfo0_rate", L2(5.5))
    return common(x, v, 0.003)


def triangle(semis):
    """A plain triangle (Surge's "modern" oscillator, triangle only)."""
    def make(v):
        x = setp(SAW, "a_osc1_type", 8)
        for k, val in enumerate((0.0, 0.0, 1.0)):
            x = setp(x, f"a_osc1_param{k}", val)
        return common(tune(x, "a", 1, semis), v, 0.001)
    return make


def sine_drop(semis, keytrack=1, square=False):
    """A tone falling `drop` semitones into its pitch (the filter envelope, "d2"): Mallets' log drum, Chip's square kick."""
    def make(v):
        x = setp(SAW, "a_osc1_param0", -1.0) if square else SINE
        x = setp(x, "a_osc1_keytrack", keytrack)
        o = max(-3, min(3, round(semis / 12)))
        x = setp(x, "a_osc1_octave", o)
        x = setp(x, "a_osc1_pitch", float(semis - 12 * o), mods=[(FILTEG, v["drop"])])
        return common(env2(x, v["d2"]), v, 0.001)
    return make


def fixed_sine(hz):
    """A short sine at one pitch whatever the note (Mallets' woodblock and claves)."""
    def make(v):
        x = setp(SINE, "a_osc1_keytrack", 0)
        return common(tune(x, "a", 1, 12 * L2(hz / C4)), v, 0.001)
    return make


def noise_filtered(ftype, hz):
    """Noise through a lowpass (1) or highpass (4) at `hz` (Chip's snare, hat and shaker)."""
    def make(v):
        x = noise_only(SINE)
        x = setp(x, "a_filter1_type", ftype)
        x = setp(x, "a_filter1_cutoff", 12 * L2(hz / 440))
        x = setp(x, "a_filter1_keytrack", 0.0)
        return common(x, v, 0.001)
    return make


def square(v):
    """A plain square (Chip's pluck)."""
    return common(setp(SAW, "a_osc1_param0", -1.0), v, 0.002)


def square_drop(v):
    """A square dropping an octave into its note (Chip's blip)."""
    x = setp(SAW, "a_osc1_param0", -1.0)
    x = setp(x, "a_osc1_pitch", 0.0, mods=[(FILTEG, v["chirp"])])
    return common(env2(x, v["d2"]), v, 0.001)


def arpeggio(v):
    """Chip's bell: a fast up-arpeggio, root, third, fifth and octave, 45 ms apart, squares;
    each note an LFO envelope that waits its turn (scene B has the octave)."""
    x = layered(setp(SAW, "a_osc1_param0", -1.0))
    for i, iv in enumerate((0, 4, 7, 12)):
        sc, osc = "ab"[i // 3], i % 3 + 1
        x = setp(x, f"{sc}_osc{osc}_type", 0)
        x = setp(x, f"{sc}_osc{osc}_param0", -1.0)
        x = tune(x, sc, osc, float(iv))
        x = setp(x, f"{sc}_mute_o{osc}", 0)
        x = setp(x, f"{sc}_level_o{osc}", 0.0, mods=[(LFO + osc - 1, 1.0)])
        x = lfo_env(x, sc, osc - 1, 0.001, v["dn"], delay=v["gap"] * i if i else None)
    x = common(x, v, 0.001, "ab", [1.0, 1.0])
    for sc in "ab":                                             # the notes' own envelopes shape it; the amp's just holds
        x = setp(x, f"{sc}_env1_sustain", 1.0)
    return x


def felt(v):
    """A soft, felted upright: a triangle and a sine an octave up (a hair sharp), through a slowly
    closing lowpass that opens with velocity; a round attack (Felt's pluck; its bell is the same, an octave up)."""
    x = setp(SAW, "a_osc1_type", 8)
    for k, val in enumerate((0.0, 0.0, 1.0)):
        x = setp(x, f"a_osc1_param{k}", val)
    x = setp(x, "a_osc2_type", 1)
    x = tune(x, "a", 2, 12 * L2(2.003))
    x = setp(x, "a_mute_o2", 0)
    x = setp(x, "a_level_o2", v["l1"])
    x = setp(x, "a_filter1_type", 1)
    x = setp(x, "a_filter1_cutoff", v["cut"])
    x = setp(x, "a_filter1_envmod", v["env"], mods=[(VEL, v["venv"])])
    return common(env2(x, v["d2"]), v, 0.012)


DRUM = "channel 10, note {}), for a drum machine's pad"
PLUCK, BELL, BLIP = "Twirl's pluck (channel 1)", "Twirl's bell (channel 2)", "Twirl's blip (channel 3)"
FELT = {"l1": [1.0, 0.15, 0, 1], "cut": [12 * L2(400 / 440), 4, -30, 40], "env": [20, 4, 0, 60], "venv": [10, 4, -30, 40],
        "d2": [-0.8, 0.5, -6, 2], "d1": [-0.6, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}

# pack: {name: (builder, what it's for, the starting values and how the fit may move them: [value, step, low, high])}
PATCHES = {
    "Paper": {
        "Pluck": (pluck, PLUCK,
                  {"cut": [-5.5, 4, -30, 40], "res": [0.3, 0.15, 0, 0.9], "env": [30, 6, 0, 70], "venv": [15, 5, -40, 60],
                   "d2": [-1.5, 0.5, -6, 2], "d1": [-1.0, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}),
        "Bell": (bell, BELL,
                 {"fm": [-36, 4, -60, 0], "fmenv": [18, 4, 0, 60], "fmvel": [4, 2, 0, 30],
                  "d2": [-0.5, 0.5, -6, 2], "d1": [0.0, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}),
        "Blip": (blip, BLIP,
                 {"chirp": [7.02, 1, 0, 14], "cut": [12 * L2(3200 / 440), 3, 0, 60], "d2": [-4.5, 0.5, -9, 0],
                  "d1": [-2.5, 0.5, -6, 2], "vol": [-6, 3, -30, 24]}),
        "Kick": (kick, "Twirl's kick (" + DRUM.format(36),
                 {"drop": [19, 3, 0, 40], "d2": [-3.5, 0.5, -8, 0], "d1": [-1.5, 0.5, -6, 2], "vol": [-6, 3, -30, 24]}),
        "Snare": (snare, "Twirl's snare (" + DRUM.format(38),
                  {"noise": [0.7, 0.2, 0, 1], "tone": [0.7, 0.2, 0, 1], "cut": [12 * L2(1900 / 440), 3, -20, 50], "res": [0.2, 0.15, 0, 0.9],
                   "d2": [-3.0, 0.5, -8, 0], "d1": [-2.3, 0.5, -6, 1], "vol": [-6, 3, -30, 24]}),
        "Hat": (hat, "Twirl's hat (" + DRUM.format(42),
                {"cut": [12 * L2(8000 / 440), 3, 0, 70], "d1": [-4.0, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
        "Shaker": (shaker, "Twirl's shaker (" + DRUM.format(70),
                   {"cut": [12 * L2(5800 / 440), 3, 0, 70], "res": [0.3, 0.15, 0, 0.9], "d1": [-3.3, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
    },
    "Mallets": {                                               # drums: also Steel's and Kalimba's
        "Pluck": partials_patch([(1, 0.3, 0.5), (3.93, 0.08, 0.08)], 0, 0.002, what="Mallets' pluck, a marimba (channel 1)"),
        "Bell": (vibes, "Mallets' bell, a vibraphone (channel 2)", {"trem": [0.25, 0.1, 0, 1], "d1": [-0.3, 0.5, -6, 3], "vol": [-6, 3, -30, 24]}),
        "Blip": (triangle(12), "Mallets' blip, a xylophone (channel 3)", {"d1": [-4.0, 0.5, -9, 0], "vol": [-6, 3, -30, 24]}),
        "Kick": (sine_drop(12), "Mallets' kick, a log drum (" + DRUM.format(36),
                 {"drop": [8.1, 2, 0, 24], "d2": [-6, 0.5, -10, -2], "d1": [-2.7, 0.5, -6, 1], "vol": [-6, 3, -30, 24]}),
        "Snare": (fixed_sine(750 + (0.62 - 0.45) * 600), "Mallets' snare, a woodblock (" + DRUM.format(38),
                  {"d1": [-5.3, 0.5, -9, 0], "vol": [-6, 3, -30, 24]}),
        "Hat": (fixed_sine(2400), "Mallets' hat, claves (" + DRUM.format(42), {"d1": [-5.3, 0.5, -9, 0], "vol": [-6, 3, -30, 24]}),
    },
    "Chip": {
        "Pluck": (square, "Chip's pluck, a square (channel 1)", {"d1": [-3.1, 0.5, -8, 1], "vol": [-6, 3, -30, 24]}),
        "Bell": (arpeggio, "Chip's bell, an up-arpeggio (channel 2)", {"gap": [0.045, 0.01, 0.02, 0.08], "dn": [-4.0, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
        "Blip": (square_drop, "Chip's blip, the pitch-drop blip (channel 3)",
                 {"chirp": [12, 2, 0, 24], "d2": [-4.5, 0.5, -9, 0], "d1": [-4.3, 0.5, -9, 0], "vol": [-6, 3, -30, 24]}),
        "Kick": (sine_drop(12 * L2(45 / C4), keytrack=0, square=True), "Chip's kick, a square (" + DRUM.format(36),
                 {"drop": [12 * L2(220 / 45), 3, 0, 40], "d2": [-4.3, 0.5, -9, 0], "d1": [-3.8, 0.5, -8, 0], "vol": [-6, 3, -30, 24]}),
        "Snare": (noise_filtered(1, 5000), "Chip's snare, noise (" + DRUM.format(38), {"d1": [-4.0, 0.5, -9, 0], "vol": [-6, 3, -30, 24]}),
        "Hat": (noise_filtered(4, 8000), "Chip's hat, noise (" + DRUM.format(42), {"d1": [-6.0, 0.5, -10, -2], "vol": [-6, 3, -30, 24]}),
        "Shaker": (noise_filtered(4, 9000), "Chip's shaker, noise (" + DRUM.format(70), {"d1": [-6.3, 0.5, -10, -2], "vol": [-6, 3, -30, 24]}),
    },
    "Felt": {
        "Pluck": (felt, "Felt's pluck, a felted upright (channel 1)", dict(FELT)),
        "Bell": (felt, "Felt's bell, the same an octave up (channel 2)", dict(FELT)),
        "Blip": partials_patch([(1, 0.12, 0.18), (2, 0.03, 0.08)], 12, 0.008, what="Felt's blip (channel 3)"),
    },
    "Steel": {
        "Pluck": partials_patch([(1, 0.22, 0.9), (2.0, 0.1, 0.5), (3.01, 0.05, 0.25)], 0, 0.006, what="Steel's pluck, a steelpan (channel 1)"),
        "Bell": partials_patch([(1, 0.18, 1.2), (2.0, 0.08, 0.6), (3.01, 0.04, 0.3)], 0, 0.006, what="Steel's bell (channel 2)"),
        "Blip": partials_patch([(1, 0.12, 0.25), (2.0, 0.04, 0.12)], 12, 0.003, what="Steel's blip (channel 3)"),
    },
    "Kalimba": {
        "Pluck": partials_patch([(1, 0.26, 1.1), (5.95, 0.05, 0.06)], 0, 0.002, click=True, what="Kalimba's pluck, a thumb piano (channel 1)"),
        "Bell": partials_patch([(1, 0.26, 1.1), (5.95, 0.05, 0.06)], 0, 0.002, click=True, what="Kalimba's bell, the same an octave up (channel 2)"),
        "Blip": partials_patch([(1, 0.13, 0.3), (5.95, 0.03, 0.03)], 12, 0.002, what="Kalimba's blip (channel 3)"),
    },
    "Chimes": {
        "Pluck": partials_patch([(1, 0.14, 1.4), (2.756, 0.05, 0.6), (5.404, 0.02, 0.25)], 0, 0.003, what="Chimes' pluck, a damped bar (channel 1)"),
        # three in scene A, two in B (the twin fundamental, a hair apart, for the shimmer; the highest partial)
        "Bell": partials_patch([(1, 0.09, 4.5), (2.756, 0.05, 2.4), (5.404, 0.025, 1.1), (1.0016, 0.04, 4), (8.933, 0.012, 0.5)],
                               0, 0.002, what="Chimes' bell, a wind chime (channel 2)"),
        "Blip": partials_patch([(1, 0.07, 1.2), (2.756, 0.025, 0.5)], 12, 0.001, what="Chimes' blip, a tiny chime (channel 3)"),
    },
}


def fitted():
    p = HERE / "fitted.json"
    return json.loads(p.read_text()) if p.exists() else {}


def build(pack, name, values=None):
    make, what, start = PATCHES[pack][name]
    v = {k: s[0] for k, s in start.items()}
    v.update(values if values is not None else fitted().get(pack, {}).get(name, {}))
    return meta(make(v), f"Twirl {pack} {name}", f"{what}. Generated by apps/twirl/surge/make_patches.py")


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "patches"
    out.mkdir(exist_ok=True)
    for pack, patches in PATCHES.items():
        for name in patches:
            path = out / f"Twirl {pack} {name}.fxp"
            path.write_bytes(fxp(build(pack, name), f"Twirl {pack} {name}"))
            print(path)


if __name__ == "__main__":
    main()
