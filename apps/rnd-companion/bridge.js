/**
 * The RND-specific half of the suite bridge.
 *
 * In the plugin, everything goes over __JUCE__ to the C++ that owns the port.
 * In a Chromium tab it opens the RND itself over Web MIDI with sysex, so the
 * same UI works without a plugin host — the progressive-enhancement rule
 * (CONVENTIONS F7). Elsewhere it degrades to a viewer.
 */
import {
  applyMessage, decodeSysex, emptyStatus, encodeSeed, encodeUnlockAndDump,
  scaleCcValue, rootNoteNumber, CC, MIX_CHANNELS,
} from "@enkerli/rnd";

const HAS_JUCE = typeof window !== "undefined" && !!window.__JUCE__?.backend;

export function createRndBridge() {
  const listeners = new Map();
  const emit = (id, payload) => { for (const cb of listeners.get(id) ?? []) cb(payload); };

  const bridge = {
    kind: HAS_JUCE ? "juce" : (navigator.requestMIDIAccess ? "webmidi" : "none"),

    on(id, cb) {
      if (!listeners.has(id)) {
        listeners.set(id, new Set());
        if (HAS_JUCE) window.__JUCE__.backend.addEventListener(id, (d) => emit(id, d));
      }
      listeners.get(id).add(cb);
      return () => listeners.get(id)?.delete(cb);
    },

    send(id, payload = {}) {
      if (HAS_JUCE) { window.__JUCE__.backend.emitEvent(id, payload); return; }
      web.handle(id, payload);
    },
  };

  // ── Web MIDI fallback ────────────────────────────────────────────────────
  const web = (() => {
    let access = null, input = null, output = null;
    let status = emptyStatus();

    const looksLikeRnd = (p) => /RND/i.test(p.name ?? "");
    const sysex = (bytes) => output?.send(Uint8Array.from(bytes));
    const cc = (channel, controller, value) =>
      output?.send([0xb0 | (channel - 1), controller & 0x7f, value & 0x7f]);

    function ports() {
      const list = (m) => [...(m?.values() ?? [])].map((p) => ({ id: p.id, name: p.name }));
      emit("ports", {
        inputs: list(access?.inputs), outputs: list(access?.outputs),
        selectedIn: input?.id ?? null, selectedOut: output?.id ?? null,
        connected: Boolean(input && output), outputName: output?.name ?? null,
      });
    }

    function bind() {
      if (input) input.onmidimessage = null;
      input = [...access.inputs.values()].find(looksLikeRnd) ?? null;
      output = [...access.outputs.values()].find(looksLikeRnd) ?? null;
      if (input) input.onmidimessage = (ev) => {
        const message = decodeSysex(ev.data);
        if (!message) return;
        status = applyMessage(status, message);
        emit("status", status);
      };
      ports();
    }

    return {
      async handle(id, p) {
        switch (id) {
          case "uiReady":
            emit("log", "Browser mode: Web MIDI with SysEx (Chromium only).");
            ports();
            return;

          case "findDevice":
            if (!navigator.requestMIDIAccess) { emit("log", "Web MIDI unavailable — use Chromium."); return; }
            access = await navigator.requestMIDIAccess({ sysex: true });
            access.onstatechange = bind;
            bind();
            return;

          case "sendSeed":   sysex(encodeSeed(p.seed)); emit("log", `Sent 0x${(p.seed >>> 0).toString(16)}`); return;
          case "readDevice": sysex(encodeUnlockAndDump()); return;
          case "sendScale":  cc(1, CC.scale, scaleCcValue(p.index)); return;
          case "sendRoot": {
            const note = rootNoteNumber(p.pitchClass);
            output?.send([0x90, note, 100]);
            output?.send([0x80, note, 0], performance.now() + 100);
            return;
          }
          case "sendVolume": for (const ch of MIX_CHANNELS) cc(ch, CC.volume, p.value); return;
          case "sendReverb": for (const ch of MIX_CHANNELS) cc(ch, CC.reverb, p.value); return;

          default:
            // Library actions need storage the browser build does not own yet.
            emit("log", `${id} is handled by the plugin, not the browser build.`);
        }
      },
    };
  })();

  return bridge;
}
