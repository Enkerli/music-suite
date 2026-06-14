/**
 * Adapted from enkerli-juce/web/enkerli-bridge.js (source of truth) —
 * keep in sync when the bridge contract changes. TS port for MIDIcurator.
 *
 * One UI codebase, plugin and browser (CONVENTIONS F7):
 *   - JUCE WebView (plugin): window.__JUCE__ native integration
 *   - browser: no bridge — IndexedDB, blob downloads and <input type=file>
 *     keep working exactly as before.
 *
 * Contract with the C++ side (midicurator-plugin PluginEditor.h):
 *   send(id, payload)  → C++ withEventListener(id, …)
 *   on(id, cb)         ← C++ emitEventIfBrowserIsVisible(id, …)
 */

interface JuceBackend {
  emitEvent(id: string, payload: unknown): void;
  addEventListener(id: string, cb: (data: unknown) => void): void;
}

declare global {
  interface Window {
    __JUCE__?: { backend?: JuceBackend };
  }
}

const backend: JuceBackend | null =
  (typeof window !== "undefined" && window.__JUCE__?.backend) || null;

/** True when running inside the JUCE plugin WebView. */
export const IN_PLUGIN = backend !== null;

/**
 * True for the embedded plugin/standalone bundle (set at build time by the
 * plugin's WebUI/build.mjs via __PLUGIN_BUILD__). Unlike IN_PLUGIN, this is
 * deterministic — it doesn't depend on __JUCE__ being injected before
 * module-eval (which the standalone delays). Use it to hide desktop-webapp-
 * only features (sample loader, Apple Loops DB) that fetch co-located
 * assets the WebView's resource scheme can't serve.
 */
export const IS_PLUGIN_BUILD =
  typeof __PLUGIN_BUILD__ !== "undefined" && __PLUGIN_BUILD__ === true;

/**
 * True only when co-located assets can actually be fetched — a real
 * http(s) origin and not the plugin. Features that `fetch('/samples/…')`
 * (sample progressions, the loop DB) must gate on this: a JUCE WebView
 * serves from a custom scheme with no such server, so those fetches 404
 * (seen in the iPadOS standalone). Belt-and-suspenders over IN_PLUGIN in
 * case the bridge hasn't injected `__JUCE__` by module-eval time.
 */
export const CAN_FETCH_ASSETS =
  typeof window !== "undefined" &&
  // any JUCE WebView injects __JUCE__ (the object exists even before its
  // backend handshake completes — so this catches the standalone where
  // backend is null at module-eval and IN_PLUGIN reads false)
  typeof (window as { __JUCE__?: unknown }).__JUCE__ === "undefined" &&
  typeof location !== "undefined" &&
  /^https?:$/i.test(location.protocol);

export interface HostClipNote {
  startBeat: number;
  lengthBeats: number;
  pitch: number;
  velocity: number;
  channel: number;
}

type Listener = (data: unknown) => void;
const listeners = new Map<string, Set<Listener>>();

function send(id: string, payload?: unknown): void {
  backend?.emitEvent(id, payload ?? {});
}

function on(id: string, callback: Listener): () => void {
  if (!listeners.has(id)) {
    listeners.set(id, new Set());
    backend?.addEventListener(id, (data) => {
      for (const cb of listeners.get(id)!) cb(data);
    });
  }
  listeners.get(id)!.add(callback);
  return () => {
    listeners.get(id)?.delete(callback);
  };
}

export const bridge = {
  send,
  on,

  /**
   * Save bytes through native UI (enkerli::exportBytes — FileChooser on
   * desktop, share sheet on iPadOS). Returns false outside the plugin so
   * callers can fall back to a browser download. NEVER use blob:/data:
   * anchor downloads in the plugin: WKWebView has no download manager
   * under the juce:// scheme and kills the page ("Frame load interrupted").
   */
  saveFile(filename: string, bytes: Uint8Array): boolean {
    if (!backend) return false;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
    }
    send("enkerliSaveFile", { name: filename, b64: btoa(bin) });
    return true;
  },

  /**
   * Open a file through native UI (enkerli::importFile). The chosen file
   * arrives via on("fileOpened", ({ name, b64 }) => …); nothing fires on
   * cancel. Returns false outside the plugin.
   */
  openFile(patterns = "*"): boolean {
    if (!backend) return false;
    send("enkerliOpenFile", { patterns });
    return true;
  },

  /** Host-synced clip playback via the C++ MidiClipScheduler. */
  setClip(notes: HostClipNote[], lengthBeats: number, loop = true): boolean {
    if (!backend) return false;
    send("enkerliSetClip", { notes, lengthBeats, loop });
    return true;
  },

  clearClip(): void {
    send("enkerliClearClip");
  },

  /** Tell C++ the page is alive; C++ answers with initial state. */
  ready(): void {
    send("uiReady");
  },
};

/** Decode a bridge base64 payload into bytes. */
export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
