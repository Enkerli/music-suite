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
 * suite's bit-order conventions govern our own notation, not external
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

export interface MidiController {
  tick: number;
  /** Controller number 0–127 (e.g. 2 = breath). */
  controller: number;
  /** 0–127. */
  value: number;
  /** 0–15, default 0. */
  channel?: number;
}

export interface SmfOptions {
  bpm?: number;
  ticksPerBeat?: number;
  trackName?: string;
  /** DAW-visible marker meta events (0x06; e.g. chord symbols per bar). */
  markers?: MidiMarker[];
  /** Text meta events (0x01; e.g. embedded MCURATOR JSON payloads). */
  textEvents?: MidiMarker[];
  /** Control-change events (e.g. CC2 breath curves — wind articulation).
   *  At equal ticks they land after note-offs, before note-ons, so breath
   *  precedes the note it fuels (Vane's wind-model contract). */
  controllers?: MidiController[];
}

/** Build a single-track (format 0) Standard MIDI File. */
export function createSMF(notes: MidiNote[], options: SmfOptions = {}): Uint8Array {
  const { bpm = 120, ticksPerBeat = 480, trackName, markers = [], textEvents = [], controllers = [] } = options;

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
  for (const ev of textEvents) {
    allEvents.push({ tick: ev.tick, order: 1, data: encodeTextMeta(0x01, ev.text) });
  }
  for (const marker of markers) {
    allEvents.push({ tick: marker.tick, order: 2, data: encodeTextMeta(0x06, marker.text) });
  }
  for (const cc of controllers) {
    allEvents.push({
      tick: cc.tick,
      order: 3.5, // after note-offs, before note-ons: breath precedes its note
      data: [0xb0 | ((cc.channel ?? 0) & 0x0f), cc.controller & 0x7f, Math.max(0, Math.min(127, Math.round(cc.value)))],
    });
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

// ── Reading: extract text-family meta events (for embedded payloads) ─────

/** A text-family meta event recovered from an SMF. */
export interface MetaTextEvent {
  tick: number;
  /** 0x01 text · 0x03 track name · 0x06 marker. */
  metaType: number;
  text: string;
}

/**
 * Minimal SMF walker that recovers text(0x01), track-name(0x03) and
 * marker(0x06) meta events with their absolute ticks. Skips notes and
 * other events (handles running status); enough to read back embedded
 * MCURATOR/leadsheet payloads without a full MIDI parser.
 */
export function readMetaTextEvents(bytes: Uint8Array): MetaTextEvent[] {
  const out: MetaTextEvent[] = [];
  const decoder = new TextDecoder();
  let p = 0;
  const u32 = () => ((bytes[p++]! << 24) | (bytes[p++]! << 16) | (bytes[p++]! << 8) | bytes[p++]!) >>> 0;

  if (bytes.length < 14) return out;
  p = 8 + 6; // skip "MThd" + length(6) + format/tracks/division (6 bytes)

  while (p + 8 <= bytes.length) {
    const chunkId = decoder.decode(bytes.subarray(p, p + 4));
    p += 4;
    const len = u32();
    const end = p + len;
    if (chunkId !== "MTrk") { p = end; continue; }

    let tick = 0;
    let lastStatus = 0;
    while (p < end) {
      let delta = 0;
      let b: number;
      do { b = bytes[p++]!; delta = (delta << 7) | (b & 0x7f); } while (b & 0x80);
      tick += delta;

      let status = bytes[p]!;
      if (status & 0x80) p++; else status = lastStatus; // running status
      if (status !== 0xff && status !== 0xf0 && status !== 0xf7) lastStatus = status;

      if (status === 0xff) {
        const metaType = bytes[p++]!;
        let mlen = 0;
        do { b = bytes[p++]!; mlen = (mlen << 7) | (b & 0x7f); } while (b & 0x80);
        const data = bytes.subarray(p, p + mlen);
        p += mlen;
        if (metaType === 0x01 || metaType === 0x03 || metaType === 0x06) {
          out.push({ tick, metaType, text: decoder.decode(data) });
        }
        if (metaType === 0x2f) break; // end of track
      } else if (status === 0xf0 || status === 0xf7) {
        let slen = 0;
        do { b = bytes[p++]!; slen = (slen << 7) | (b & 0x7f); } while (b & 0x80);
        p += slen;
      } else {
        const hi = status & 0xf0;
        p += (hi === 0xc0 || hi === 0xd0) ? 1 : 2; // 1 data byte for program/aftertouch, else 2
      }
    }
    p = end;
  }
  return out;
}

/** A note read back from an SMF, with its channel (readSmfNotes). */
export interface SmfNote extends MidiNote {
  channel: number;
}

export interface SmfNotesResult {
  /** The file's division (ticks per quarter note). */
  ticksPerBeat: number;
  /** All notes across all tracks, onset-ordered. */
  notes: SmfNote[];
}

/**
 * Read every note (on/off paired, running status honored) out of a Standard
 * MIDI File — the ingestion half of the codec (createSMF is the writing
 * half). Enough for corpus work: `msuite style learn` feeds clips through
 * this into extractPhrase/learnStyleModel. Unclosed notes get a beat's
 * duration rather than being dropped (real-world clips end mid-note).
 */
export function readSmfNotes(bytes: Uint8Array): SmfNotesResult {
  const notes: SmfNote[] = [];
  let p = 0;
  const u16 = () => ((bytes[p++]! << 8) | bytes[p++]!) >>> 0;
  const u32 = () => ((bytes[p++]! << 24) | (bytes[p++]! << 16) | (bytes[p++]! << 8) | bytes[p++]!) >>> 0;

  if (bytes.length < 14) return { ticksPerBeat: 480, notes };
  p = 8; // past "MThd" + length
  /* format */ u16();
  /* tracks */ u16();
  const division = u16();
  const ticksPerBeat = (division & 0x8000) ? 480 : (division || 480); // SMPTE division: bail to 480

  while (p + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
    p += 4;
    const len = u32();
    const end = p + len;
    if (chunkId !== "MTrk") { p = end; continue; }

    let tick = 0;
    let lastStatus = 0;
    // key = channel<<8 | pitch → { startTick, velocity } for open notes
    const open = new Map<number, { startTick: number; velocity: number }>();
    while (p < end) {
      let delta = 0;
      let b: number;
      do { b = bytes[p++]!; delta = (delta << 7) | (b & 0x7f); } while (b & 0x80);
      tick += delta;

      let status = bytes[p]!;
      if (status & 0x80) p++; else status = lastStatus; // running status
      if (status !== 0xff && status !== 0xf0 && status !== 0xf7) lastStatus = status;

      if (status === 0xff) {
        const metaType = bytes[p++]!;
        let mlen = 0;
        do { b = bytes[p++]!; mlen = (mlen << 7) | (b & 0x7f); } while (b & 0x80);
        p += mlen;
        if (metaType === 0x2f) break; // end of track
      } else if (status === 0xf0 || status === 0xf7) {
        let slen = 0;
        do { b = bytes[p++]!; slen = (slen << 7) | (b & 0x7f); } while (b & 0x80);
        p += slen;
      } else {
        const hi = status & 0xf0;
        const channel = (status & 0x0f) + 1;
        if (hi === 0x90 || hi === 0x80) {
          const pitch = bytes[p++]!;
          const velocity = bytes[p++]!;
          const key = (channel << 8) | pitch;
          if (hi === 0x90 && velocity > 0) {
            open.set(key, { startTick: tick, velocity });
          } else {
            const o = open.get(key);
            if (o) {
              open.delete(key);
              notes.push({ pitch, startTick: o.startTick, velocity: o.velocity,
                durationTicks: Math.max(1, tick - o.startTick), channel });
            }
          }
        } else {
          p += (hi === 0xc0 || hi === 0xd0) ? 1 : 2;
        }
      }
    }
    // Unclosed notes: give them a beat rather than dropping them.
    for (const [key, o] of open) {
      notes.push({ pitch: key & 0xff, startTick: o.startTick, velocity: o.velocity,
        durationTicks: ticksPerBeat, channel: key >> 8 });
    }
    p = end;
  }
  notes.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch);
  return { ticksPerBeat, notes };
}

export * from "./leadsheet-smf.js";
