/**
 * Copied from enkerli-juce/web/enkerli-bridge.js (source of truth) —
 * keep in sync when the bridge contract changes.
 *
 * enkerli-bridge.js — one UI codebase, three environments (CONVENTIONS F7):
 *
 *   - JUCE WebView (plugin): window.__JUCE__ native integration
 *   - Chromium browser:      real WebMIDI for output
 *   - WebKit browser:        no MIDI — UI still fully works (progressive
 *                            enhancement; file export and WebAudio remain)
 *
 * Contract with the C++ side (EnkerliWebView.h):
 *   send(id, payload)  → C++ withEventListener(id, …)
 *   on(id, cb)         ← C++ emitEventIfBrowserIsVisible(id, …)
 */

const HAS_JUCE = typeof window !== "undefined"
  && typeof window.__JUCE__ !== "undefined"
  && !!window.__JUCE__.backend;

export function createBridge() {
  const listeners = new Map();

  const bridge = {
    /** "juce" | "webmidi" | "none" — for capability-aware UI. */
    kind: HAS_JUCE ? "juce" : "none",

    send(id, payload) {
      if (HAS_JUCE) window.__JUCE__.backend.emitEvent(id, payload ?? {});
    },

    on(id, callback) {
      if (!listeners.has(id)) {
        listeners.set(id, new Set());
        if (HAS_JUCE) {
          window.__JUCE__.backend.addEventListener(id, (data) => {
            for (const cb of listeners.get(id)) cb(data);
          });
        }
      }
      listeners.get(id).add(callback);
      return () => listeners.get(id)?.delete(callback);
    },

    /**
     * MIDI clip output. In the plugin, the C++ MidiClipScheduler plays it
     * host-synced; in Chromium, a best-effort WebMIDI fallback could be
     * layered on by the app; elsewhere it reports false.
     * notes: [{ startBeat, lengthBeats, pitch, velocity, channel }]
     */
    setClip(notes, lengthBeats, { loop = true } = {}) {
      if (!HAS_JUCE) return false;
      bridge.send("enkerliSetClip", { notes, lengthBeats, loop });
      return true;
    },

    clearClip() {
      if (HAS_JUCE) bridge.send("enkerliClearClip", {});
    },

    /**
     * Incoming MIDI notes (chord input): the editor emits "midiNotes"
     * batches { notes: [{ note, velocity, on }] }. See chordInput.js.
     */
    onMidiNotes(callback) {
      return bridge.on("midiNotes", (data) => callback(data?.notes ?? []));
    },

    /**
     * Save bytes through native UI (enkerli::exportBytes — FileChooser on
     * desktop, share sheet on iPadOS). Returns false outside the plugin so
     * callers can fall back to a browser download. NEVER use blob:/data:
     * anchor downloads in the plugin: WKWebView has no download manager
     * under the juce:// scheme and kills the page ("Frame load
     * interrupted"). bytes: Uint8Array.
     */
    saveFile(filename, bytes) {
      if (!HAS_JUCE) return false;
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      }
      bridge.send("enkerliSaveFile", { name: filename, b64: btoa(bin) });
      return true;
    },

    /** Tell C++ the page is alive; C++ answers with initial state. */
    ready() {
      if (HAS_JUCE) bridge.send("uiReady", {});
    },
  };

  if (!HAS_JUCE && typeof navigator !== "undefined" && navigator.requestMIDIAccess) {
    bridge.kind = "webmidi";
  }

  return bridge;
}
