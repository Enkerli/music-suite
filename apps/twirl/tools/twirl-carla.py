#!/usr/bin/env python3
"""
twirl-carla.py — build a Carla project that plays Twirl's MIDI with Surge XT.

Twirl (in a Chromium browser, Out: MIDI) sends one MIDI channel per voice:

    channel 1   pluck   (drawn to the right)
    channel 2   bell    (drawn upward)
    channel 3   blip    (drawn to the left)
    channel 10  drums and shaker (drawn downward / scribbled), General MIDI
                notes: kick 36, snare 38, hat 42, shaker 70

This script asks Carla to build one instrument per voice, each behind a MIDI
channel filter, all fed from Midi Through, all to your speakers, and saves it
as a .carxp project you open in Carla:

    Midi Through ─┬─ Ch 1  → Surge XT (pluck) ─┐
                  ├─ Ch 2  → Surge XT (bell)  ─┤
                  ├─ Ch 3  → Surge XT (blip)  ─┼─ speakers
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
editor: double-click), and save. In Twirl choose
Everything → Sound and room → Out: MIDI · Midi Through Port-0.
If Midi Through or the speakers weren't found, the script says so; connect
them in Carla's patchbay (or qpwgraph) and save.

Public Domain (CC0-1.0), like the rest of the suite.
"""
import argparse, glob, os, sys, time

RES = "/usr/share/carla/resources"
LIB = "/usr/lib/carla/libcarla_standalone2.so"
sys.path.insert(0, RES)
try:
    from carla_backend import (CarlaHostDLL, EngineCallbackFunc,
        ENGINE_OPTION_PROCESS_MODE, ENGINE_PROCESS_MODE_PATCHBAY, ENGINE_PROCESS_MODE_MULTIPLE_CLIENTS, ENGINE_OPTION_TRANSPORT_MODE,
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


def jack_ports():
    """Every port in the JACK (or PipeWire-JACK) graph: name -> (is_input, "audio"|"midi")."""
    import ctypes
    j = ctypes.CDLL("libjack.so.0")
    j.jack_client_open.restype = ctypes.c_void_p
    j.jack_client_open.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.c_void_p]
    j.jack_get_ports.restype = ctypes.POINTER(ctypes.c_char_p)
    j.jack_get_ports.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_ulong]
    j.jack_port_by_name.restype = ctypes.c_void_p
    j.jack_port_by_name.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    j.jack_port_flags.argtypes = [ctypes.c_void_p]
    j.jack_port_type.restype = ctypes.c_char_p
    j.jack_port_type.argtypes = [ctypes.c_void_p]
    j.jack_free.argtypes = [ctypes.c_void_p]
    j.jack_client_close.argtypes = [ctypes.c_void_p]
    c = j.jack_client_open(b"twirl-scan", 1, None)          # 1: don't start a server
    if not c:
        return {}
    out, arr = {}, j.jack_get_ports(c, None, None, 0)
    k = 0
    while arr and arr[k]:
        name = arr[k]; p = j.jack_port_by_name(c, name)
        typ = (j.jack_port_type(p) or b"").decode()
        out[name.decode("utf-8", "replace")] = (bool(j.jack_port_flags(p) & 1), "midi" if "midi" in typ else "audio")
        k += 1
    if arr:
        j.jack_free(ctypes.cast(arr, ctypes.c_void_p))
    j.jack_client_close(c)
    return out


def write_connections(path, conns):
    """Put connections, by port name, into the project's <ExternalPatchbay> (as Carla saves them)."""
    from xml.sax.saxutils import escape
    s = open(path, encoding="utf-8").read()
    block = " <ExternalPatchbay>\n" + "".join(
        "  <Connection>\n   <Source>%s</Source>\n   <Target>%s</Target>\n  </Connection>\n" % (escape(a), escape(b))
        for a, b in conns) + " </ExternalPatchbay>\n"
    import re
    if "<ExternalPatchbay>" in s:
        s = re.sub(r" ?<ExternalPatchbay>.*?</ExternalPatchbay>\n?", block, s, flags=re.S)
    else:
        s = s.replace("</CARLA-PROJECT>", block + "</CARLA-PROJECT>")
    open(path, "w", encoding="utf-8").write(s)


def main():
    ap = argparse.ArgumentParser(description="Build a Carla project for Twirl's MIDI voices.")
    ap.add_argument("--out", default=os.path.expanduser("~/twirl-surge.carxp"))
    ap.add_argument("--surge", help="path to Surge XT.vst3 (found automatically otherwise)")
    ap.add_argument("--drums", default="auto", help='"auto" (a GM soundfont if found), "surge", or a path to an .sf2')
    ap.add_argument("--mode", default="multi", choices=["multi", "patchbay"],
                    help='Carla\'s process mode: "multi" (each plugin its own JACK client, Carla\'s default on JACK; '
                         'connections in the system graph, including Midi Through and your speakers) or "patchbay" (one client)')
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
    multi = a.mode == "multi"
    h.set_engine_option(ENGINE_OPTION_PROCESS_MODE, ENGINE_PROCESS_MODE_MULTIPLE_CLIENTS if multi else ENGINE_PROCESS_MODE_PATCHBAY, "")
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

    made = 0
    if multi:
        # Connections by NAME, written into the project, which Carla restores when
        # it opens it. (Asking Carla to connect by id failed on a busy PipeWire
        # graph on Alex's machine, 2026-10-25: "thisPort.group > 0", 2 of 16 made.
        # Projects saved by hand, connected by name, open wired every time.)
        for _ in range(30):
            h.engine_idle(); time.sleep(0.02)
        jp = jack_ports()
        names = [h.get_plugin_info(i)["name"] for i in range(h.get_current_plugin_count())]
        def mine(client, want_input, kind):
            return [n for n, (inp, k) in jp.items() if n.split(":", 1)[0] == client and inp == want_input and k == kind]
        src = next((n for n, (inp, k) in jp.items() if not inp and k == "midi" and "midi through" in n.lower()), None)
        plugin_clients = set(names)
        cards = sorted({n.split(":", 1)[0] for n, (inp, k) in jp.items() if inp and k == "audio" and "playback" in n.lower()
                        and n.split(":", 1)[0] not in plugin_clients})
        card = "system" if "system" in cards else (cards[0] if cards else None)
        play = sorted(mine(card, True, "audio"))[:2] if card else []
        conns = []
        for ch, f, inst in chain:
            fn, inn = h.get_plugin_info(f)["name"], h.get_plugin_info(inst)["name"]
            fin, fout = mine(fn, True, "midi"), mine(fn, False, "midi")
            iin, iout = mine(inn, True, "midi"), sorted(mine(inn, False, "audio"))
            if src and fin: conns.append((src, fin[0]))
            if fout and iin: conns.append((fout[0], iin[0]))
            if play and iout:
                if len(iout) >= 2: conns += [(iout[0], play[0]), (iout[1], play[-1])]
                else: conns += [(iout[0], p) for p in play]
        made = len(conns)
        if src is None:
            print("Midi Through wasn't found: connect it to the four 'Ch …' filters' inputs in Carla's patchbay (or qpwgraph), then save.")
        if not play:
            print("No sound card playback ports were found: connect the instruments' outputs to your speakers in Carla, then save.")
    else:
        # One Carla client, its own internal patchbay (connections by id inside Carla).
        h.patchbay_refresh(False)
        for _ in range(50):
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
                for k, (po, _) in enumerate(outs[:2]):
                    for pi, _ in (ins[k:k + 1] if len(outs) > 1 else ins[:2]):
                        made += bool(h.patchbay_connect(False, gi, po, audio_out, pi))
        for _ in range(20):
            h.engine_idle(); time.sleep(0.02)

    if not h.save_project(a.out):
        sys.exit("Couldn't save %s: %s" % (a.out, h.get_last_error()))
    h.engine_close()
    if multi:
        write_connections(a.out, conns)
    print("Saved %s: %d instruments, %d connections." % (a.out, len(chain), made))
    print("Open it in Carla, pick a patch in each Surge XT, and save.")
    print("in Twirl: Everything → Sound and room → Out: MIDI · Midi Through Port-0.")


if __name__ == "__main__":
    main()
