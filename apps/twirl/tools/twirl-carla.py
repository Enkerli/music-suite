#!/usr/bin/env python3
"""
twirl-carla.py — build a Carla project that plays Twirl's MIDI with Surge XT.

Twirl (in a Chromium browser, Out: MIDI) sends one MIDI channel per voice:

    channel 1   pluck   (drawn to the right)
    channel 2   bell    (drawn upward)
    channel 3   blip    (drawn to the left)
    channel 10  drums and shaker (drawn downward / scribbled), General MIDI
                notes: kick 36, snare 38, hat 42, shaker 70

This script asks Carla to build a patchbay with one instrument per voice, each
behind a MIDI channel filter, all fed from Carla's MIDI input, all summed to
Carla's audio output, and saves it as a .carxp project you open in Carla:

    Midi Input ─┬─ Ch 1  → Surge XT (pluck) ─┐
                ├─ Ch 2  → Surge XT (bell)  ─┤
                ├─ Ch 3  → Surge XT (blip)  ─┼─ Audio Output
                └─ Ch 10 → GM drums (SF2)   ─┘   (or a fourth Surge XT)

It runs on YOUR machine, so it finds your own Surge XT (VST3 or LV2) and,
for the drums, a General MIDI soundfont if one is installed
(e.g. `sudo apt install fluid-soundfont-gm`).

Needs: Carla (`sudo apt install carla`), and a JACK server, which PipeWire
provides (run the script through `pw-jack` if Carla can't find JACK).

    python3 twirl-carla.py                       # writes ~/twirl-surge.carxp
    pw-jack python3 twirl-carla.py --out my.carxp
    python3 twirl-carla.py --surge "/path/to/Surge XT.vst3"
    python3 twirl-carla.py --drums surge         # a fourth Surge XT for drums

Then: open the project in Carla, choose a patch in each Surge XT (open its
editor: double-click), and save. Connect "Midi Through" to Carla's MIDI input
(Carla's patchbay, qpwgraph, or `aconnect`), and in Twirl choose
Everything → Sound and room → Out: MIDI · Midi Through Port-0.

Public Domain (CC0-1.0), like the rest of the suite.
"""
import argparse, glob, os, sys, time

RES = "/usr/share/carla/resources"
LIB = "/usr/lib/carla/libcarla_standalone2.so"
sys.path.insert(0, RES)
try:
    from carla_backend import (CarlaHostDLL, EngineCallbackFunc,
        ENGINE_OPTION_PROCESS_MODE, ENGINE_PROCESS_MODE_PATCHBAY, ENGINE_OPTION_TRANSPORT_MODE,
        ENGINE_TRANSPORT_MODE_JACK, ENGINE_OPTION_PATH_BINARIES, ENGINE_OPTION_PATH_RESOURCES,
        ENGINE_CALLBACK_PATCHBAY_CLIENT_ADDED, ENGINE_CALLBACK_PATCHBAY_PORT_ADDED,
        PATCHBAY_PORT_IS_INPUT, PATCHBAY_PORT_TYPE_AUDIO, PATCHBAY_PORT_TYPE_MIDI,
        BINARY_NATIVE, PLUGIN_INTERNAL, PLUGIN_LV2, PLUGIN_VST3, PLUGIN_SF2)
except ImportError:
    sys.exit("Carla's Python files aren't in %s: install Carla (sudo apt install carla)." % RES)

VOICES = [(1, "pluck"), (2, "bell"), (3, "blip"), (10, "drums")]
SURGE_VST3 = ["/usr/lib/vst3/Surge XT.vst3", "/usr/local/lib/vst3/Surge XT.vst3",
              os.path.expanduser("~/.vst3/Surge XT.vst3")]
SURGE_LV2_URIS = ["https://surge-synthesizer.github.io/lv2/surge-xt"]
GM_SF2 = ["/usr/share/sounds/sf2/FluidR3_GM.sf2", "/usr/share/sounds/sf2/default-GM.sf2",
          "/usr/share/soundfonts/FluidR3_GM.sf2", "/usr/share/soundfonts/default.sf2"]


def main():
    ap = argparse.ArgumentParser(description="Build a Carla project for Twirl's MIDI voices.")
    ap.add_argument("--out", default=os.path.expanduser("~/twirl-surge.carxp"))
    ap.add_argument("--surge", help="path to Surge XT.vst3 (found automatically otherwise)")
    ap.add_argument("--drums", default="auto", help='"auto" (a GM soundfont if found), "surge", or a path to an .sf2')
    ap.add_argument("--stand-in", action="store_true", help=argparse.SUPPRESS)   # tests: channel filters instead of synths
    a = ap.parse_args()

    clients, ports = {}, []                     # client id -> name; (client, port, hints, name)

    def on_event(_ptr, action, plugin_id, v1, v2, v3, _vf, vstr):
        name = vstr.decode("utf-8", "replace") if vstr else ""
        if action == ENGINE_CALLBACK_PATCHBAY_CLIENT_ADDED:
            clients[plugin_id] = name
        elif action == ENGINE_CALLBACK_PATCHBAY_PORT_ADDED:
            ports.append((plugin_id, v1, v2, name))
    cb = EngineCallbackFunc(on_event)

    h = CarlaHostDLL(LIB, False)
    h.set_engine_callback(cb)
    h.set_engine_option(ENGINE_OPTION_PROCESS_MODE, ENGINE_PROCESS_MODE_PATCHBAY, "")
    h.set_engine_option(ENGINE_OPTION_TRANSPORT_MODE, ENGINE_TRANSPORT_MODE_JACK, "")
    h.set_engine_option(ENGINE_OPTION_PATH_BINARIES, 0, "/usr/lib/carla")
    h.set_engine_option(ENGINE_OPTION_PATH_RESOURCES, 0, RES)
    if not h.engine_init("JACK", "Twirl"):
        sys.exit("Carla couldn't start on JACK (%s). With PipeWire, try: pw-jack python3 %s"
                 % (h.get_last_error(), sys.argv[0]))

    def add(ptype, filename, name, label):
        if not h.add_plugin(BINARY_NATIVE, ptype, filename, name, label, 0, None, 0):
            return None
        return h.get_current_plugin_count() - 1

    def add_surge(name):
        if a.stand_in:
            return add(PLUGIN_INTERNAL, "", name, "midichanfilter")
        paths = [a.surge] if a.surge else [p for p in SURGE_VST3 if os.path.exists(p)]
        for p in paths:
            pid = add(PLUGIN_VST3, p, name, "")
            if pid is not None:
                return pid
        for uri in SURGE_LV2_URIS:
            pid = add(PLUGIN_LV2, "", name, uri)
            if pid is not None:
                return pid
        sys.exit("Couldn't load Surge XT (looked for %s, and LV2 %s). Pass its path with --surge."
                 % (", ".join(SURGE_VST3), SURGE_LV2_URIS[0]))

    def add_drums():
        if a.drums == "surge":
            return add_surge("Drums (Surge XT)")
        sf2 = a.drums if a.drums.endswith(".sf2") else next((p for p in GM_SF2 if os.path.exists(p)), None)
        if sf2:
            pid = add(PLUGIN_SF2, sf2, "Drums (GM)", os.path.splitext(os.path.basename(sf2))[0])   # Carla wants the soundfont's name as its label
            if pid is not None:
                return pid
            print("Couldn't load %s (%s)." % (sf2, h.get_last_error()))
        print("No General MIDI soundfont (sudo apt install fluid-soundfont-gm): using a fourth Surge XT for drums.")
        return add_surge("Drums (Surge XT)")

    chain = []                                   # (channel, filter plugin id, instrument plugin id)
    for ch, voice in VOICES:
        f = add(PLUGIN_INTERNAL, "", "Ch %d · %s" % (ch, voice), "midichanfilter")
        if f is None:
            sys.exit("Couldn't add Carla's MIDI Channel Filter: %s" % h.get_last_error())
        for p in range(h.get_parameter_count(f)):    # parameters 0..15 are channels 1..16: on or off
            h.set_parameter_value(f, p, 1.0 if p == ch - 1 else 0.0)
        inst = add_drums() if voice == "drums" else add_surge("%s (Surge XT)" % voice.capitalize())
        chain.append((ch, f, inst))

    # Let the patchbay report its clients and ports.
    h.patchbay_refresh(False)
    for _ in range(40):
        h.engine_idle(); time.sleep(0.02)

    def group_of_plugin(pid):
        name = h.get_plugin_info(pid)["name"]
        return next((g for g, n in clients.items() if n == name), None)

    def port(group, want_input, kind):
        for g, pid, hints, name in ports:
            if g == group and bool(hints & PATCHBAY_PORT_IS_INPUT) == want_input and hints & kind:
                yield pid, name

    midi_in = next((g for g, n in clients.items() if n.lower() in ("midi input", "midi in")), None)
    audio_out = next((g for g, n in clients.items() if n.lower() in ("audio output", "audio out")), None)
    made = 0
    for ch, f, inst in chain:
        gf, gi = group_of_plugin(f), group_of_plugin(inst)
        if midi_in is not None and gf is not None:
            for (po, _), (pi, _) in zip(port(midi_in, False, PATCHBAY_PORT_TYPE_MIDI), port(gf, True, PATCHBAY_PORT_TYPE_MIDI)):
                made += bool(h.patchbay_connect(False, midi_in, po, gf, pi))
        if gf is not None and gi is not None:
            for (po, _), (pi, _) in zip(port(gf, False, PATCHBAY_PORT_TYPE_MIDI), port(gi, True, PATCHBAY_PORT_TYPE_MIDI)):
                made += bool(h.patchbay_connect(False, gf, po, gi, pi))
        if gi is not None and audio_out is not None:
            outs, ins = list(port(gi, False, PATCHBAY_PORT_TYPE_AUDIO)), list(port(audio_out, True, PATCHBAY_PORT_TYPE_AUDIO))
            for k, (po, _) in enumerate(outs[:2]):    # the first stereo pair, L→L, R→R (mono to both)
                for pi, _ in (ins[k:k + 1] if len(outs) > 1 else ins[:2]):
                    made += bool(h.patchbay_connect(False, gi, po, audio_out, pi))
    for _ in range(10):
        h.engine_idle(); time.sleep(0.02)

    if not h.save_project(a.out):
        sys.exit("Couldn't save %s: %s" % (a.out, h.get_last_error()))
    h.engine_close()
    print("Saved %s: %d instruments, %d connections." % (a.out, len(chain), made))
    print("Open it in Carla, pick a patch in each Surge XT, save; connect Midi Through to Carla's MIDI input;")
    print("in Twirl: Everything → Sound and room → Out: MIDI · Midi Through Port-0.")


if __name__ == "__main__":
    main()
