/**
 * Transparent, musically legible features over a phrase (GLORIARP_BRIEF §5.6).
 * The rhythm half quantizes onsets onto a step grid and reuses @enkerli/upi's
 * analysis (leftmost = LSB, like everything in the suite); the MIDI-derived
 * half (register, velocity, intervals) is computed here. Features power
 * search, comparison, tests, and — later — morphing targets; they are
 * derived, not stored on the phrase.
 */

import { analyse, analyzeSyncopation, type Analysis, type Syncopation } from "@enkerli/upi";
import type { AccompanimentPhrase } from "./phrase.js";

export interface PhraseFeatures {
  /** Ticks per grid step (ticksPerBeat / 4 — sixteenths). */
  grid: number;
  /** Onset mask on the grid, leftmost = LSB (step i = grid slot i). */
  steps: number[];
  /** @enkerli/upi analyse over the mask (onsets, density, evenness, …). */
  rhythm: Analysis;
  syncopation: Syncopation;
  register: { low: number; high: number; mean: number } | null;
  /** Counts by pitch class 0..11 (pitched events only). */
  pitchClassHistogram: number[];
  /** Counts by chord-relation category (also surfaces classification honesty). */
  categoryHistogram: Record<string, number>;
  /** Counts by signed semitone interval between consecutive pitched events. */
  intervalHistogram: Record<string, number>;
  directionChanges: number;
  /** 1 − (sounding ticks / lengthTicks), clamped to [0, 1]. */
  restRatio: number;
  velocity: { mean: number; min: number; max: number } | null;
}

export function computeFeatures(p: AccompanimentPhrase): PhraseFeatures {
  const grid = Math.max(1, Math.round(p.ticksPerBeat / 4));
  const slots = Math.max(1, Math.round(p.lengthTicks / grid));
  const steps = Array.from({ length: slots }, () => 0);
  for (const e of p.events) {
    const slot = Math.round(e.onset / grid);
    if (slot >= 0 && slot < slots) steps[slot] = 1;
  }

  const pitched = p.events.filter((e) => e.note !== undefined);
  const notes = pitched.map((e) => e.note!);

  const pitchClassHistogram = Array.from({ length: 12 }, () => 0);
  for (const n of notes) pitchClassHistogram[((n % 12) + 12) % 12]!++;

  const categoryHistogram: Record<string, number> = {};
  for (const e of p.events) {
    const c = e.chordRelation?.category ?? "unrelated";
    categoryHistogram[c] = (categoryHistogram[c] ?? 0) + 1;
  }

  const intervalHistogram: Record<string, number> = {};
  let directionChanges = 0;
  let prevDir = 0;
  for (let i = 1; i < notes.length; i++) {
    const d = notes[i]! - notes[i - 1]!;
    intervalHistogram[String(d)] = (intervalHistogram[String(d)] ?? 0) + 1;
    const dir = Math.sign(d);
    if (dir !== 0 && prevDir !== 0 && dir !== prevDir) directionChanges++;
    if (dir !== 0) prevDir = dir;
  }

  const sounding = p.events.reduce((t, e) => t + e.duration, 0);

  return {
    grid,
    steps,
    rhythm: analyse(steps),
    syncopation: analyzeSyncopation(steps, slots),
    register: notes.length
      ? { low: Math.min(...notes), high: Math.max(...notes), mean: notes.reduce((a, b) => a + b, 0) / notes.length }
      : null,
    pitchClassHistogram,
    categoryHistogram,
    intervalHistogram,
    directionChanges,
    restRatio: Math.min(1, Math.max(0, 1 - sounding / p.lengthTicks)),
    velocity: p.events.length
      ? {
          mean: p.events.reduce((a, e) => a + e.velocity, 0) / p.events.length,
          min: Math.min(...p.events.map((e) => e.velocity)),
          max: Math.max(...p.events.map((e) => e.velocity)),
        }
      : null,
  };
}
