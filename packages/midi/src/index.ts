/**
 * Standard MIDI File writing — the suite's shared SMF encoder.
 *
 * The byte-level core (variable-length quantities, meta events, header,
 * track chunks) is promoted verbatim from MIDIcurator's midi-export.ts;
 * createSMF is the generic surface for any suite app (Progression
 * Studio, MIDIcurator, a JazzPatterns successor): plain note lists with
 * absolute ticks, plus optional tempo, track name, and markers.
 *
 * Note: SMF VLQ byte order is defined by the MIDI spec — the
 * suite's MSB-first convention governs our own notation, not external
 * file formats (CONVENTIONS.md).
 */

export function encodeVariableLength(value: number): number[] {
  const bytes: number[] = [];
  bytes.push(value & 0x7f);

  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }

  return bytes;
}

/**
 * Encode a text-family meta event.
 * @param metaType 0x01 text, 0x03 track name, 0x06 marker
 */
export function encodeTextMeta(metaType: 0x01 | 0x03 | 0x06, text: string): number[] {
  const textBytes = new TextEncoder().encode(text);
  return [0xff, metaType, ...encodeVariableLength(textBytes.length), ...textBytes];
}

export function createMIDIHeader(format: number, ticksPerBeat: number): number[] {
  return [
    0x4d, 0x54, 0x68, 0x64,                          // "MThd"
    0x00, 0x00, 0x00, 0x06,                          // header length
    0x00, format,
    0x00, 0x01,                                      // single track
    (ticksPerBeat >> 8) & 0xff, ticksPerBeat & 0xff,
  ];
}

export interface MidiNote {
  /** MIDI note number 0–127. */
  pitch: number;
  /** Absolute start, in ticks. */
  startTick: number;
  durationTicks: number;
  /** 1–127, default 96. */
  velocity?: number;
  /** 0–15, default 0. */
  channel?: number;
}

export interface MidiMarker {
  tick: number;
  text: string;
}

export interface SmfOptions {
  bpm?: number;
  ticksPerBeat?: number;
  trackName?: string;
  /** DAW-visible marker meta events (e.g. chord symbols per bar). */
  markers?: MidiMarker[];
}

/** Build a single-track (format 0) Standard MIDI File. */
export function createSMF(notes: MidiNote[], options: SmfOptions = {}): Uint8Array {
  const { bpm = 120, ticksPerBeat = 480, trackName, markers = [] } = options;

  const allEvents: Array<{ tick: number; order: number; data: number[] }> = [];

  const microsecondsPerBeat = Math.round(60000000 / bpm);
  allEvents.push({
    tick: 0,
    order: 0,
    data: [0xff, 0x51, 0x03,
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff],
  });
  if (trackName) {
    allEvents.push({ tick: 0, order: 1, data: encodeTextMeta(0x03, trackName) });
  }
  for (const marker of markers) {
    allEvents.push({ tick: marker.tick, order: 2, data: encodeTextMeta(0x06, marker.text) });
  }

  for (const note of notes) {
    const channel = (note.channel ?? 0) & 0x0f;
    const velocity = note.velocity ?? 96;
    allEvents.push({
      tick: note.startTick,
      order: 4,
      data: [0x90 | channel, note.pitch & 0x7f, velocity & 0x7f],
    });
    allEvents.push({
      tick: note.startTick + note.durationTicks,
      order: 3, // note-offs precede note-ons at the same tick
      data: [0x80 | channel, note.pitch & 0x7f, 0],
    });
  }

  allEvents.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const trackData: number[] = [];
  let currentTick = 0;
  for (const event of allEvents) {
    trackData.push(...encodeVariableLength(event.tick - currentTick));
    currentTick = event.tick;
    trackData.push(...event.data);
  }
  trackData.push(...encodeVariableLength(0), 0xff, 0x2f, 0x00); // end of track

  const trackLength = trackData.length;
  return new Uint8Array([
    ...createMIDIHeader(0, ticksPerBeat),
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    (trackLength >> 24) & 0xff,
    (trackLength >> 16) & 0xff,
    (trackLength >> 8) & 0xff,
    trackLength & 0xff,
    ...trackData,
  ]);
}
