// PlaybackEngine MIDI routing: when a MidiSink is set and active, notes go to
// it (not the internal oscillators); stop() cancels pending sends and silences
// hanging notes. A minimal AudioContext stub stands in for Web Audio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackEngine, type MidiSink } from './playback';
import type { Gesture, Harmonic } from '../types/clip';

let oscCount = 0;
class FakeOsc {
  frequency = { value: 0 };
  type = '';
  connect() {} start() {} stop() {}
  constructor() { oscCount++; }
}
class FakeGain { gain = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }; connect() {} }
class FakeAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() { return new FakeOsc(); }
  createGain() { return new FakeGain(); }
  close() {}
}

function gesture(): Gesture {
  return {
    onsets: [0, 480], durations: [240, 240], velocities: [100, 80],
    density: 0.5, syncopation_score: 0, avg_velocity: 90, velocity_variance: 10,
    avg_duration: 240, num_bars: 1, ticks_per_bar: 1920, ticks_per_beat: 480,
  };
}
function harmonic(): Harmonic { return { pitches: [60, 64], pitchClasses: [0, 4] }; }

function fakeSink(active: boolean) {
  const calls: string[] = [];
  const sink: MidiSink = {
    active: () => active,
    noteOn: (n, v, c) => calls.push(`on ${n} ${v} ${c}`),
    noteOff: (n, c) => calls.push(`off ${n} ${c}`),
    allNotesOff: (c) => calls.push(`panic ${c}`),
  };
  return { sink, calls };
}

beforeEach(() => {
  oscCount = 0;
  vi.useFakeTimers();
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
  (globalThis as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = () => {};
});
afterEach(() => { vi.useRealTimers(); });

describe('PlaybackEngine MIDI routing', () => {
  it('sends MIDI (not oscillators) when a sink is active', () => {
    const { sink, calls } = fakeSink(true);
    const engine = new PlaybackEngine();
    engine.setMidiOut(sink);
    engine.play(gesture(), harmonic(), 120);

    expect(oscCount).toBe(0);              // no internal oscillators
    vi.advanceTimersByTime(2000);          // let all note-on/off timers fire
    expect(calls).toContain('on 60 100 1');
    expect(calls).toContain('on 64 80 1');
    expect(calls).toContain('off 60 1');
    expect(calls).toContain('off 64 1');
  });

  it('uses oscillators when no sink / inactive sink', () => {
    const { sink } = fakeSink(false);
    const engine = new PlaybackEngine();
    engine.setMidiOut(sink);
    engine.play(gesture(), harmonic(), 120);
    expect(oscCount).toBe(2);              // two notes → two oscillators
  });

  it('stop() cancels pending sends and silences hanging notes', () => {
    const { sink, calls } = fakeSink(true);
    const engine = new PlaybackEngine();
    engine.setMidiOut(sink);
    engine.play(gesture(), harmonic(), 120);
    engine.stop();                         // before any timer fires
    const afterStop = [...calls];
    vi.advanceTimersByTime(2000);
    expect(calls).toEqual(afterStop);      // no note-ons fired after stop
    expect(afterStop).toContain('panic 1'); // …and everything was silenced
  });
});
