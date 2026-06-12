/**
 * Convert a curated clip into the enkerli MidiClipScheduler shape for
 * host-synced playback in the plugin (beats, not ticks; channels 1-based).
 */

import type { Clip } from '../types/clip';
import type { HostClipNote } from './juce-bridge';

export function clipToHostClip(clip: Clip): { notes: HostClipNote[]; lengthBeats: number } {
  const { gesture, harmonic } = clip;
  const tpb = gesture.ticks_per_beat || 480;
  const notes: HostClipNote[] = gesture.onsets.map((onset, i) => ({
    startBeat: onset / tpb,
    lengthBeats: Math.max(0.05, (gesture.durations[i] ?? tpb) / tpb),
    pitch: harmonic.pitches[i] ?? 60,
    velocity: gesture.velocities[i] ?? 96,
    channel: 1,
  }));
  const lengthBeats = gesture.num_bars * (gesture.ticks_per_bar / tpb);
  return { notes, lengthBeats: lengthBeats || Math.max(1, ...notes.map((n) => n.startBeat + n.lengthBeats)) };
}
