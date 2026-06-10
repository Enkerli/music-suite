/** A single MIDI event as parsed from a track chunk. */
export interface MidiEvent {
  delta: number;
  type: 'noteOn' | 'noteOff' | 'tempo' | 'timeSig' | 'marker' | 'text';
  note?: number;
  velocity?: number;
  channel?: number;
  bpm?: number;
  /** Time signature numerator (e.g. 3 for 3/4) */
  numerator?: number;
  /** Time signature denominator (e.g. 4 for 3/4) */
  denominator?: number;
  /** Text content for marker (0x06) and text (0x01) meta events */
  text?: string;
}

/** Result of parsing an entire MIDI file. */
export interface ParsedMidi {
  ticksPerBeat: number;
  tracks: MidiEvent[][];
}
