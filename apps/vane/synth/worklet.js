// Vane AudioWorklet — runs the WASM voice engine (vane-dsp.wasm) in the audio
// thread. The main thread fetches the wasm bytes and posts them in (the worklet
// scope has no fetch); thereafter it posts note/expression/param messages. Each
// render quantum we call vane_render(n) and copy the mono buffer out of WASM
// memory to every output channel.
class VaneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ex = null;       // wasm exports
    this.bufPtr = 0;
    // WebAssembly.instantiate is async, but the host posts its boot-time state
    // sync (mono mode, current patch params) immediately after the wasm bytes.
    // Dropping those messages made the synth silently start in Poly while the
    // page displayed Mono — queue everything until the wasm is ready instead.
    this.pending = [];
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'wasm') {
        // No JUCE/WASI syscalls are used; satisfy any stray import with no-ops.
        WebAssembly.instantiate(m.bytes, {
          wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
        }).then(({ instance }) => {
          this.ex = instance.exports;
          // WASI-reactor convention: a --no-entry wasm runs its static C++
          // constructors only when the embedder calls _initialize. Skipping it
          // leaves globals unconstructed — TuningClient's cents table stayed
          // all-zero and every note played at ~8 Hz.
          if (this.ex._initialize) this.ex._initialize();
          this.ex.vane_init(sampleRate);
          this.bufPtr  = this.ex.vane_buffer();
          // Stereo: vane_buffer() is the LEFT channel (kept as-is for mono
          // consumers like the CLI); vane_buffer_r() is the right.
          this.bufPtrR = this.ex.vane_buffer_r ? this.ex.vane_buffer_r() : 0;
          for (const q of this.pending) this.dispatch(q);
          this.pending = [];
          this.port.postMessage({ type: 'ready' });
        });
        return;
      }
      if (!this.ex) { this.pending.push(m); return; }
      this.dispatch(m);
    };
  }

  dispatch(m) {
    switch (m.type) {
      case 'noteOn':  this.ex.vane_note_on(m.note, m.vel, m.channel); break;
      case 'noteOff': this.ex.vane_note_off(m.note, m.channel); break;
      case 'expr':    this.ex.vane_set_expr(m.channel, m.bend, m.slide, m.pressure); break;
      case 'param':   this.ex.vane_set_param(m.id, m.value); break;
      case 'cc':      this.ex.vane_set_cc(m.cc, m.value); break;
      case 'mono':    this.ex.vane_set_mono(m.value ? 1 : 0); break;
      case 'tuningSource':   this.ex.vane_set_tuning_source(m.value); break;
      case 'internalTuning': this.ex.vane_set_internal_tuning(m.value); break;
      case 'slot':           this.ex.vane_set_slot(m.slot, m.src, m.dst, m.amt, m.curve, m.on ? 1 : 0); break;
      case 'chords':
        // Rotating-chord sequences: per harmony voice j, a length + fractional-
        // semitone steps (ratios already resolved by the host). Guarded — an
        // older wasm without the exports just ignores the edit.
        if (this.ex.vane_set_chord && this.ex.vane_set_chord_len)
          for (let j = 0; j < m.seqs.length && j < 5; j++) {
            const seq = m.seqs[j] || [];
            for (let k = 0; k < seq.length && k < 16; k++) this.ex.vane_set_chord(j, k, seq[k]);
            this.ex.vane_set_chord_len(j, Math.min(seq.length, 16));
          }
        break;
      default: break;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.ex || !out || out.length === 0) return true;
    const n = out[0].length;
    this.ex.vane_render(n);
    // Re-derive the views each block: WASM memory can be detached/resized.
    // True stereo (unison width/chords pan sub-voices across the field);
    // channel 0 = left, channel 1 = right, extra channels mirror the right.
    const bufL = new Float32Array(this.ex.memory.buffer, this.bufPtr, n);
    if (out.length > 1 && this.bufPtrR) {
      const bufR = new Float32Array(this.ex.memory.buffer, this.bufPtrR, n);
      out[0].set(bufL);
      for (let ch = 1; ch < out.length; ch++) out[ch].set(bufR);
    } else {
      for (let ch = 0; ch < out.length; ch++) out[ch].set(bufL);
    }
    return true;
  }
}

registerProcessor('vane-voice', VaneProcessor);
