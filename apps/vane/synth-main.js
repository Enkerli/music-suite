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
import { connectVane } from './control.js';

const BASE = new URL('.', import.meta.url).href; // dir of synth.js → worklet/wasm URLs
// Build id, injected into index.html at build time (window.__VANE_BUILD__) and
// used to cache-bust the worklet + wasm (the browser caches them aggressively).
// synth.js ITSELF is cache-busted by the ?v= on its own <script src> in
// index.html, so a redeploy can't leave a player on a stale engine. 'dev' when
// running an unbuilt source tree (the placeholder wasn't replaced).
const ASSET_V = (typeof window !== 'undefined' && window.__VANE_BUILD__ && window.__VANE_BUILD__ !== '__BUILD_ID__')
  ? window.__VANE_BUILD__ : 'dev';
let ctx = null, node = null, midi = null, audioStarted = false;
let busConnected = false;   // control-plane bus listener attached once (see connectVane)
let activeNotes = 0;
const expr = {}; // channel → { bend, slide, pressure }

// ── MIDI capture (proto diagnostics) ────────────────────────────────────────
// Ring buffer of recent raw MIDI, so the exact controller stream at a note
// transition (pressure values + timing per channel) can be exported and
// compared against the JUCE plugin — instead of guessing what a controller
// sends. The "⧉ MIDI" chip copies the last few seconds to the clipboard.
const midiLog = [];
let midiT0 = 0;
function logMidi(kind, ch, a, b) {
  const now = performance.now();
  if (!midiT0) midiT0 = now;
  midiLog.push({ t: +(now - midiT0).toFixed(1), kind, ch, a, b });
  if (midiLog.length > 4000) midiLog.shift();
}
async function copyMidiLog() {
  const recent = midiLog.filter((e) => e.t >= (midiLog.length ? midiLog[midiLog.length - 1].t - 6000 : 0));
  const text = 'vane MIDI log (last ~6s, t in ms)\n' +
    recent.map((e) => `${e.t}\t${e.kind}\tch${e.ch}\t${e.a}${e.b != null ? '\t' + e.b : ''}`).join('\n');
  try { await navigator.clipboard.writeText(text); } catch {}
  console.log(text);
  return recent.length;
}

// Vane param id (index.html RANGE keys) → this voice's wasm param id. Values
// arrive already in real units (Hz, 0..1, ms, …) — same units the page itself
// uses — so no conversion needed; a param with different units than the wasm
// expects would need a mapping function here. monoMode is handled separately
// below (it's a 0/1 toggle, not a RANGE-table slider).
const PARAM_MAP = { Cutoff: 1, Reso: 2, Output: 8, VelVCA: 9, Glide: 10,
                    Morph: 12, PW: 13, Inharm: 14, Sync: 15, Mode: 16, Fold: 17,
                    VowelEn: 18, VowelMode: 19, Vowel: 20, VowFront: 21, VowRound: 22,
                    VowelAmt: 23, VowelBite: 24, VowelMove: 25,
                    Noise: 26, NoiseType: 27, Detune: 28, MasterTune: 29,
                    WaveguideOn: 30, WgEmbouchure: 31, WgReedStiff: 32, WgReedAperture: 33,
                    WgBoreDamping: 34, WgBellBright: 35, WgConical: 36, WgBreathNoise: 37, WgGrowl: 38,
                    UniVox: 39, UniDet: 40, UniWid: 41, UniMode: 42,
                    TrChoice: 43, TrGain: 44, TrDecay: 45, TrTrigger: 46, TrVar: 47,
                    TrFilt: 48, TrDyn: 49, TrReso: 50, TrDamp: 51, TrMorph: 52,
                    GlideMode: 53, GlideCurve: 54 };

// Rotating-chord sequence parsing — the plugin's parseChordInterval semantics:
// ';' separates harmony voices, ',' separates steps; each step is decimal
// semitones ("7", "3.5") or a just ratio ("3/2" → 12·log2(3/2)); junk entries
// are rejected (skipped), never silently read as 0.
function parseChordSeqs(str) {
  return String(str || '').split(';').map((voiceStr) =>
    voiceStr.split(',').map((tok) => {
      const t = tok.trim();
      if (!t) return NaN;
      const ratio = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
      if (ratio) { const num = +ratio[1], den = +ratio[2];
        return den > 0 && num > 0 ? 12 * Math.log2(num / den) : NaN; }
      const v = Number(t);
      return Number.isFinite(v) ? v : NaN;
    }).filter(Number.isFinite));
}
function sendChordSeqs(str) { post({ type: 'chords', seqs: parseChordSeqs(str) }); }

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
  if (id === 'Morph') sendWaveDisplay();   // live WT frame display (host-drawn)
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
// ── Minimal WAV parser (PCM 16/24/32f, any channel count → mono) ─────────────
// decodeAudioData resamples to the AudioContext rate, which would CORRUPT
// wavetable frame boundaries (frames must stay exactly frameLength samples).
// Parsing the RIFF ourselves keeps frames exact and gives the true srcRate
// for transients (SamplePlayer corrects rate via speedRatio).
function parseWav(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) return null; // RIFF/WAVE
  let off = 12, fmt = null, data = null;
  while (off + 8 <= dv.byteLength) {
    const id = dv.getUint32(off, false), size = dv.getUint32(off + 4, true);
    if (id === 0x666d7420) fmt = { tag: dv.getUint16(off + 8, true), ch: dv.getUint16(off + 10, true),
                                   rate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    else if (id === 0x64617461) data = { off: off + 8, size };
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) return null;
  const bytesPer = fmt.bits >> 3, frames = Math.floor(data.size / (bytesPer * fmt.ch));
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = data.off + (i * fmt.ch + c) * bytesPer;
      if (fmt.tag === 3 && fmt.bits === 32) acc += dv.getFloat32(o, true);
      else if (fmt.bits === 16) acc += dv.getInt16(o, true) / 32768;
      else if (fmt.bits === 24) { const b = (dv.getUint8(o) | (dv.getUint8(o+1) << 8) | (dv.getUint8(o+2) << 16));
                                  acc += (b > 0x7FFFFF ? b - 0x1000000 : b) / 8388608; }
      else if (fmt.bits === 32) acc += dv.getInt32(o, true) / 2147483648;
    }
    out[i] = acc / fmt.ch;
  }
  return { samples: out, sampleRate: fmt.rate };
}

// ── Factory assets: wavetable library + transient samples ────────────────────
// Fetched from ./assets (bundled by the build, all CC0), decoded host-side,
// and pushed into the wasm through its staging buffer. The library manifest is
// the SAME library.json the plugin embeds via BinaryData.
const emit = (id, p) => { const api = window.__vaneStandalone; if (api && api.emit) api.emit(id, p); };
let gLibrary = [];                 // library.json tables (+ .active flag)
let gActiveTableId = null;         // id of the sounding table (null = built-in)
// Cached current table frames so phase-align retoggle and the wave/strip
// displays can recompute without refetching.
let gTable = null;                 // { frames: Float32Array[], name, phaseAlign }
let gTransientNames = ['None'];
let gAssetsLoaded = false;

function tableDisplays() {
  if (!gTable) { emit('wavetableStrip', { cols: [], frames: 16 }); return; }
  const F = gTable.frames.length;
  const cols = [];
  const nCols = Math.min(28, F);
  for (let c = 0; c < nCols; c++) {
    const f = gTable.frames[Math.round((c / Math.max(1, nCols - 1)) * (F - 1))];
    const pts = [];
    for (let i = 0; i < 24; i++) pts.push(f[Math.floor((i / 23) * (f.length - 1))]);
    cols.push(pts);
  }
  emit('wavetableStrip', { cols, frames: F });
  sendWaveDisplay();
}
function sendWaveDisplay() {
  if (!gTable) return;
  const F = gTable.frames.length;
  const patch = window.__vaneStandalone && window.__vaneStandalone.getPatch();
  const morph = patch ? (patch.Morph || 0) : 0;
  const framePos = morph * (F - 1);
  const f = gTable.frames[Math.min(F - 1, Math.round(framePos))];
  const pts = [];
  for (let i = 0; i < 64; i++) pts.push(f[Math.floor((i / 63) * (f.length - 1))]);
  emit('wavetableWave', { pts, frame: framePos, frames: F });
}

// Slice a decoded wavetable WAV into frames and ship it to the synth.
function shipWavetable(samples, frameLength, name, phaseAlign) {
  const F = Math.floor(samples.length / frameLength);
  if (F < 1) { emit('wavetableInfo', { name, frames: 0, phaseAlign, ok: false }); return false; }
  const frames = [];
  for (let f = 0; f < F; f++) frames.push(samples.subarray(f * frameLength, (f + 1) * frameLength));
  gTable = { frames, name, phaseAlign, samples, frameLength };
  post({ type: 'wavetable', data: samples, frameSize: frameLength, phaseAlign: !!phaseAlign });
  emit('wavetableInfo', { name, frames: F, phaseAlign: !!phaseAlign, ok: true });
  tableDisplays();
  return true;
}

async function loadLibraryTable(id) {
  const t = gLibrary.find((x) => x.id === id);
  if (!t) return;
  try {
    const buf = await (await fetch(new URL('assets/library/' + t.file, BASE))).arrayBuffer();
    const wav = parseWav(buf);
    if (!wav) return;
    const patch = window.__vaneStandalone && window.__vaneStandalone.getPatch();
    const align = !!(gTable && gTable.phaseAlign);
    if (shipWavetable(wav.samples, t.frameLength || 2048, t.title, align)) {
      gActiveTableId = id;
      gLibrary.forEach((x) => { x.active = x.id === id; });
      emit('libraryData', { tables: gLibrary });
    }
  } catch (e) { console.warn('library table load failed', e); }
}

async function loadFactoryAssets() {
  if (gAssetsLoaded) return;
  gAssetsLoaded = true;
  // Wavetable library manifest (fetch failures leave the modal on "Loading…" —
  // same soft behavior as a plugin whose bridge is quiet).
  try {
    const lib = await (await fetch(new URL('assets/library/library.json', BASE))).json();
    gLibrary = (lib.tables || []).map((t) => ({ ...t, active: false }));
  } catch (e) { console.warn('wavetable library manifest failed', e); }
  // Transients: decode + ship in MANIFEST ORDER — TrChoice indices must match
  // the plugin's TransientLibrary order, so ship strictly sequentially.
  try {
    const man = await (await fetch(new URL('assets/transients/transients.json', BASE))).json();
    for (const s of man.samples || []) {
      try {
        const buf = await (await fetch(new URL('assets/transients/' + s.file, BASE))).arrayBuffer();
        const wav = parseWav(buf);
        if (!wav) continue;
        post({ type: 'transient', data: wav.samples, srcRate: wav.sampleRate,
               nativeHz: s.nativeHz || 440, pitched: s.pitched !== false });
        gTransientNames.push(s.name);
      } catch (e) { console.warn('transient failed:', s.file, e); }
    }
    emit('transientList', { names: gTransientNames });
  } catch (e) { console.warn('transient manifest failed', e); }
}

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
  } else if (id === 'chordSeqsEdit' && p && typeof p.seqs === 'string') {
    // Chord editor → rotating-chord sequences in the wasm (Chord voice mode).
    sendChordSeqs(p.seqs);
  } else if (id === 'requestLibrary') {
    emit('libraryData', { tables: gLibrary });
  } else if (id === 'loadLibraryTable' && p && p.id) {
    loadLibraryTable(p.id);
  } else if (id === 'useBuiltinWavetable') {
    post({ type: 'builtinWavetable' });
    gTable = null; gActiveTableId = null;
    gLibrary.forEach((x) => { x.active = false; });
    emit('wavetableInfo', { name: 'Harmonic Stack (built-in)', frames: 16, phaseAlign: false, ok: true });
    emit('wavetableStrip', { cols: [], frames: 16 });
  } else if (id === 'setMorphPhaseAlign' && p) {
    // Re-build the current table with the new flag (host keeps the raw frames).
    if (gTable) shipWavetable(gTable.samples, gTable.frameLength, gTable.name, !!p.on);
  } else if (id === 'loadWavetable') {
    // User .wav import — Serum-style concatenated 2048-sample frames.
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.wav,audio/wav';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const wav = parseWav(await f.arrayBuffer());
      if (!wav) { emit('wavetableInfo', { name: f.name, frames: 0, phaseAlign: false, ok: false }); return; }
      if (shipWavetable(wav.samples, 2048, f.name.replace(/\.wav$/i, ''), !!(gTable && gTable.phaseAlign))) {
        gActiveTableId = null;
        gLibrary.forEach((x) => { x.active = false; });
      }
    };
    inp.click();
  } else if (id === 'glideCurveEdit' && p && Array.isArray(p.anchors)) {
    const pairs = new Float32Array(p.anchors.length * 2);
    p.anchors.forEach((a, i) => { pairs[i * 2] = +a.x || 0; pairs[i * 2 + 1] = +a.y || 0; });
    post({ type: 'glideAnchors', pairs });
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
      await ctx.audioWorklet.addModule(BASE + 'worklet.js?v=' + ASSET_V);
      node = new AudioWorkletNode(ctx, 'vane-voice', { numberOfInputs: 0, outputChannelCount: [2] });
      node.connect(ctx.destination);
      // Control plane: workspace/bus `param` messages drive the voice (once).
      if (!busConnected) { connectVane({ post }); busConnected = true; }
      const bytes = await (await fetch(BASE + 'vane-dsp.wasm?v=' + ASSET_V, { cache: 'reload' })).arrayBuffer();
      node.port.postMessage({ type: 'wasm', bytes });
      // Sync the synth to whatever the patch already shows (default or loaded
      // preset), so turning audio on doesn't silently revert to the voice's
      // built-in defaults.
      const patch = window.__vaneStandalone && window.__vaneStandalone.getPatch();
      if (patch) for (const id in PARAM_MAP) if (patch[id] != null) sendParam(id, patch[id]);
      if (window.__vaneStandalone) post({ type: 'mono', value: window.__vaneStandalone.getMono() });
      // Chord sequences: sync the page's current editor state at boot (the wasm
      // carries the same factory default, but the user may have edited before
      // audio started). Older page bundles without the getter just skip.
      if (window.__vaneStandalone && window.__vaneStandalone.getChordSeqs)
        sendChordSeqs(window.__vaneStandalone.getChordSeqs());
      sendTuningToSynth();
      loadFactoryAssets();   // wavetable library + transient samples (async)
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
    logMidi(e.on ? 'noteOn' : 'noteOff', e.channel, e.note, e.on ? e.velocity : undefined);
    post({ type: e.on ? 'noteOn' : 'noteOff', note: e.note, vel: e.velocity, channel: e.channel });
    // Velocity is real (the meter shows it), but it is NOT Breath — Vane's
    // amp envelope is driven by the actual CC2/CC11/pressure controllers below,
    // not approximated from note-on velocity.
    if (e.on) { activeNotes++; pushMeters({ Velocity: e.velocity / 127 }); }
    else if (--activeNotes <= 0) { activeNotes = 0; pushMeters({ Velocity: 0, Pressure: 0, Slide: 0, Pitchbend: 0.5 }); }
  });
  midi.onControlChange((e) => {
    if (e.controller === 74 || e.controller === 2 || e.controller === 11) logMidi('cc' + e.controller, e.channel, e.value);
    if (e.controller === 74) { (expr[e.channel] = expr[e.channel] || {}).slide = e.value / 127; sendExpr(e.channel); }
    // Breath (CC2) / Expression (CC11) — Vane's default macro bindings
    // (index.html's state.cc) and, by factory routing, the REAL dynamic
    // envelope (VCA). Global, not per-channel — matches the real engine's
    // shared (non-per-voice) CC sources.
    else if (e.controller === 2)  { post({ type: 'cc', cc: 2,  value: e.value / 127 }); pushMeters({ Breath: e.value / 127 }); }
    else if (e.controller === 11) { post({ type: 'cc', cc: 11, value: e.value / 127 }); pushMeters({ Expression: e.value / 127 }); }
  });
  midi.onPitchBend((e) => { (expr[e.channel] = expr[e.channel] || {}).bend = e.value; sendExpr(e.channel); });
  midi.onChannelPressure((e) => { logMidi('press', e.channel, +e.value.toFixed(3)); (expr[e.channel] = expr[e.channel] || {}).pressure = e.value; sendExpr(e.channel); });
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
  // Built with DOM APIs, not an innerHTML string: a MIDI port name is external
  // input (the OS hands it over, and any local software can register a VIRTUAL
  // port under a name it chooses), so interpolating it into HTML would be an
  // injection sink. textContent/value never parse markup.
  selectEl.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— MIDI in —';
  selectEl.append(none);
  for (const p of midi.inputs) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    selectEl.append(opt);
  }
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
  label.style.cssText = 'color:var(--vn-muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;margin-right:5px';
  selectEl = document.createElement('select');
  selectEl.setAttribute('aria-label', 'MIDI input device');
  selectEl.style.cssText = 'background:transparent;color:inherit;border:none;font:inherit;cursor:pointer;max-width:130px;min-height:24px;padding:2px 0';
  selectEl.onchange = () => {
    startAudio();
    if (!midi) return;
    midi.selectInput(selectEl.value || null);
    const name = midi.inputs.find((p) => p.id === selectEl.value)?.name;
    try { if (name) localStorage.setItem(MIDI_IN_KEY, name); else localStorage.removeItem(MIDI_IN_KEY); } catch {}
  };
  statusEl = document.createElement('span');
  statusEl.style.cssText = 'color:var(--vn-muted);font-size:10px;margin-left:6px';
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
  velLabel.style.cssText = 'color:var(--vn-muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em';
  const velCheckbox = document.createElement('input');
  velCheckbox.type = 'checkbox';
  velCheckbox.onchange = () => post({ type: 'param', id: 11, value: velCheckbox.checked ? 1 : 0 });
  velChip.append(velCheckbox, velLabel);

  // Build-id chip — this is a prototype and it's been too easy to test a stale
  // cached build without knowing. Shows exactly which build is running (the
  // timestamp injected at build time), so "am I current?" is answerable at a
  // glance, no DevTools. 'dev' = unbuilt source.
  const buildChip = document.createElement('span');
  buildChip.title = 'Running build id (cache-bust tag). If this is not the latest, hard-reload.';
  buildChip.textContent = 'build ' + ASSET_V;
  buildChip.style.cssText = 'color:var(--vn-muted);font-size:10px;font-variant-numeric:tabular-nums;letter-spacing:.02em';

  // Copy the recent raw MIDI stream (pressure/notes + timing) to the clipboard,
  // so the exact controller behaviour at a note transition can be shared and
  // compared against the JUCE plugin.
  const midiBtn = document.createElement('span');
  midiBtn.textContent = '⧉ MIDI';
  midiBtn.title = 'Copy the last ~6s of raw MIDI (notes + pressure + timing) to the clipboard';
  midiBtn.style.cssText = 'color:var(--vn-muted);font-size:10px;cursor:pointer;text-transform:uppercase;letter-spacing:.04em';
  midiBtn.onclick = async () => { const n = await copyMidiLog(); const o = midiBtn.textContent; midiBtn.textContent = 'copied ' + n; setTimeout(() => { midiBtn.textContent = o; }, 1400); };

  const header = document.querySelector('.header');
  if (header) {
    chip.className = 'chip'; chip.style.cursor = 'default';                 // reuse the page's chip styling
    velChip.className = 'chip';
    buildChip.className = 'chip';
    midiBtn.className = 'chip';
    header.append(chip, velChip, midiBtn, buildChip);
  } else {                                   // defensive fallback — bottom corner, out of the way
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;display:flex;gap:8px;align-items:center;' +
      'font:11px/1.4 system-ui;background:rgba(20,18,16,.85);color:#e8e2d6;padding:6px 10px;border-radius:8px';
    bar.append(chip, velChip, midiBtn, buildChip);
    document.body.appendChild(bar);
  }
}

// Hide Patch-tab controls the WASM voice doesn't implement YET (Transient
// sample layer and Unison/Chord voices — the render path is still mono, so
// stereo unison needs the worklet upgraded first; leaving them visible/
// adjustable would silently do nothing and mislead the player). Noise,
// Detune/MasterTune, Vowel, and the Waveguide (MiniSax) mode ARE implemented
// in vane-dsp.cpp and stay visible.
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
