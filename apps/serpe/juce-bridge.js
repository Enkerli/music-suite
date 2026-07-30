// juce-bridge.js — wires the Serpe React UI to JUCE's WebBrowserComponent.
//
// JUCE 8 bridge:
//   C++ → JS:  backend.addEventListener("eventId", cb)
//   JS → C++:  backend.emitEvent("eventId", data)
//
// Outside JUCE (browser / web app) every juceEmit() is a no-op, so the same UI
// runs standalone. Parameters are relayed in their ACTUAL domain; the C++ side
// normalises (convertTo0to1), so this file needs no parameter-range knowledge.

export function juceAvailable() {
  return typeof window !== 'undefined' &&
         typeof window.__JUCE__ !== 'undefined' && !!window.__JUCE__.backend;
}

function juceEmit(eventId, data) {
  if (juceAvailable()) window.__JUCE__.backend.emitEvent(eventId, data);
}

function juceOn(eventId, cb) {
  if (juceAvailable()) window.__JUCE__.backend.addEventListener(eventId, cb);
}

// Mirror console to C++ stderr (the only way to see JS logs in WKWebView).
if (typeof window !== 'undefined' && !window.__serpeLogPatched && juceAvailable()) {
  window.__serpeLogPatched = true;
  for (const level of ['log', 'warn', 'error']) {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      orig(...args);
      try {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        juceEmit('log', { level, msg });
      } catch {}
    };
  }
}

// ── Serpe APVTS params the UI drives (actual-domain) ──────────────────────────
// reactField → paramId. Values flow both ways in actual units; the snapshot from
// C++ carries the same fields. Params the plugin doesn't have yet (swing, MIDI
// channel) are UI-local until the C++ side adds them (feature-pairing pass).
export const PARAM_MAP = [
  ['tempo',        'bpm'],
  ['accentVel',    'accentVelocity'],
  ['unaccentVel',  'unaccentedVelocity'],
  ['accentPitch',  'accentPitchOffset'],
  ['midiNote',     'midiNote'],
  ['subdivision',  'subdivision'],
  ['hostTransport','useHostTransport'],
  // Poly lanes (docs/SERPE_POLY.md §8 milestone 3): 6 fixed lane slots +
  // the base lag, always declared on the C++ side. reactField === paramId
  // here, so these entries are really just documentation — sendParamActual
  // already falls back to the field name when PARAM_MAP has no entry — but
  // listing them keeps this file the one place that names every bridged param.
  ['polyLagMs', 'polyLagMs'],
  ['polyLock', 'polyLock'],
  ...[0, 1, 2, 3, 4, 5].flatMap(i => [
    [`laneNote${i}`,    `laneNote${i}`],
    [`laneChannel${i}`, `laneChannel${i}`],
    [`laneMute${i}`,    `laneMute${i}`],
  ]),
];

// ── Initialisers / senders ────────────────────────────────────────────────────

export function initJuceBridge(onEvent) {
  juceOn('stateSnapshot', snap => onEvent({ type: 'stateSnapshot', snap }));
  juceOn('paramChange',   ({ id, value }) => onEvent({ type: 'paramChange', id, value }));
  juceOn('transport',     t => onEvent({ type: 'transport', ...t }));
  juceOn('engineState',   s => onEvent({ type: 'engineState', ...s }));  // C++ is authoritative
  // Per-lane poly state: playheads, and each lane's actual pattern + scene
  // position. This subscription was MISSING — the C++ emitted polyState and
  // main.jsx handled it, but nothing joined them, so every poly lane event has
  // been dropped since the feature was added. The visible symptoms were a lane
  // panel frozen on the first scene and per-lane playheads that never moved
  // (Alex, 2026-07-29; found by logging the C++ side and seeing correct pushes
  // arrive nowhere).
  juceOn('polyState',     p => onEvent({ type: 'polyState', ...p }));
  juceEmit('uiReady', {});
}

/** Send a parameter change in its actual domain; C++ normalises and notifies host. */
export function sendParamActual(field, value) {
  const entry = PARAM_MAP.find(([f]) => f === field);
  const id = entry ? entry[1] : field;
  juceEmit('setParamActual', { id, value });
}

/** Send the current pattern as UPI text — C++ parses it with the authoritative
 *  UPIParser (the engine of record for playback/MIDI). Accept the full string
 *  including any {accent} prefix. Raw transforms pass their binary string, which
 *  UPIParser also parses. */
export function sendUPI(text) {
  juceEmit('setUPI', { text: text || '' });
}

/** Standalone transport: start/stop the plugin's internal sequencer. */
export function sendPlaying(playing) { juceEmit('setPlaying', { playing: !!playing }); }
/** Standalone manual tempo. */
export function sendBPM(bpm) { juceEmit('setBPM', { bpm }); }
/** Edit a step by tapping it (toggle onset / toggle its accent). */
export function sendToggleStep(step)   { juceEmit('toggleStep',   { step }); }
export function sendToggleAccent(step) { juceEmit('toggleAccent', { step }); }
