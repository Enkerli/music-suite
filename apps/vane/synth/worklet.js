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
          this.ex.vane_init(sampleRate);
          this.bufPtr = this.ex.vane_buffer();
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
      default: break;
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    if (!this.ex || !out || out.length === 0) return true;
    const n = out[0].length;
    this.ex.vane_render(n);
    // Re-derive the view each block: WASM memory can be detached/resized.
    const buf = new Float32Array(this.ex.memory.buffer, this.bufPtr, n);
    for (let ch = 0; ch < out.length; ch++) out[ch].set(buf);
    return true;
  }
}

registerProcessor('vane-voice', VaneProcessor);
