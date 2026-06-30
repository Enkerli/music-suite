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
const PARAM_MAP = { Cutoff: 1, Reso: 2, Output: 8, VelVCA: 9, Glide: 10 };

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
  post({ type: 'expr', channel: ch, bend: e.bend || 0, slide: e.slide || 0, pressure: e.pressure || 0 });
  // Pitchbend meter is bipolar (-1..1) drawn on a 0..1 fill, centred at 0.5 —
  // matches the page's own init value (Pitchbend:0.5) for the same reason.
  pushMeters({ Pressure: e.pressure || 0, Slide: e.slide || 0, Pitchbend: 0.5 + (e.bend || 0) / 2 });
}

function sendParam(id, value) {
  if (id === 'monoMode') { post({ type: 'mono', value: value > 0.5 }); return; }
  const wasmId = PARAM_MAP[id];
  if (wasmId != null) post({ type: 'param', id: wasmId, value });
}

// Register as soon as the script loads (index.html's hook exists synchronously),
// so knob moves before audio even starts aren't lost — sendParam itself no-ops
// via post() until the worklet is ready, but the *latest* value per id is what
// matters and React-less state.patch already holds it for the boot-time sync.
if (window.__vaneStandalone) window.__vaneStandalone.onParam = sendParam;

async function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.audioWorklet.addModule(BASE + 'worklet.js');
    node = new AudioWorkletNode(ctx, 'vane-voice', { numberOfInputs: 0, outputChannelCount: [2] });
    node.connect(ctx.destination);
    const bytes = await (await fetch(BASE + 'vane-dsp.wasm')).arrayBuffer();
    node.port.postMessage({ type: 'wasm', bytes });
    await ctx.resume();
    // Sync the synth to whatever the patch already shows (default or loaded
    // preset), so turning audio on doesn't silently revert to the voice's
    // built-in defaults.
    const patch = window.__vaneStandalone && window.__vaneStandalone.getPatch();
    if (patch) for (const id in PARAM_MAP) if (patch[id] != null) sendParam(id, patch[id]);
    if (window.__vaneStandalone) post({ type: 'mono', value: window.__vaneStandalone.getMono() });
    setStatus('audio ready · play your controller');
  } catch (e) {
    setStatus('audio error: ' + (e && e.message || e));
  }
}

async function startMidi() {
  const res = await connect({ sysex: false }).catch((e) => ({ _err: e }));
  if (!res || res._err) { setStatus('Web MIDI unavailable'); return; }
  midi = res;
  refreshDevices();
  if (midi.inputs.length) midi.selectInput(midi.inputs[0].id);
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
function refreshDevices() {
  if (!selectEl || !midi) return;
  const cur = selectEl.value;
  selectEl.innerHTML = '<option value="">— MIDI in —</option>' +
    midi.inputs.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  if (midi.inputs.some((p) => p.id === cur)) selectEl.value = cur;
  else if (midi.inputs.length) selectEl.value = midi.inputs[0].id;
}
function buildChrome() {
  const chip = document.createElement('span');
  chip.title = 'Standalone Web Audio synth — MIDI input';
  const label = document.createElement('span');
  label.textContent = 'MIDI';
  label.style.cssText = 'opacity:.5;font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-right:5px';
  selectEl = document.createElement('select');
  selectEl.style.cssText = 'background:transparent;color:inherit;border:none;font:inherit;cursor:pointer;max-width:130px';
  selectEl.onchange = () => { startAudio(); midi && midi.selectInput(selectEl.value || null); };
  statusEl = document.createElement('span');
  statusEl.style.cssText = 'opacity:.6;font-size:10px;margin-left:6px';
  statusEl.textContent = 'click to enable';
  chip.append(label, selectEl, statusEl);

  const header = document.querySelector('.header');
  if (header) {
    chip.className = 'chip';                 // reuse the page's chip styling
    chip.style.cursor = 'default';
    header.appendChild(chip);
  } else {                                   // defensive fallback — bottom corner, out of the way
    chip.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;display:flex;align-items:center;' +
      'font:11px/1.4 system-ui;background:rgba(20,18,16,.85);color:#e8e2d6;padding:6px 10px;border-radius:8px';
    document.body.appendChild(chip);
  }
}

function boot() {
  buildChrome();
  startMidi();
  const gesture = () => { startAudio(); window.removeEventListener('pointerdown', gesture); window.removeEventListener('keydown', gesture); };
  window.addEventListener('pointerdown', gesture);
  window.addEventListener('keydown', gesture);
}

if (document.readyState !== 'loading') boot();
else window.addEventListener('DOMContentLoaded', boot);
