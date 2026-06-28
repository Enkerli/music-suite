// juce-bridge.js — wires React state to JUCE's WebBrowserComponent.
//
// JUCE 8 bridge:
//   C++ → JS:  backend.addEventListener("eventId", cb)
//   JS → C++:  backend.emitEvent("eventId", data)
//
// When running outside JUCE (browser / webapp), all juceEmit() calls are no-ops.

function juceEmit(eventId, data) {
  if (typeof window.__JUCE__ !== 'undefined' && window.__JUCE__.backend)
    window.__JUCE__.backend.emitEvent(eventId, data);
}

function juceOn(eventId, cb) {
  if (typeof window.__JUCE__ !== 'undefined' && window.__JUCE__.backend)
    window.__JUCE__.backend.addEventListener(eventId, cb);
}

// Mirror console to C++ stderr (the only way to see JS logs in WKWebView).
if (typeof window !== 'undefined' && !window.__juceLogPatched) {
  window.__juceLogPatched = true;
  for (const level of ['log', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      try {
        const msg = args.map(a =>
          a == null ? String(a) :
          typeof a === 'object' ? ((() => { try { return JSON.stringify(a); } catch { return String(a); } })()) :
          String(a)
        ).join(' ');
        juceEmit('log', { level, msg });
      } catch {}
    };
  }
}

// ── PARAM_MAP — all PitchFold APVTS params ────────────────────────────────────
// [reactField, paramId, rawToReact, reactToRaw]
// rawToReact: JUCE delivers ACTUAL values (not 0-1 normalised)
// reactToRaw: normalise 0-1 for setValueNotifyingHost

export const PARAM_MAP = [
  ['pcsRoot',        'pcsRoot',       v => Math.round(v),      v => v / 11],
  ['pcsMask',        'pcsMask',       v => Math.round(v),      v => v / 4095],
  ['quantDir',       'quantDir',      v => Math.round(v),      v => v / 3],  // 0-3
  ['quantStrength',  'quantStrength', v => v,                  v => v],
  ['outputLo',       'outputLo',      v => Math.round(v),      v => v / 127],
  ['outputHi',       'outputHi',      v => Math.round(v),      v => v / 127],
  ['useFlats',       'useFlats',      v => v > 0.5,            v => v ? 1.0 : 0.0],
  ['timeGrid',       'timeGrid',      v => Math.round(v),      v => v / 7],
  ['timeStrength',   'timeStrength',  v => v,                  v => v],
  ['humanizeTime',   'humanizeTime',  v => v,                  v => v / 200],
  ['humanizeVel',    'humanizeVel',   v => v,                  v => v],
  ['swing',          'swing',         v => v,                  v => v],
  ['lookAheadMs',    'lookAheadMs',   v => v,                  v => v / 500],
  ['voiceMode',      'voiceMode',     v => Math.round(v),      v => v / 4],
  ['monoSelect',     'monoSelect',    v => Math.round(v),      v => v / 3],
  ['splitVoices',    'splitVoices',   v => Math.round(v),      v => (v - 1) / 3],
  ['splitChannel',   'splitChannel',  v => Math.round(v),      v => (v - 1) / 15],
];

// ── Initialisers ──────────────────────────────────────────────────────────────

export function initJuceBridge(onEvent) {
  juceOn('stateSnapshot', snap => onEvent({ type: 'stateSnapshot', snap }));
  juceOn('paramChange',   ({ id, value }) => onEvent({ type: 'paramChange', id, value }));
  juceEmit('uiReady', {});
}

// ── Senders ───────────────────────────────────────────────────────────────────

export function sendParam(field, value) {
  const entry = PARAM_MAP.find(([f]) => f === field);
  if (!entry) return;
  const [, paramId, , toRaw] = entry;
  juceEmit('setParam', { id: paramId, value: toRaw(value) });
}

export function sendParamActual(paramId, value) {
  juceEmit('setParamActual', { id: paramId, value });
}

export function sendSelectPad(pad)  { juceEmit('selectPad', { pad }); }
export function sendPanic()         { juceEmit('panic', {}); }

export function sendPadData(pad, mask, root, label) {
  juceEmit('setPadData', { pad, mask, root, label });
}
