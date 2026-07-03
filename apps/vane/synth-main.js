// synth-main.js — Vane standalone synth host. Loaded ONLY when there's no JUCE
// host (the index.html bootstrap injects it when window.__JUCE__ is absent), so
// the plugin is untouched. It boots a Web Audio AudioWorklet running the WASM
// voice (synth/worklet.js + vane-dsp.wasm) and drives it from Web MIDI via
// @enkerli/webmidi, including MPE expression: pitch-bend = X, CC74 = Y/slide,
// channel pressure = Z. Audio starts on the first user gesture (autoplay policy).
//
// Vane has NO flat amp envelope — the audible dynamics are whatever the mod
// matrix routes to VCA, and the real factory routing is Breath/Expression/
// Pressure -> VCA (velocity contributes nothing by default: VelVCA = 0). So
// this host forwards CC2 (Breath) and CC11 (Expression) — Vane's own default
// macro bindings (index.html's state.cc) — to the WASM voice via vane_set_cc,
// not just note/MPE. Mono mode (real legato/portamento) follows the page's own
// Mono/Poly toggle through the same Bridge.send('setParam',...) channel used
// for every other knob.
import { connect } from '@enkerli/webmidi';

const BASE = new URL('.', import.meta.url).href; // dir of synth.js → worklet/wasm URLs
let ctx = null, node = null, midi = null, audioStarted = false;
let activeNotes = 0;
const expr = {}; // channel → { bend, slide, pressure }

// Vane param id (index.html RANGE keys) → this voice's wasm param id. Values
// arrive already in real units (Hz, 0..1, ms, …) — same units the page itself
// uses — so no conversion needed; a param with different units than the wasm
// expects would need a mapping function here. monoMode is handled separately
// below (it's a 0/1 toggle, not a RANGE-table slider).
const PARAM_MAP = { Cutoff: 1, Reso: 2, Output: 8, VelVCA: 9, Glide: 10,
                    Morph: 12, PW: 13, Inharm: 14, Sync: 15 };

function post(m) { if (node) node.port.postMessage(m); }

// Feed the UI's REAL-data meters (Breath/Expression/Pressure/Slide/Pitchbend/
// Velocity) from the live performance, via the hook index.html exposes when
// standalone (see the `if (!HAS_JUCE)` block near state.sim). No-ops until that
// hook exists (e.g. build skew) or once the plugin is hosting (HAS_JUCE true).
function pushMeters(partial) {
  const api = window.__vaneStandalone;
  if (api) api.setMeters(partial);
}

function sendExpr(ch) {
  const e = expr[ch] || {};
  // MPE slide (Y/CC74) is CENTRED: 0.5 = neutral. An unset slide must send 0.5,
  // not 0 — otherwise the first bend/pressure event on a channel that hasn't
  // sent CC74 yet slams the Slide→Cutoff route to full-down (~-4.5 octaves).
  const slide = e.slide == null ? 0.5 : e.slide;
  post({ type: 'expr', channel: ch, bend: e.bend || 0, slide, pressure: e.pressure || 0 });
  // Pitchbend meter is bipolar (-1..1) drawn on a 0..1 fill, centred at 0.5 —
  // matches the page's own init value (Pitchbend:0.5) for the same reason.
  pushMeters({ Pressure: e.pressure || 0, Slide: slide, Pitchbend: 0.5 + (e.bend || 0) / 2 });
}

function sendParam(id, value) {
  if (id === 'monoMode') { post({ type: 'mono', value: value > 0.5 }); return; }
  const wasmId = PARAM_MAP[id];
  if (wasmId != null) post({ type: 'param', id: wasmId, value });
}

// ── Internal tuning (standalone) ──────────────────────────────────────────────
// MTS-ESP cannot work in web code — libMTSClient dlopens a system dylib and
// talks over shared memory, neither of which exists in a browser. The wasm
// compiles the REAL TuningClient (internal tunings, hole-snapping, live retune)
// so the standalone uses internal tunings instead, and defaults to Internal so
// the tuning chip shows a real state rather than an MTS warning.
const TUN_ORDER = ['edo12', 'just', 'pyth', 'meanqc', 'werck3', 'diat7', 'edo19', 'bp'];
const TUN_NAMES = {
  edo12: '12-tone Equal', just: 'Just Intonation', pyth: 'Pythagorean',
  meanqc: 'Quarter-comma Meantone', werck3: 'Werckmeister III',
  diat7: 'Just Diatonic', edo19: '19-tone Equal', bp: 'Bohlen-Pierce',
};
const tuning = { source: 'internal', internal: 'edo12' };
function pushTuningStatus() {
  const api = window.__vaneStandalone;
  if (!api || !api.emit) return;
  api.emit('tuningStatus', {
    connected: false,                       // MTS is structurally absent in web
    source: tuning.source,
    internalId: tuning.internal,
    name: tuning.source === 'internal' ? (TUN_NAMES[tuning.internal] || '') : '',
  });
}
function sendTuningToSynth() {
  post({ type: 'tuningSource', value: tuning.source === 'internal' ? 1 : tuning.source === 'off' ? 2 : 0 });
  const idx = TUN_ORDER.indexOf(tuning.internal);
  if (idx >= 0) post({ type: 'internalTuning', value: idx });
}

// The factory mod-matrix routing (PluginProcessor.cpp kFactory[], mirrored in
// the wasm's resetSlotsToFactory). Pushed into the page at boot so the Matrix
// tab shows the routing that's actually sounding — the page's own defaults are
// all-Off, which was true of nothing. Slot 9 (Velocity→Cutoff) is off by
// default standalone (the "Vel→brightness" checkbox toggles it).
const FACTORY_SLOTS = [
  { src: 1, dst: 0, amt: 1.00, curve: 0, on: true  },   // Breath     → VCA
  { src: 2, dst: 0, amt: 1.00, curve: 0, on: true  },   // Expression → VCA
  { src: 3, dst: 0, amt: 0.50, curve: 0, on: true  },   // Pressure   → VCA
  { src: 4, dst: 1, amt: 0.90, curve: 0, on: true  },   // Slide      → Cutoff
  { src: 1, dst: 1, amt: 0.25, curve: 1, on: true  },   // Breath     → Cutoff (exp)
  { src: 2, dst: 1, amt: 0.25, curve: 1, on: true  },   // Expression → Cutoff (exp)
  { src: 3, dst: 1, amt: 0.20, curve: 1, on: true  },   // Pressure   → Cutoff (exp)
  { src: 1, dst: 2, amt: 0.15, curve: 1, on: true  },   // Breath     → Reso (exp)
  { src: 2, dst: 2, amt: 0.15, curve: 1, on: true  },   // Expression → Reso (exp)
  { src: 6, dst: 1, amt: 0.15, curve: 0, on: false },   // Velocity   → Cutoff (the toggle)
];
function pushSlotState() {
  const api = window.__vaneStandalone;
  if (api && api.emit) api.emit('slotState', { slots: FACTORY_SLOTS });
}

// Non-param bridge sends the standalone synth implements (the page's Tuning
// stage and Matrix tab send these; in the plugin they go to C++).
function handleSend(id, p) {
  if (id === 'setTuningSource') {
    tuning.source = (p && p.source) || 'internal';
    sendTuningToSynth(); pushTuningStatus();
  } else if (id === 'setInternalTuning') {
    if (p && p.id && TUN_ORDER.includes(p.id)) { tuning.internal = p.id; }
    sendTuningToSynth(); pushTuningStatus();
  } else if (id === 'reconnectMts') {
    pushTuningStatus();                     // nothing to reconnect to — just re-assert state
  } else if (id === 'slotEdit' && p && typeof p.slot === 'number') {
    // Matrix tab slot edit → per-voice mod matrix in the wasm. Per-slot
    // atk/rel/anchors are accepted by the message but ignored by the synth
    // (slew rates derive from the source, matching the real engine).
    post({ type: 'slot', slot: p.slot, src: p.src | 0, dst: p.dst | 0,
           amt: +p.amt || 0, curve: p.curve | 0, on: p.on !== false });
  }
}

// Register as soon as the script loads (index.html's hook exists synchronously),
// so knob moves before audio even starts aren't lost — sendParam itself no-ops
// via post() until the worklet is ready, but the *latest* value per id is what
// matters and React-less state.patch already holds it for the boot-time sync.
if (window.__vaneStandalone) {
  window.__vaneStandalone.onParam = sendParam;
  window.__vaneStandalone.onSend = handleSend;
}

// Idempotent: builds the context/worklet/wasm once, and RETRIES resume on every
// call. Critical detail: a MIDI message is NOT a user gesture — if the first
// call comes from a note-in, the browser leaves the AudioContext 'suspended'.
// The old version latched a did-start flag and reported "audio ready" anyway,
// so a page reload where MIDI arrived before any click stayed SILENT forever
// (no later click could revive it). Now the status is honest, every user
// gesture retries, and onstatechange keeps the label in sync.
async function ensureAudio() {
  if (!audioStarted) {
    audioStarted = true;   // guards the one-time build only, not the resume
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.onstatechange = () => reportAudioState();
      await ctx.audioWorklet.addModule(BASE + 'worklet.js');
      node = new AudioWorkletNode(ctx, 'vane-voice', { numberOfInputs: 0, outputChannelCount: [2] });
      node.connect(ctx.destination);
      const bytes = await (await fetch(BASE + 'vane-dsp.wasm')).arrayBuffer();
      node.port.postMessage({ type: 'wasm', bytes });
      // Sync the synth to whatever the patch already shows (default or loaded
      // preset), so turning audio on doesn't silently revert to the voice's
      // built-in defaults.
      const patch = window.__vaneStandalone && window.__vaneStandalone.getPatch();
      if (patch) for (const id in PARAM_MAP) if (patch[id] != null) sendParam(id, patch[id]);
      if (window.__vaneStandalone) post({ type: 'mono', value: window.__vaneStandalone.getMono() });
      sendTuningToSynth();
    } catch (e) {
      setStatus('audio error: ' + (e && e.message || e));
      return;
    }
  }
  if (ctx && ctx.state !== 'running') { try { await ctx.resume(); } catch {} }
  reportAudioState();
}
function reportAudioState() {
  if (!ctx) return;
  setStatus(ctx.state === 'running' ? 'audio ready · play your controller'
                                    : 'click/tap the page to enable audio');
}
const startAudio = ensureAudio;   // existing call sites keep working

async function startMidi() {
  const res = await connect({ sysex: false }).catch((e) => ({ _err: e }));
  if (!res || res._err) { setStatus('Web MIDI unavailable'); return; }
  midi = res;
  refreshDevices();   // picks the remembered device (by name) and BINDS it
  midi.onNoteIn((e) => {
    startAudio();                       // first note also satisfies the gesture
    post({ type: e.on ? 'noteOn' : 'noteOff', note: e.note, vel: e.velocity, channel: e.channel });
    // Velocity is real (the meter shows it), but it is NOT Breath — Vane's
    // amp envelope is driven by the actual CC2/CC11/pressure controllers below,
    // not approximated from note-on velocity.
    if (e.on) { activeNotes++; pushMeters({ Velocity: e.velocity / 127 }); }
    else if (--activeNotes <= 0) { activeNotes = 0; pushMeters({ Velocity: 0, Pressure: 0, Slide: 0, Pitchbend: 0.5 }); }
  });
  midi.onControlChange((e) => {
    if (e.controller === 74) { (expr[e.channel] = expr[e.channel] || {}).slide = e.value / 127; sendExpr(e.channel); }
    // Breath (CC2) / Expression (CC11) — Vane's default macro bindings
    // (index.html's state.cc) and, by factory routing, the REAL dynamic
    // envelope (VCA). Global, not per-channel — matches the real engine's
    // shared (non-per-voice) CC sources.
    else if (e.controller === 2)  { post({ type: 'cc', cc: 2,  value: e.value / 127 }); pushMeters({ Breath: e.value / 127 }); }
    else if (e.controller === 11) { post({ type: 'cc', cc: 11, value: e.value / 127 }); pushMeters({ Expression: e.value / 127 }); }
  });
  midi.onPitchBend((e) => { (expr[e.channel] = expr[e.channel] || {}).bend = e.value; sendExpr(e.channel); });
  midi.onChannelPressure((e) => { (expr[e.channel] = expr[e.channel] || {}).pressure = e.value; sendExpr(e.channel); });
  midi.onPortsChanged(refreshDevices);
}

// ── MIDI-in selector, injected into the existing header so it flows with the
//    other controls (no overlap) and inherits the page's .chip styling. Falls
//    back to a non-overlapping fixed pill only if the header isn't found. ───────
let statusEl, selectEl;
function setStatus(t) { if (statusEl) statusEl.textContent = t; }

// The chosen controller is remembered by NAME (localStorage) — Web MIDI port
// ids are not stable across replugs/sessions, names are. refreshDevices runs
// at boot AND on every hot-plug (onPortsChanged), and actually re-BINDS the
// input (midi.selectInput), not just the <select> UI — so replugging the
// Exquis/Sylphyo reattaches to it instead of silently sticking with whatever
// was first in the list (usually IAC).
const MIDI_IN_KEY = 'vane-midi-in-name';
function refreshDevices() {
  if (!selectEl || !midi) return;
  const saved = (() => { try { return localStorage.getItem(MIDI_IN_KEY); } catch { return null; } })();
  const curName = midi.inputs.find((p) => p.id === selectEl.value)?.name;
  selectEl.innerHTML = '<option value="">— MIDI in —</option>' +
    midi.inputs.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  // Preference order: the remembered device (just re-plugged?) → whatever was
  // already selected → first available.
  const pick = midi.inputs.find((p) => p.name === saved)
            || midi.inputs.find((p) => p.name === curName)
            || midi.inputs[0];
  selectEl.value = pick ? pick.id : '';
  midi.selectInput(pick ? pick.id : null);
}
function buildChrome() {
  const chip = document.createElement('span');
  chip.title = 'Standalone Web Audio synth — MIDI input';
  const label = document.createElement('span');
  label.textContent = 'MIDI';
  label.style.cssText = 'opacity:.5;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-right:5px';
  selectEl = document.createElement('select');
  selectEl.style.cssText = 'background:transparent;color:inherit;border:none;font:inherit;cursor:pointer;max-width:130px';
  selectEl.onchange = () => {
    startAudio();
    if (!midi) return;
    midi.selectInput(selectEl.value || null);
    const name = midi.inputs.find((p) => p.id === selectEl.value)?.name;
    try { if (name) localStorage.setItem(MIDI_IN_KEY, name); else localStorage.removeItem(MIDI_IN_KEY); } catch {}
  };
  statusEl = document.createElement('span');
  statusEl.style.cssText = 'opacity:.6;font-size:10px;margin-left:6px';
  statusEl.textContent = 'click to enable';
  chip.append(label, selectEl, statusEl);

  // Velocity->Cutoff brightness toggle: a REAL factory mod-matrix route
  // (0.15 lin — PluginProcessor.cpp kFactory[9]) that fires from the raw MIDI
  // velocity byte independent of breath, so a wind controller with a fixed/high
  // note-on velocity gets an unwanted brightness kick on every attack. Default
  // OFF (matches the other Vane versions); this standalone-only checkbox lets
  // it be switched on, since it's an interesting effect worth keeping available.
  // No real UI knob exists for this (it isn't a user-facing param in index.html),
  // so it lives here rather than intercepting a page control that doesn't exist.
  const velChip = document.createElement('label');
  velChip.title = "Velocity->Cutoff brightness kick (off by default to match the other Vane versions; the real factory mod-matrix route, but it fires from raw MIDI velocity independent of breath)";
  velChip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;cursor:pointer';
  const velLabel = document.createElement('span');
  velLabel.textContent = 'Vel→brightness';
  velLabel.style.cssText = 'opacity:.5;font-size:10px;text-transform:uppercase;letter-spacing:.06em';
  const velCheckbox = document.createElement('input');
  velCheckbox.type = 'checkbox';
  velCheckbox.onchange = () => post({ type: 'param', id: 11, value: velCheckbox.checked ? 1 : 0 });
  velChip.append(velCheckbox, velLabel);

  const header = document.querySelector('.header');
  if (header) {
    chip.className = 'chip'; chip.style.cursor = 'default';                 // reuse the page's chip styling
    velChip.className = 'chip';
    header.append(chip, velChip);
  } else {                                   // defensive fallback — bottom corner, out of the way
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;display:flex;gap:8px;align-items:center;' +
      'font:11px/1.4 system-ui;background:rgba(20,18,16,.85);color:#e8e2d6;padding:6px 10px;border-radius:8px';
    bar.append(chip, velChip);
    document.body.appendChild(bar);
  }
}

// Hide Patch-tab controls the WASM voice doesn't implement (Transient sample
// layer, Noise sources, Detune/Unison, Vowel/Wah formant filter — none are
// wired into vane-dsp.cpp's PARAM_MAP or mod-matrix destinations, so leaving
// them visible/adjustable would silently do nothing and mislead the player).
// CSS-scoped rather than removed from the DOM: index.html is shared with the
// plugin, where these ARE real and must render exactly as before — the
// standalone-limited class only exists here, added at boot, never in HAS_JUCE.
// !important beats the [data-standalone-hide] wrapper's own inline
// `display:contents` (needed there so the plugin's Oscillator grid layout is
// unaffected by the wrapper elements existing at all).
function hideUnimplementedControls() {
  const style = document.createElement('style');
  style.textContent = `
    body.standalone-limited [data-standalone-hide] { display: none !important; }
  `;
  document.head.appendChild(style);
  document.body.classList.add('standalone-limited');
}

function boot() {
  buildChrome();
  hideUnimplementedControls();
  startMidi();
  pushTuningStatus();   // chip shows the internal tuning, not an MTS warning
  pushSlotState();      // Matrix tab shows the factory routing actually sounding
  // Deliberately NOT self-removing: ensureAudio() is idempotent and a no-op
  // once running, but if the first gesture's resume() doesn't stick (e.g. the
  // browser eats it for some unrelated reason), a stale one-shot listener would
  // leave the user stuck with no way to retry. Every future click/keypress is
  // a fresh legitimate user gesture, so just let them all try.
  const gesture = () => { startAudio(); };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
}

if (document.readyState !== 'loading') boot();
else window.addEventListener('DOMContentLoaded', boot);
