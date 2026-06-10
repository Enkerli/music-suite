import type { Gesture, Harmonic } from '../types/clip';

/**
 * WebAudio-based MIDI playback engine.
 * Schedules notes from gesture+harmonic data using oscillators.
 * Pure class — no React dependency.
 */

export type PlaybackState = 'stopped' | 'playing' | 'paused';

export type PlaybackListener = (state: PlaybackState, currentTime: number) => void;

export class PlaybackEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private scheduledNodes: OscillatorNode[] = [];
  private state: PlaybackState = 'stopped';
  private startTime = 0;
  private pauseOffset = 0;
  private listener: PlaybackListener | null = null;
  private rafId: number | null = null;
  private totalDuration = 0;

  setListener(listener: PlaybackListener | null) {
    this.listener = listener;
  }

  getState(): PlaybackState {
    return this.state;
  }

  getCurrentTime(): number {
    if (this.state === 'playing' && this.ctx) {
      return this.ctx.currentTime - this.startTime + this.pauseOffset;
    }
    return this.pauseOffset;
  }

  /**
   * Schedule and play all notes from a clip.
   */
  play(gesture: Gesture, harmonic: Harmonic, bpm: number) {
    // If paused, resume from where we left off
    if (this.state === 'paused' && this.ctx) {
      this.scheduleNotes(gesture, harmonic, bpm, this.pauseOffset);
      return;
    }

    // Fresh start
    this.stop();
    this.pauseOffset = 0;
    this.scheduleNotes(gesture, harmonic, bpm, 0);
  }

  private scheduleNotes(
    gesture: Gesture,
    harmonic: Harmonic,
    bpm: number,
    offsetSeconds: number,
  ) {
    this.ctx = new AudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.15; // Keep it gentle
    this.gainNode.connect(this.ctx.destination);

    const beatsPerSecond = bpm / 60;
    const ticksPerSecond = beatsPerSecond * gesture.ticks_per_beat;
    const offsetTicks = offsetSeconds * ticksPerSecond;

    this.scheduledNodes = [];
    let maxEndTime = 0;

    for (let i = 0; i < gesture.onsets.length; i++) {
      const onset = gesture.onsets[i]!;
      const duration = gesture.durations[i]!;
      const velocity = gesture.velocities[i]!;
      const pitch = harmonic.pitches[i]!;

      const noteStartTick = onset;
      const noteEndTick = onset + duration;

      // Skip notes that ended before our offset
      if (noteEndTick <= offsetTicks) continue;

      const startSec = Math.max(0, (noteStartTick - offsetTicks) / ticksPerSecond);
      const endSec = (noteEndTick - offsetTicks) / ticksPerSecond;

      if (endSec > maxEndTime) maxEndTime = endSec;

      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      // Frequency from MIDI note
      osc.frequency.value = 440 * Math.pow(2, (pitch - 69) / 12);
      osc.type = 'triangle';

      // Velocity envelope
      const vol = (velocity / 127) * 0.8;
      noteGain.gain.setValueAtTime(0, this.ctx.currentTime + startSec);
      noteGain.gain.linearRampToValueAtTime(
        vol,
        this.ctx.currentTime + startSec + 0.005,
      );
      noteGain.gain.setValueAtTime(
        vol * 0.7,
        this.ctx.currentTime + endSec - 0.01,
      );
      noteGain.gain.linearRampToValueAtTime(
        0,
        this.ctx.currentTime + endSec,
      );

      osc.connect(noteGain);
      noteGain.connect(this.gainNode!);

      osc.start(this.ctx.currentTime + startSec);
      osc.stop(this.ctx.currentTime + endSec + 0.01);

      this.scheduledNodes.push(osc);
    }

    this.totalDuration = offsetSeconds + maxEndTime;
    this.startTime = this.ctx.currentTime;
    this.state = 'playing';
    this.notify();
    this.startAnimationLoop();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.pauseOffset = this.getCurrentTime();
    this.stopAudio();
    this.state = 'paused';
    this.notify();
  }

  stop() {
    this.stopAudio();
    this.pauseOffset = 0;
    this.state = 'stopped';
    this.notify();
  }

  private stopAudio() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    for (const osc of this.scheduledNodes) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.scheduledNodes = [];
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.gainNode = null;
  }

  private startAnimationLoop() {
    const tick = () => {
      if (this.state !== 'playing') return;

      const currentTime = this.getCurrentTime();
      this.notify();

      // Auto-stop at end
      if (currentTime >= this.totalDuration) {
        this.stop();
        return;
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private notify() {
    this.listener?.(this.state, this.getCurrentTime());
  }

  dispose() {
    this.stop();
    this.listener = null;
  }
}
