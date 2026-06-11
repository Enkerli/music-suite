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
