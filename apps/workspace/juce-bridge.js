// juce-bridge.js — wires the Suite Workspace to JUCE's WebBrowserComponent
// (docs/WORKSPACE_PLUGIN.md §3). Same shape as Serpe's bridge: outside JUCE
// every emit is a no-op, so the identical bundle runs in a browser tab and
// inside the workspace-plugin WebView.
//
//   JS → C++ : window.__JUCE__.backend.emitEvent(id, payload)
//   C++ → JS : backend.addEventListener(id, cb)

export function juceAvailable() {
  return typeof window !== "undefined" &&
         typeof window.__JUCE__ !== "undefined" && !!window.__JUCE__.backend;
}

export function juceEmit(eventId, data) {
  if (juceAvailable()) window.__JUCE__.backend.emitEvent(eventId, data ?? {});
}

// One real backend subscription per event id, fanned out to any number of JS
// callbacks (a module can be torn down and rebuilt — e.g. a bento resize —
// and each instance calling juceOn("fileOpened", …) must not stack duplicate
// backend listeners). Returns an unsubscribe function; the backend
// subscription itself is never removed (JUCE's bridge has no removeListener),
// it just stops reaching JS callbacks once every one has unsubscribed.
const juceListeners = new Map(); // eventId -> Set<cb>
export function juceOn(eventId, cb) {
  if (!juceAvailable()) return () => {};
  if (!juceListeners.has(eventId)) {
    juceListeners.set(eventId, new Set());
    window.__JUCE__.backend.addEventListener(eventId, (data) => {
      for (const fn of juceListeners.get(eventId)) fn(data);
    });
  }
  juceListeners.get(eventId).add(cb);
  return () => { juceListeners.get(eventId)?.delete(cb); };
}

// Mirror console to C++ stderr (the only way to see JS logs in WKWebView).
if (typeof window !== "undefined" && !window.__wsLogPatched && juceAvailable()) {
  window.__wsLogPatched = true;
  for (const level of ["log", "warn", "error"]) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      try {
        const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
        juceEmit("log", { level, msg });
      } catch { /* never let logging throw */ }
    };
  }
}

/** A bus `note` message crossing to the plugin's MIDI out. */
export function sendNoteOut(body) {
  juceEmit("noteOut", {
    notes: body.notes ?? [],
    velocity: body.velocity ?? 96,
    durationMs: body.durationMs ?? 250,
    ...(body.channel !== undefined && { channel: body.channel }),
  });
}

/** Stop everything sounding (explicit offs + CC123 on the C++ side). */
export function sendAllOff() { juceEmit("allOff", {}); }

/** Mirror the workspace state JSON into the DAW session. */
export function sendState(json) { juceEmit("enkerliState", { json }); }

/**
 * Native save for downloads — blob: anchors kill the page under the juce://
 * scheme (enkerli-juce TESTING.md), so bytes go over the bridge instead
 * (FileChooser on desktop, share sheet on iPadOS). Returns false outside
 * the plugin so callers fall back to a browser download.
 */
export function saveFileNative(filename, bytes) {
  if (!juceAvailable()) return false;
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  juceEmit("enkerliSaveFile", { name: filename, b64: btoa(bin) });
  return true;
}

/**
 * Native open, the counterpart of saveFileNative — <input type="file"> is as
 * unreliable under WKWebView as blob downloads are (enkerli-juce
 * FileImport.h). Triggers the native picker (FileChooser on desktop,
 * UIDocumentPickerViewController on iPadOS); the chosen file arrives via a
 * "fileOpened" event ({name, b64}) — nothing fires on cancel. Returns false
 * outside the plugin so callers fall back to a browser <input type="file">.
 */
export function openFileNative(patterns = "*") {
  if (!juceAvailable()) return false;
  juceEmit("enkerliOpenFile", { patterns });
  return true;
}

/** Decode a bridge base64 payload into bytes (the fileOpened event's b64). */
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
