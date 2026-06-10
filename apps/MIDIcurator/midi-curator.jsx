import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// PURE JS ZIP CREATOR (no dependencies)
// ============================================================================

function createZip(files) {
  // files = [{ name: 'file.mid', data: Uint8Array }, ...]
  
  const centralDirectory = [];
  const fileData = [];
  let offset = 0;
  
  for (const file of files) {
    const filename = new TextEncoder().encode(file.name);
    const data = file.data;
    
    // Local file header
    const localHeader = new Uint8Array(30 + filename.length);
    const localView = new DataView(localHeader.buffer);
    
    localView.setUint32(0, 0x04034b50, true); // signature
    localView.setUint16(4, 20, true); // version needed
    localView.setUint16(6, 0, true); // flags
    localView.setUint16(8, 0, true); // compression (none)
    localView.setUint16(10, 0, true); // time
    localView.setUint16(12, 0, true); // date
    localView.setUint32(14, crc32(data), true); // crc32
    localView.setUint32(18, data.length, true); // compressed size
    localView.setUint32(22, data.length, true); // uncompressed size
    localView.setUint16(26, filename.length, true); // filename length
    localView.setUint16(28, 0, true); // extra field length
    
    localHeader.set(filename, 30);
    
    fileData.push(localHeader);
    fileData.push(data);
    
    // Central directory header
    const cdHeader = new Uint8Array(46 + filename.length);
    const cdView = new DataView(cdHeader.buffer);
    
    cdView.setUint32(0, 0x02014b50, true); // signature
    cdView.setUint16(4, 20, true); // version made by
    cdView.setUint16(6, 20, true); // version needed
    cdView.setUint16(8, 0, true); // flags
    cdView.setUint16(10, 0, true); // compression
    cdView.setUint16(12, 0, true); // time
    cdView.setUint16(14, 0, true); // date
    cdView.setUint32(16, crc32(data), true); // crc32
    cdView.setUint32(20, data.length, true); // compressed size
    cdView.setUint32(24, data.length, true); // uncompressed size
    cdView.setUint16(28, filename.length, true); // filename length
    cdView.setUint16(30, 0, true); // extra field length
    cdView.setUint16(32, 0, true); // comment length
    cdView.setUint16(34, 0, true); // disk number
    cdView.setUint16(36, 0, true); // internal attributes
    cdView.setUint32(38, 0, true); // external attributes
    cdView.setUint32(42, offset, true); // relative offset
    
    cdHeader.set(filename, 46);
    
    centralDirectory.push(cdHeader);
    offset += localHeader.length + data.length;
  }
  
  // End of central directory
  const cdSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // central directory disk
  eocdView.setUint16(8, files.length, true); // entries on this disk
  eocdView.setUint16(10, files.length, true); // total entries
  eocdView.setUint32(12, cdSize, true); // central directory size
  eocdView.setUint32(16, offset, true); // central directory offset
  eocdView.setUint16(20, 0, true); // comment length
  
  // Combine everything
  const totalSize = fileData.reduce((sum, d) => sum + d.length, 0) + cdSize + eocd.length;
  const zip = new Uint8Array(totalSize);
  
  let pos = 0;
  for (const data of fileData) {
    zip.set(data, pos);
    pos += data.length;
  }
  for (const cd of centralDirectory) {
    zip.set(cd, pos);
    pos += cd.length;
  }
  zip.set(eocd, pos);
  
  return zip;
}

function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================================
// MIDI PARSING (Pure JavaScript - no dependencies needed)
// ============================================================================

function parseMIDI(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  let offset = 0;

  // Read header chunk
  const headerType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
  offset += 4;
  
  if (headerType !== 'MThd') {
    throw new Error('Not a valid MIDI file');
  }

  const headerLength = view.getUint32(offset);
  offset += 4;
  
  const format = view.getUint16(offset);
  offset += 2;
  
  const trackCount = view.getUint16(offset);
  offset += 2;
  
  const division = view.getUint16(offset);
  offset += 2;

  let ticksPerBeat;
  if (division & 0x8000) {
    // SMPTE format (negative division)
    console.warn('SMPTE format MIDI not fully supported');
    ticksPerBeat = 480; // fallback
  } else {
    // Ticks per beat format
    ticksPerBeat = division;
  }

  // Read tracks
  const tracks = [];
  for (let i = 0; i < trackCount; i++) {
    const trackType = String.fromCharCode(...new Uint8Array(arrayBuffer, offset, 4));
    offset += 4;
    
    if (trackType !== 'MTrk') {
      throw new Error('Invalid track header');
    }
    
    const trackLength = view.getUint32(offset);
    offset += 4;
    
    const trackData = new Uint8Array(arrayBuffer, offset, trackLength);
    tracks.push(parseTrack(trackData));
    
    offset += trackLength;
  }

  return { ticksPerBeat, tracks };
}

function parseTrack(data) {
  const events = [];
  let offset = 0;
  let runningStatus = 0;

  while (offset < data.length) {
    // Read variable-length delta time
    let delta = 0;
    let byte;
    do {
      byte = data[offset++];
      delta = (delta << 7) | (byte & 0x7F);
    } while (byte & 0x80);

    // Read event
    let status = data[offset];
    
    if (status < 0x80) {
      // Running status
      status = runningStatus;
    } else {
      offset++;
      runningStatus = status;
    }

    const type = status & 0xF0;
    const channel = status & 0x0F;

    if (type === 0x90) {
      // Note On
      const note = data[offset++];
      const velocity = data[offset++];
      events.push({ delta, type: 'noteOn', note, velocity, channel });
    } else if (type === 0x80) {
      // Note Off
      const note = data[offset++];
      const velocity = data[offset++];
      events.push({ delta, type: 'noteOff', note, velocity, channel });
    } else if (type === 0xFF) {
      // Meta event
      const metaType = data[offset++];
      let length = 0;
      let byte;
      do {
        byte = data[offset++];
        length = (length << 7) | (byte & 0x7F);
      } while (byte & 0x80);
      
      const metaData = data.slice(offset, offset + length);
      offset += length;
      
      if (metaType === 0x51) {
        // Set Tempo
        const microsecondsPerBeat = (metaData[0] << 16) | (metaData[1] << 8) | metaData[2];
        const bpm = Math.round(60000000 / microsecondsPerBeat);
        events.push({ delta, type: 'tempo', bpm });
      }
    } else {
      // Skip other events
      if (type === 0xC0 || type === 0xD0) {
        offset += 1;
      } else if (type === 0xB0 || type === 0xE0 || type === 0xA0) {
        offset += 2;
      }
    }
  }

  return events;
}

function extractNotes(midiData) {
  const notes = [];
  const activeNotes = new Map();
  
  for (const track of midiData.tracks) {
    let currentTick = 0;
    
    for (const event of track) {
      currentTick += event.delta;
      
      if (event.type === 'noteOn' && event.velocity > 0) {
        const key = `${event.note}-${event.channel}`;
        activeNotes.set(key, { tick: currentTick, velocity: event.velocity, note: event.note });
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        const key = `${event.note}-${event.channel}`;
        const noteOn = activeNotes.get(key);
        if (noteOn) {
          notes.push({
            midi: noteOn.note,
            ticks: noteOn.tick,
            durationTicks: currentTick - noteOn.tick,
            velocity: noteOn.velocity,
          });
          activeNotes.delete(key);
        }
      }
    }
  }
  
  return notes.sort((a, b) => a.ticks - b.ticks);
}

function extractBPM(midiData) {
  for (const track of midiData.tracks) {
    for (const event of track) {
      if (event.type === 'tempo') {
        return event.bpm;
      }
    }
  }
  return 120;
}

// ============================================================================
// INDEXEDDB STORAGE
// ============================================================================

class MidiDB {
  constructor() {
    this.dbName = 'MidiCurator';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('clips')) {
          const clipStore = db.createObjectStore('clips', { keyPath: 'id' });
          clipStore.createIndex('filename', 'filename', { unique: false });
          clipStore.createIndex('imported_at', 'imported_at', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('tags')) {
          const tagStore = db.createObjectStore('tags', { keyPath: ['clipId', 'tag'] });
          tagStore.createIndex('clipId', 'clipId', { unique: false });
          tagStore.createIndex('tag', 'tag', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('buckets')) {
          db.createObjectStore('buckets', { keyPath: 'id' });
        }
      };
    });
  }

  async addClip(clip) {
    const tx = this.db.transaction(['clips'], 'readwrite');
    const store = tx.objectStore('clips');
    await store.add(clip);
    return tx.complete;
  }

  async getAllClips() {
    const tx = this.db.transaction(['clips'], 'readonly');
    const store = tx.objectStore('clips');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getClip(id) {
    const tx = this.db.transaction(['clips'], 'readonly');
    const store = tx.objectStore('clips');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateClip(clip) {
    const tx = this.db.transaction(['clips'], 'readwrite');
    const store = tx.objectStore('clips');
    await store.put(clip);
    return tx.complete;
  }

  async deleteClip(id) {
    const tx = this.db.transaction(['clips', 'tags'], 'readwrite');
    await tx.objectStore('clips').delete(id);
    
    // Delete associated tags
    const tagStore = tx.objectStore('tags');
    const index = tagStore.index('clipId');
    const tags = await new Promise((resolve) => {
      const req = index.getAllKeys(IDBKeyRange.only(id));
      req.onsuccess = () => resolve(req.result);
    });
    
    for (const key of tags) {
      await tagStore.delete(key);
    }
    
    return tx.complete;
  }

  async addTag(clipId, tag) {
    const tx = this.db.transaction(['tags'], 'readwrite');
    const store = tx.objectStore('tags');
    await store.put({ clipId, tag, added_at: Date.now() });
    return tx.complete;
  }

  async getClipTags(clipId) {
    const tx = this.db.transaction(['tags'], 'readonly');
    const store = tx.objectStore('tags');
    const index = store.index('clipId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(clipId));
      request.onsuccess = () => resolve(request.result.map(t => t.tag));
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================================================
// GESTURE EXTRACTION & FEATURES
// ============================================================================

function extractGesture(notes, ticksPerBeat) {
  const onsets = notes.map(n => n.ticks);
  const durations = notes.map(n => n.durationTicks);
  const velocities = notes.map(n => n.velocity);
  
  const ticksPerBar = ticksPerBeat * 4; // Assume 4/4
  const lastTick = Math.max(...notes.map(n => n.ticks + n.durationTicks));
  const numBars = Math.ceil(lastTick / ticksPerBar);
  
  const totalBeats = numBars * 4;
  const density = notes.length / totalBeats;
  
  const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  
  const syncopationScore = computeSyncopation(onsets, ticksPerBeat, ticksPerBar);
  
  return {
    onsets,
    durations,
    velocities,
    density,
    syncopation_score: syncopationScore,
    avg_velocity: avgVelocity,
    velocity_variance: velocityVariance,
    avg_duration: avgDuration,
    num_bars: numBars,
    ticks_per_bar: ticksPerBar,
    ticks_per_beat: ticksPerBeat, // Store original!
  };
}

function computeSyncopation(onsets, ticksPerBeat, ticksPerBar) {
  let score = 0;
  
  for (const onset of onsets) {
    const posInBar = onset % ticksPerBar;
    const posInBeat = posInBar % ticksPerBeat;
    
    if (posInBeat === 0) {
      const beatNum = Math.floor(posInBar / ticksPerBeat);
      score += beatNum === 0 ? 0 : 0.3;
    } else {
      score += posInBeat / ticksPerBeat;
    }
  }
  
  return onsets.length > 0 ? score / onsets.length : 0;
}

function extractHarmonic(notes) {
  const pitches = notes.map(n => n.midi);
  const pitchClasses = pitches.map(p => p % 12);
  
  return { pitches, pitchClasses };
}

// ============================================================================
// TRANSFORM GENERATOR
// ============================================================================

function transformGesture(gesture, harmonic, params = {}) {
  let onsets = [...gesture.onsets];
  let durations = [...gesture.durations];
  let velocities = [...gesture.velocities];
  let pitches = [...harmonic.pitches];
  
  // Density adjustment
  if (params.densityMultiplier && params.densityMultiplier !== 1.0) {
    const targetCount = Math.round(onsets.length * params.densityMultiplier);
    
    if (targetCount < onsets.length) {
      // Remove notes (keep highest velocity)
      const indices = onsets
        .map((onset, i) => ({ onset, i, vel: velocities[i] }))
        .sort((a, b) => b.vel - a.vel)
        .slice(0, targetCount)
        .map(item => item.i)
        .sort((a, b) => a - b);
      
      onsets = indices.map(i => onsets[i]);
      durations = indices.map(i => durations[i]);
      velocities = indices.map(i => velocities[i]);
      pitches = indices.map(i => pitches[i]); // Match pitches to gesture!
    } else if (targetCount > onsets.length) {
      // Add notes (interpolate)
      const toAdd = targetCount - onsets.length;
      for (let n = 0; n < toAdd; n++) {
        const i = Math.floor(Math.random() * (onsets.length - 1));
        const newOnset = Math.round((onsets[i] + onsets[i + 1]) / 2);
        const newDur = Math.round((durations[i] + durations[i + 1]) / 2);
        const newVel = Math.round((velocities[i] + velocities[i + 1]) / 2);
        const newPitch = pitches[i]; // Use same pitch as reference note
        
        onsets.push(newOnset);
        durations.push(newDur);
        velocities.push(newVel);
        pitches.push(newPitch);
      }
      
      // Re-sort
      const combined = onsets.map((onset, i) => ({ 
        onset, 
        duration: durations[i], 
        velocity: velocities[i],
        pitch: pitches[i]
      })).sort((a, b) => a.onset - b.onset);
      
      onsets = combined.map(n => n.onset);
      durations = combined.map(n => n.duration);
      velocities = combined.map(n => n.velocity);
      pitches = combined.map(n => n.pitch);
    }
  }
  
  // Quantize
  if (params.quantizeStrength) {
    const ticksPerSixteenth = gesture.ticks_per_bar / 16;
    onsets = onsets.map(onset => {
      const quantized = Math.round(onset / ticksPerSixteenth) * ticksPerSixteenth;
      return Math.round(onset + (quantized - onset) * params.quantizeStrength);
    });
  }
  
  // Velocity scaling
  if (params.velocityScale && params.velocityScale !== 1.0) {
    const avg = velocities.reduce((a, b) => a + b) / velocities.length;
    velocities = velocities.map(v => {
      const offset = v - avg;
      return Math.max(1, Math.min(127, avg + offset * params.velocityScale));
    });
  }
  
  // Recompute features
  const totalBeats = gesture.num_bars * 4;
  const density = onsets.length / totalBeats;
  const avgVelocity = velocities.reduce((a, b) => a + b) / velocities.length;
  const velocityVariance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVelocity, 2), 0) / velocities.length;
  const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
  
  const newGesture = {
    onsets,
    durations,
    velocities,
    density,
    syncopation_score: computeSyncopation(onsets, gesture.ticks_per_bar / 4, gesture.ticks_per_bar),
    avg_velocity: avgVelocity,
    velocity_variance: velocityVariance,
    avg_duration: avgDuration,
    num_bars: gesture.num_bars,
    ticks_per_bar: gesture.ticks_per_bar,
    ticks_per_beat: gesture.ticks_per_beat, // Preserve original!
  };
  
  const newHarmonic = {
    pitches,
    pitchClasses: pitches.map(p => p % 12),
  };
  
  return { gesture: newGesture, harmonic: newHarmonic };
}

// ============================================================================
// MIDI EXPORT
// ============================================================================

function createMIDI(gesture, harmonic, bpm) {
  // Use the original file's ticks per beat!
  const ticksPerBeat = gesture.ticks_per_beat || 480;
  
  // Create MIDI file structure
  const header = createMIDIHeader(1, ticksPerBeat);
  const track = createMIDITrack(gesture, harmonic, bpm, ticksPerBeat);
  
  return new Uint8Array([...header, ...track]);
}

function createMIDIHeader(format, ticksPerBeat) {
  const header = [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
    0x00, format,           // Format type
    0x00, 0x01,             // Number of tracks
    (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF, // Ticks per beat
  ];
  return header;
}

function createMIDITrack(gesture, harmonic, bpm, ticksPerBeat) {
  const events = [];
  
  // Set tempo event
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  events.push({
    delta: 0,
    data: [
      0xFF, 0x51, 0x03, // Meta event: Set Tempo
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF,
    ],
  });
  
  // Create note events
  const noteEvents = [];
  for (let i = 0; i < gesture.onsets.length; i++) {
    noteEvents.push({
      tick: gesture.onsets[i],
      type: 'on',
      note: harmonic.pitches[i],
      velocity: gesture.velocities[i],
    });
    noteEvents.push({
      tick: gesture.onsets[i] + gesture.durations[i],
      type: 'off',
      note: harmonic.pitches[i],
      velocity: 0,
    });
  }
  
  // Sort by tick
  noteEvents.sort((a, b) => a.tick - b.tick);
  
  // Convert to delta times
  let currentTick = 0;
  for (const event of noteEvents) {
    const delta = event.tick - currentTick;
    currentTick = event.tick;
    
    const status = event.type === 'on' ? 0x90 : 0x80; // Note on/off, channel 0
    events.push({
      delta,
      data: [status, event.note, event.velocity],
    });
  }
  
  // End of track
  events.push({
    delta: 0,
    data: [0xFF, 0x2F, 0x00],
  });
  
  // Encode events
  const trackData = [];
  for (const event of events) {
    trackData.push(...encodeVariableLength(event.delta));
    trackData.push(...event.data);
  }
  
  // Create track chunk
  const trackLength = trackData.length;
  const track = [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (trackLength >> 24) & 0xFF,
    (trackLength >> 16) & 0xFF,
    (trackLength >> 8) & 0xFF,
    trackLength & 0xFF,
    ...trackData,
  ];
  
  return track;
}

function encodeVariableLength(value) {
  const bytes = [];
  bytes.push(value & 0x7F);
  
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  
  return bytes;
}

function downloadMIDI(clip) {
  const midiData = createMIDI(clip.gesture, clip.harmonic, clip.bpm);
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = clip.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllClips(clips) {
  clips.forEach(clip => {
    setTimeout(() => downloadMIDI(clip), 100 * clips.indexOf(clip));
  });
}

async function downloadVariantsAsZip(variants, sourceFilename) {
  const files = [];
  
  for (const variant of variants) {
    const midiData = createMIDI(variant.gesture, variant.harmonic, variant.bpm);
    
    // Use actual density value
    const actualDensity = variant.gesture.density.toFixed(2);
    
    // Create filename with density
    const baseName = sourceFilename.replace(/\.mid$/i, '');
    const filename = `${baseName}_d${actualDensity}.mid`;
    
    files.push({ name: filename, data: midiData });
  }
  
  // Generate zip
  const zipData = createZip(files);
  const blob = new Blob([zipData], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sourceFilename.replace(/\.mid$/i, '')}_variants.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// MAIN REACT APP
// ============================================================================

export default function MidiCurator() {
  const [db, setDb] = useState(null);
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [tags, setTags] = useState([]);
  const [filterTag, setFilterTag] = useState('');
  const [newTag, setNewTag] = useState('');
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmValue, setBpmValue] = useState('');
  const [densityMultiplier, setDensityMultiplier] = useState(1.0);
  const fileInputRef = useRef(null);

  const deleteClip = useCallback(async () => {
    if (!selectedClip || !db) return;
    if (confirm(`Delete "${selectedClip.filename}"?`)) {
      await db.deleteClip(selectedClip.id);
      setSelectedClip(null);
      setTags([]);
      loadClips(db);
    }
  }, [selectedClip, db]);

  const generateVariants = useCallback(async () => {
    if (!selectedClip || !db) return;
    
    const numVariants = 5;
    const densityOptions = [0.5, 0.75, 1.0, 1.25, 1.5];
    
    for (let i = 0; i < numVariants; i++) {
      const densityMult = densityOptions[i % densityOptions.length];
      const { gesture: transformed, harmonic: transformedHarmonic } = transformGesture(
        selectedClip.gesture, 
        selectedClip.harmonic,
        {
          densityMultiplier: densityMult,
          quantizeStrength: 0.5,
          velocityScale: 1.0,
        }
      );
      
      const actualDensity = transformed.density.toFixed(2);
      
      const variant = {
        id: crypto.randomUUID(),
        filename: `${selectedClip.filename.replace('.mid', '')}_d${actualDensity}.mid`,
        imported_at: Date.now(),
        bpm: selectedClip.bpm,
        gesture: transformed,
        harmonic: transformedHarmonic,
        rating: null,
        notes: `Generated from ${selectedClip.filename} (density: ${densityMult}x, actual: ${actualDensity})`,
        source: selectedClip.id,
      };
      
      await db.addClip(variant);
    }
    
    loadClips(db);
  }, [selectedClip, db]);

  const generateSingleVariant = useCallback(async () => {
    if (!selectedClip || !db) return;
    
    const { gesture: transformed, harmonic: transformedHarmonic } = transformGesture(
      selectedClip.gesture, 
      selectedClip.harmonic,
      {
        densityMultiplier: densityMultiplier,
        quantizeStrength: 0.5,
        velocityScale: 1.0,
      }
    );
    
    const actualDensity = transformed.density.toFixed(2);
    
    const variant = {
      id: crypto.randomUUID(),
      filename: `${selectedClip.filename.replace('.mid', '')}_d${actualDensity}.mid`,
      imported_at: Date.now(),
      bpm: selectedClip.bpm,
      gesture: transformed,
      harmonic: transformedHarmonic,
      rating: null,
      notes: `Generated from ${selectedClip.filename} (density: ${densityMultiplier.toFixed(2)}x, actual: ${actualDensity})`,
      source: selectedClip.id,
    };
    
    await db.addClip(variant);
    loadClips(db);
  }, [selectedClip, db, densityMultiplier]);

  useEffect(() => {
    const initDb = async () => {
      const database = new MidiDB();
      await database.init();
      setDb(database);
      loadClips(database);
    };
    initDb();
  }, []);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyPress = (e) => {
      if (!selectedClip) return;
      
      // D - Download current clip
      if (e.key === 'd' && !e.target.matches('input')) {
        e.preventDefault();
        downloadMIDI(selectedClip);
      }
      
      // G - Generate variants
      if (e.key === 'g' && !e.target.matches('input')) {
        e.preventDefault();
        generateVariants();
      }
      
      // V - Generate single variant with current density
      if (e.key === 'v' && !e.target.matches('input')) {
        e.preventDefault();
        generateSingleVariant();
      }
      
      // Delete - Delete clip
      if (e.key === 'Delete' || (e.key === 'Backspace' && !e.target.matches('input'))) {
        e.preventDefault();
        deleteClip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedClip, generateVariants, generateSingleVariant, deleteClip]);

  const loadClips = async (database) => {
    const allClips = await database.getAllClips();
    setClips(allClips.sort((a, b) => b.imported_at - a.imported_at));
  };

  const handleFileUpload = async (files) => {
    if (!db) return;
    
    for (const file of files) {
      if (file.name.match(/\.mid$/i)) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const midiData = parseMIDI(arrayBuffer);
          const notes = extractNotes(midiData);
          
          if (notes.length === 0) continue;
          
          // Try to extract BPM from filename first (more reliable than tempo events)
          let bpm = null;
          const bpmMatch = file.name.match(/(\d+)[-_\s]?bpm/i);
          if (bpmMatch) {
            bpm = parseInt(bpmMatch[1]);
          }
          
          // Fall back to tempo events
          if (!bpm) {
            bpm = extractBPM(midiData);
          }
          
          const gesture = extractGesture(notes, midiData.ticksPerBeat);
          const harmonic = extractHarmonic(notes);
          
          const clip = {
            id: crypto.randomUUID(),
            filename: file.name,
            imported_at: Date.now(),
            bpm,
            gesture,
            harmonic,
            rating: null,
            notes: '',
          };
          
          await db.addClip(clip);
        } catch (error) {
          console.error('Error importing', file.name, error);
        }
      }
    }
    
    loadClips(db);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleFileUpload(files);
  };

  const selectClip = async (clip) => {
    setSelectedClip(clip);
    setBpmValue(clip.bpm.toString());
    setEditingBpm(false);
    const clipTags = await db.getClipTags(clip.id);
    setTags(clipTags);
  };

  const saveBpm = async () => {
    if (!selectedClip || !db) return;
    const newBpm = parseInt(bpmValue);
    if (isNaN(newBpm) || newBpm < 1 || newBpm > 999) return;
    
    const updated = { ...selectedClip, bpm: newBpm };
    await db.updateClip(updated);
    setSelectedClip(updated);
    setEditingBpm(false);
    loadClips(db);
  };

  const addTag = async () => {
    if (!selectedClip || !newTag.trim()) return;
    await db.addTag(selectedClip.id, newTag.trim());
    setTags([...tags, newTag.trim()]);
    setNewTag('');
  };

  const filteredClips = filterTag
    ? clips.filter(c => c.filename.toLowerCase().includes(filterTag.toLowerCase()))
    : clips;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui', background: '#1a1a1a', color: '#e0e0e0' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 300, background: '#202020', borderRight: '1px solid #333', padding: 20, overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>MIDI Curator</h2>
        
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '2px dashed #444',
            borderRadius: 8,
            padding: 30,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 20,
            background: '#252525',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: 14, color: '#888' }}>Drop MIDI files here</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 5 }}>or click to browse</div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mid,.midi"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />
        </div>

        <input
          type="text"
          placeholder="Filter clips..."
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          style={{
            width: '100%',
            padding: 8,
            background: '#252525',
            border: '1px solid #333',
            borderRadius: 4,
            color: '#e0e0e0',
            marginBottom: 15,
          }}
        />

        <div style={{ fontSize: 12, color: '#666', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{filteredClips.length} clips</span>
          {filteredClips.length > 0 && (
            <button
              onClick={() => downloadAllClips(filteredClips)}
              style={{
                padding: '4px 10px',
                background: '#2a6a4a',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Download All
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredClips.map(clip => (
            <div
              key={clip.id}
              onClick={() => selectClip(clip)}
              style={{
                padding: 10,
                background: selectedClip?.id === clip.id ? '#2a4a6a' : '#252525',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                border: selectedClip?.id === clip.id ? '1px solid #4a7a9a' : '1px solid #333',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                {clip.filename}
                {clip.source && <span style={{ fontSize: 10, color: '#6a9aba', marginLeft: 6 }}>●</span>}
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {clip.bpm} BPM • {clip.gesture.density.toFixed(1)} density
                {clip.notes && clip.notes.includes('density:') && (
                  <span style={{ color: '#6a9aba', marginLeft: 6 }}>
                    ({clip.notes.match(/density: ([\d.]+)x/)?.[1]}x)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 30, overflowY: 'auto' }}>
        {selectedClip ? (
          <>
            <h1 style={{ fontSize: 24, marginBottom: 20 }}>{selectedClip.filename}</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20, marginBottom: 30 }}>
              <div style={{ background: '#252525', padding: 15, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>BPM</div>
                {editingBpm ? (
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={bpmValue}
                      onChange={(e) => setBpmValue(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && saveBpm()}
                      autoFocus
                      style={{
                        width: 60,
                        padding: 4,
                        background: '#1a1a1a',
                        border: '1px solid #4a7a9a',
                        borderRadius: 4,
                        color: '#e0e0e0',
                        fontSize: 16,
                      }}
                    />
                    <button
                      onClick={saveBpm}
                      style={{
                        padding: '4px 8px',
                        background: '#2a6a4a',
                        border: 'none',
                        borderRadius: 4,
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => setEditingBpm(true)}
                    style={{ 
                      fontSize: 20, 
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {selectedClip.bpm}
                    <span style={{ fontSize: 12, color: '#666' }}>✎</span>
                  </div>
                )}
              </div>
              <div style={{ background: '#252525', padding: 15, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Notes</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedClip.gesture.onsets.length}</div>
              </div>
              <div style={{ background: '#252525', padding: 15, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Density</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedClip.gesture.density.toFixed(2)}</div>
              </div>
              <div style={{ background: '#252525', padding: 15, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 5 }}>Syncopation</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedClip.gesture.syncopation_score.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ padding: 15, background: '#252525', borderRadius: 8, marginBottom: 20, fontSize: 12, color: '#888' }}>
              <div style={{ marginBottom: 8 }}><strong style={{ color: '#aaa' }}>Timing Debug Info:</strong></div>
              <div>Ticks per beat: <strong style={{ color: '#6a9aba' }}>{selectedClip.gesture.ticks_per_beat || 'not stored'}</strong></div>
              <div>Ticks per bar: {selectedClip.gesture.ticks_per_bar}</div>
              <div>Bars: {selectedClip.gesture.num_bars}</div>
              <div>BPM: <strong style={{ color: '#6a9aba' }}>{selectedClip.bpm}</strong> 
                {selectedClip.filename.match(/(\d+)[-_\s]?bpm/i) && (
                  <span style={{ color: '#6a9a6a', marginLeft: 5 }}>(from filename)</span>
                )}
              </div>
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333' }}>
                First note: tick {selectedClip.gesture.onsets[0]}, pitch {selectedClip.harmonic.pitches[0]}
              </div>
              <div>Last note: tick {selectedClip.gesture.onsets[selectedClip.gesture.onsets.length - 1]}</div>
              <div style={{ marginTop: 8, padding: 8, background: '#2a3a2a', borderRadius: 4, color: '#9aba9a' }}>
                💡 Click the BPM value above to edit it if the tempo is wrong
              </div>
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Tags</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '4px 12px',
                      background: '#2a4a6a',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  style={{
                    flex: 1,
                    padding: 8,
                    background: '#252525',
                    border: '1px solid #333',
                    borderRadius: 4,
                    color: '#e0e0e0',
                  }}
                />
                <button
                  onClick={addTag}
                  style={{
                    padding: '8px 16px',
                    background: '#2a6a4a',
                    border: 'none',
                    borderRadius: 4,
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Transform</h3>
              <div style={{ padding: 15, background: '#252525', borderRadius: 8 }}>
                <div style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 8 }}>
                    Density Multiplier: <strong style={{ color: '#6a9aba' }}>{densityMultiplier.toFixed(2)}x</strong>
                  </label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#666' }}>0.25x</span>
                    <input
                      type="range"
                      min="0.25"
                      max="2.0"
                      step="0.05"
                      value={densityMultiplier}
                      onChange={(e) => setDensityMultiplier(parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 11, color: '#666' }}>2.0x</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setDensityMultiplier(preset)}
                        style={{
                          padding: '4px 8px',
                          background: densityMultiplier === preset ? '#4a6a9a' : '#333',
                          border: 'none',
                          borderRadius: 3,
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: 11,
                        }}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  Will create {Math.round(selectedClip.gesture.onsets.length * densityMultiplier)} notes 
                  (from {selectedClip.gesture.onsets.length})
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button
                onClick={generateSingleVariant}
                style={{
                  padding: '12px 24px',
                  background: '#5a7a9a',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Generate 1 Variant
              </button>
              <button
                onClick={generateVariants}
                style={{
                  padding: '12px 24px',
                  background: '#4a6a9a',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Generate 5 Variants
              </button>
              <button
                onClick={() => downloadMIDI(selectedClip)}
                style={{
                  padding: '12px 24px',
                  background: '#2a6a4a',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Download MIDI
              </button>
              <button
                onClick={deleteClip}
                style={{
                  padding: '12px 24px',
                  background: '#6a2a2a',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Delete
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => {
                  const variants = clips.filter(c => c.source === selectedClip.id);
                  if (variants.length > 0) {
                    downloadVariantsAsZip(variants, selectedClip.filename);
                  } else {
                    alert('No variants found for this clip');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#3a5a7a',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Download All Variants as ZIP ({clips.filter(c => c.source === selectedClip.id).length})
              </button>
            </div>

            {selectedClip.source && (
              <div style={{ marginTop: 20, padding: 15, background: '#252525', borderRadius: 8, fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>
                  <strong>Variant of:</strong> {clips.find(c => c.id === selectedClip.source)?.filename || 'unknown'}
                </div>
                {selectedClip.notes && selectedClip.notes.includes('density:') && (
                  <div style={{ color: '#888' }}>
                    Density multiplier: <strong style={{ color: '#6a9aba' }}>
                      {selectedClip.notes.match(/density: ([\d.]+)x/)?.[1]}x
                    </strong>
                  </div>
                )}
                {(() => {
                  const sourceClip = clips.find(c => c.id === selectedClip.source);
                  if (sourceClip) {
                    const noteDiff = selectedClip.gesture.onsets.length - sourceClip.gesture.onsets.length;
                    return (
                      <div style={{ color: '#888', marginTop: 5 }}>
                        Note count: {sourceClip.gesture.onsets.length} → {selectedClip.gesture.onsets.length}
                        <span style={{ color: noteDiff > 0 ? '#6a9a6a' : '#9a6a6a', marginLeft: 8 }}>
                          ({noteDiff > 0 ? '+' : ''}{noteDiff})
                        </span>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: 100, color: '#666' }}>
            <h2 style={{ fontSize: 24, marginBottom: 10 }}>Welcome to MIDI Curator</h2>
            <p>Drop MIDI files to get started, or select a clip from the sidebar.</p>
          </div>
        )}
      </div>
      </div>

      {/* Keyboard shortcuts footer */}
      <div style={{ 
        padding: '10px 20px', 
        background: '#252525', 
        borderTop: '1px solid #333',
        fontSize: 12,
        color: '#888',
        display: 'flex',
        gap: 20,
      }}>
        <span><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: 3 }}>D</kbd> Download</span>
        <span><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: 3 }}>G</kbd> Generate 5</span>
        <span><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: 3 }}>V</kbd> Generate 1</span>
        <span><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: 3 }}>Delete</kbd> Delete clip</span>
        <span style={{ marginLeft: 'auto', color: '#666' }}>All data stored locally in your browser</span>
      </div>
    </div>
  );
}
