// synth-main.js — Vane standalone synth host. Loaded ONLY when there's no JUCE
// host (the index.html bootstrap injects it when window.__JUCE__ is absent), so
// the plugin is untouched. It boots a Web Audio AudioWorklet running the WASM
// voice (synth/worklet.js + vane-dsp.wasm) and drives it from Web MIDI via
// @enkerli/webmidi, including MPE expression: pitch-bend = X, CC74 = Y/slide,
// channel pressure = Z. Audio starts on the first user gesture (autoplay policy).
//
// v1 plays with the engine's default patch + live MPE expression. Wiring the
// UI's setParam knobs to the synth (with per-param unit mapping) is the next
// increment; the morph wavetable is after that.
import { connect } from '@enkerli/webmidi';

const BASE = new URL('.', import.meta.url).href; // dir of synth.js → worklet/wasm URLs
let ctx = null, node = null, midi = null, audioStarted = false;
const expr = {}; // channel → { bend, slide, pressure }

function post(m) { if (node) node.port.postMessage(m); }
function sendExpr(ch) {
  const e = expr[ch] || {};
  post({ type: 'expr', channel: ch, bend: e.bend || 0, slide: e.slide || 0, pressure: e.pressure || 0 });
}

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
  });
  midi.onControlChange((e) => {
    if (e.controller === 74) { (expr[e.channel] = expr[e.channel] || {}).slide = e.value / 127; sendExpr(e.channel); }
  });
  midi.onPitchBend((e) => { (expr[e.channel] = expr[e.channel] || {}).bend = e.value; sendExpr(e.channel); });
  midi.onChannelPressure((e) => { (expr[e.channel] = expr[e.channel] || {}).pressure = e.value; sendExpr(e.channel); });
  midi.onPortsChanged(refreshDevices);
}

// ── Minimal injected standalone chrome (index.html has no slot for it) ────────
let statusEl, selectEl;
function setStatus(t) { if (statusEl) statusEl.textContent = t; }
function refreshDevices() {
  if (!selectEl || !midi) return;
  const cur = selectEl.value;
  selectEl.innerHTML = '<option value="">— MIDI in —</option>' +
    midi.inputs.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  if (midi.inputs.some((p) => p.id === cur)) selectEl.value = cur;
  else if (midi.inputs.length) { selectEl.value = midi.inputs[0].id; }
}
function buildChrome() {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:8px;align-items:center;' +
    'font:11px/1.4 "Inter Tight",system-ui;background:rgba(20,18,16,.82);color:#e8e2d6;' +
    'padding:6px 10px;border-radius:8px;backdrop-filter:blur(8px)';
  bar.innerHTML = '<span style="opacity:.7;text-transform:uppercase;letter-spacing:.08em">Standalone</span>';
  selectEl = document.createElement('select');
  selectEl.style.cssText = 'background:transparent;color:inherit;border:1px solid rgba(255,255,255,.25);border-radius:4px;padding:2px 4px;font:inherit';
  selectEl.onchange = () => { startAudio(); midi && midi.selectInput(selectEl.value || null); };
  statusEl = document.createElement('span');
  statusEl.style.cssText = 'opacity:.7'; statusEl.textContent = 'click to enable audio';
  bar.append(selectEl, statusEl);
  document.body.appendChild(bar);
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
