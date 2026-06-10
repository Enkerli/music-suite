import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Clip, DetectedChord, Leadsheet, Segmentation, SegmentChordInfo, LoopMeta } from '../types/clip';
import { useDatabase } from '../hooks/useDatabase';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePlayback } from '../hooks/usePlayback';
import { parseMIDI, extractNotes, extractBPM, extractTimeSignature, extractMcuratorSegments } from '../lib/midi-parser';
import { isAppleLoopFile, parseAppleLoop, formatChordTimeline, enrichChordEventsWithMidiRoots, appleLoopEventsToLeadsheet } from '../lib/apple-loops-parser';
import { extractGesture, extractHarmonic, toDetectedChord, getEffectiveBarChords } from '../lib/gesture';
import { transformGesture } from '../lib/transform';
import { synthesizeIntensityDown, synthesizeIntensityUp, fallbackTargets, type IntensityPreset } from '../lib/intensity-synthesis';
import { realizeForChordTransform } from '../lib/chord-substitute';
import { findQualityByKey } from '../lib/chord-dictionary';
import { downloadMIDI, downloadAllAsZip, downloadVariantsAsZip } from '../lib/midi-export';
import { getNotesInTickRange, detectChordBlocks, segmentFromLeadsheet } from '../lib/piano-roll';
import type { TickRange } from '../lib/piano-roll';
import { detectChord, detectChordsForSegments } from '../lib/chord-detect';
import { spliceSegment, isTrivialSegments, removeRestSegments } from '../lib/chord-segments';
import { substituteSegmentPitches } from '../lib/chord-substitute';
import { parseLeadsheet } from '../lib/leadsheet-parser';
import { loadLoopDb, lookupLoopMeta, getLoadedDbFileName, keyTypeLabel, rootPcName, gbLoopTypeLabel } from '../lib/loop-database';
import { PROGRESSIONS, transposeProgression } from '../lib/progressions';
import type { VoicingShape } from '../lib/progressions';
import { generateProgressionClip } from '../lib/generate-clip';
import { Sidebar } from './Sidebar';
import { ClipDetail } from './ClipDetail';
import { KeyboardShortcutsBar } from './KeyboardShortcutsBar';

/**
 * Derive a Segmentation from a leadsheet + gesture, snapping chord boundaries
 * to nearby note events. Returns undefined if the leadsheet yields no internal
 * boundaries (e.g. a single-chord leadsheet with no chord changes).
 * Module-level so it can be called before React hooks are initialised (e.g. at import time).
 */
function computeSegmentationFromLeadsheet(
  gesture: Clip['gesture'],
  harmonic: Clip['harmonic'],
  leadsheet: Leadsheet,
): Segmentation | undefined {
  const { onsets, durations, ticks_per_bar, ticks_per_beat, num_bars } = gesture;
  const totalTicks = num_bars * ticks_per_bar;
  const boundaries = segmentFromLeadsheet(leadsheet, ticks_per_bar, ticks_per_beat, totalTicks, onsets, durations);
  if (boundaries.length === 0) return undefined;
  const segResults = detectChordsForSegments(harmonic.pitches, onsets, durations, boundaries, totalTicks);
  const segmentChords: SegmentChordInfo[] = segResults.map(sr => ({
    index: sr.index,
    startTick: sr.startTick,
    endTick: sr.endTick,
    chord: toDetectedChord(sr.chord),
    pitchClasses: sr.pitchClasses,
  }));
  return { boundaries, segmentChords };
}

/**
 * Read a File as ArrayBuffer.  Falls back to a single retry after 300 ms if
 * the first attempt fails with NotReadableError — this recovers from brief
 * OS-level locks that occasionally affect files that were just downloaded or
 * created (e.g. re-importing a MIDI that was just exported from the app).
 *
 * iCloud-only stubs (not locally present) will fail both attempts and
 * propagate the NotReadableError so the caller can show a useful message.
 */
async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotReadableError') {
      await new Promise(r => setTimeout(r, 300));
      return await file.arrayBuffer();
    }
    throw e;
  }
}

/**
 * Parse a UJAM-style export filename to extract product source, BPM, pattern
 * name and intensity level.
 *
 * Expected format (produced by VP-GRIT, VG-Iron, VB-Dandy etc.):
 *   "{PRODUCT} - {BPM} bpm - {PATTERN NAME} - {INTENSITY} - {TIMESTAMP}.mid"
 *
 * Returns null if the filename doesn't match this structure.
 */
function parseUjamFilename(filename: string): {
  source: string;
  bpm: number | null;
  pattern: string;
  intensity: string;
} | null {
  // Strip .mid extension then split on " - " delimiter
  const name = filename.replace(/\.mid$/i, '');
  const parts = name.split(' - ');
  if (parts.length < 4) return null;

  const source = parts[0]!.trim();
  // Product must look like VP-GRIT, VG-Iron, VB-Dandy (2-letter prefix + hyphen + word)
  if (!/^[A-Z]{2}-\w/i.test(source)) return null;

  // Find the BPM field (e.g. "143 bpm")
  const bpmIdx = parts.findIndex(p => /^\d+\s*bpm$/i.test(p.trim()));
  if (bpmIdx < 1) return null; // must be after the product name

  const bpmVal = parseInt(parts[bpmIdx]!.match(/(\d+)/)![1]!);

  // Collect parts that come after the BPM field
  const after = parts.slice(bpmIdx + 1);
  if (after.length < 2) return null; // need at least pattern + intensity

  // Optional trailing timestamp (≥ 8 consecutive digits)
  let end = after.length;
  if (/^\d{8,}$/.test(after[end - 1]!.trim())) end--;
  if (end < 2) return null;

  // Intensity is the last remaining field (digits + optional letter suffix: "10", "10a")
  const candidateIntensity = after[end - 1]!.trim();
  if (!/^\d+[a-z]?$/i.test(candidateIntensity)) return null;

  const intensity = candidateIntensity;
  const pattern = after.slice(0, end - 1).join(' - ').trim();
  if (!pattern) return null;

  return { source, bpm: isNaN(bpmVal) ? null : bpmVal, pattern, intensity };
}

export function MidiCurator() {
  const { db, clips, tagIndex, refreshClips } = useDatabase();
  const { playbackState, currentTime, play, pause, stop, toggle } = usePlayback();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [newTag, setNewTag] = useState('');
  const [editingBpm, setEditingBpm] = useState(false);
  const [bpmValue, setBpmValue] = useState('');
  const [densityMultiplier, setDensityMultiplier] = useState(1.0);
  const [selectionRange, setSelectionRange] = useState<TickRange | null>(null);
  const [scissorsMode, setScissorsMode] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [loopDbFileName, setLoopDbFileName] = useState<string | null>(null);
  const [loopDbStatus, setLoopDbStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [loopDbEnriched, setLoopDbEnriched] = useState<number>(0);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectClip = useCallback(async (clip: Clip) => {
    // Stop playback when switching clips
    stop();
    setSelectedClip(clip);
    setSelectionRange(null);
    setBpmValue(clip.bpm.toString());
    setEditingBpm(false);
    if (db) {
      const clipTags = await db.getClipTags(clip.id);
      setTags(clipTags);
    }
  }, [db, stop]);

  const saveBpm = useCallback(async () => {
    if (!selectedClip || !db) return;
    const newBpm = parseInt(bpmValue);
    if (isNaN(newBpm) || newBpm < 1 || newBpm > 999) return;

    const updated = { ...selectedClip, bpm: newBpm };
    await db.updateClip(updated);
    setSelectedClip(updated);
    setEditingBpm(false);
    refreshClips();
  }, [selectedClip, db, bpmValue, refreshClips]);

  const addTag = useCallback(async () => {
    if (!selectedClip || !newTag.trim() || !db) return;
    await db.addTag(selectedClip.id, newTag.trim());
    setTags(prev => [...prev, newTag.trim()]);
    setNewTag('');
  }, [selectedClip, newTag, db]);

  const toggleFlag = useCallback(async () => {
    if (!selectedClip || !db) return;
    const updated = { ...selectedClip, flagged: !selectedClip.flagged };
    await db.updateClip(updated);
    setSelectedClip(updated);
    refreshClips();
  }, [selectedClip, db, refreshClips]);

  const deleteClip = useCallback(async () => {
    if (!selectedClip || !db) return;
    if (confirm(`Delete "${selectedClip.filename}"?`)) {
      stop();
      await db.deleteClip(selectedClip.id);
      setSelectedClip(null);
      setTags([]);
      refreshClips();
    }
  }, [selectedClip, db, refreshClips, stop]);

  const generateVariants = useCallback(async () => {
    if (!selectedClip || !db) return;

    const densityOptions = [0.5, 0.75, 1.0, 1.25, 1.5];

    for (let i = 0; i < 5; i++) {
      const densityMult = densityOptions[i]!;
      const { gesture: transformed, harmonic: transformedHarmonic } = transformGesture(
        selectedClip.gesture,
        selectedClip.harmonic,
        { densityMultiplier: densityMult, quantizeStrength: 0.5, velocityScale: 1.0 },
      );

      const actualDensity = transformed.density.toFixed(2);

      const variant: Clip = {
        id: crypto.randomUUID(),
        filename: `${selectedClip.filename.replace('.mid', '')}_d${actualDensity}.mid`,
        imported_at: Date.now(),
        bpm: selectedClip.bpm,
        gesture: transformed,
        harmonic: transformedHarmonic,
        rating: null,
        notes: `Generated from ${selectedClip.filename} (density: ${densityMult}x, actual: ${actualDensity})`,
        source: selectedClip.id,
        sourceFilename: selectedClip.filename,
      };

      await db.addClip(variant);
    }

    refreshClips();
    setAnnouncement('Generated 5 variants with different densities');
  }, [selectedClip, db, refreshClips]);

  const generateSingleVariant = useCallback(async () => {
    if (!selectedClip || !db) return;

    const { gesture: transformed, harmonic: transformedHarmonic } = transformGesture(
      selectedClip.gesture,
      selectedClip.harmonic,
      { densityMultiplier, quantizeStrength: 0.5, velocityScale: 1.0 },
    );

    const actualDensity = transformed.density.toFixed(2);

    const variant: Clip = {
      id: crypto.randomUUID(),
      filename: `${selectedClip.filename.replace('.mid', '')}_d${actualDensity}.mid`,
      imported_at: Date.now(),
      bpm: selectedClip.bpm,
      gesture: transformed,
      harmonic: transformedHarmonic,
      rating: null,
      notes: `Generated from ${selectedClip.filename} (density: ${densityMultiplier.toFixed(2)}x, actual: ${actualDensity})`,
      source: selectedClip.id,
      sourceFilename: selectedClip.filename,
    };

    await db.addClip(variant);
    refreshClips();
    setAnnouncement(`Generated 1 variant with density ${actualDensity}`);
  }, [selectedClip, db, densityMultiplier, refreshClips]);

  /** All clips that share the same VP source + pattern as the selected clip. */
  const vpSiblings = useMemo(() => {
    if (!selectedClip?.vpMeta) return [];
    const { source, pattern } = selectedClip.vpMeta;
    return clips.filter(c =>
      c.id !== selectedClip.id &&
      c.vpMeta?.source === source &&
      c.vpMeta?.pattern === pattern,
    );
  }, [selectedClip, clips]);

  /** Synthesize a lower-intensity variant of the selected VP-intensity-10 clip. */
  const handleSynthesizeIntensity = useCallback(async (targetIntensity: string) => {
    if (!selectedClip?.vpMeta || !db) return;

    const { vpMeta } = selectedClip;
    const sourceIntensity = vpMeta.intensity;
    // Base intensity number (without '-synth' suffix) for numeric comparisons
    const baseSourceIntensity = sourceIntensity.replace(/-synth$/, '');

    // Use sibling at target intensity as reference stats, or fall back to ratios
    const sibling = vpSiblings.find(s => s.vpMeta?.intensity === targetIntensity);
    const { targetNoteCount, targetVelMean } = sibling
      ? { targetNoteCount: sibling.gesture.onsets.length, targetVelMean: sibling.gesture.avg_velocity }
      : fallbackTargets(
          selectedClip.gesture.onsets.length,
          selectedClip.gesture.avg_velocity,
          sourceIntensity,
          targetIntensity,
        );

    const goingUp = parseInt(targetIntensity) > parseInt(baseSourceIntensity);
    const synthesize = goingUp ? synthesizeIntensityUp : synthesizeIntensityDown;
    const { gesture: synthGesture, harmonic: synthHarmonic } = synthesize(
      selectedClip.gesture,
      selectedClip.harmonic,
      targetNoteCount,
      targetVelMean,
    );

    const synthClip: Clip = {
      id: crypto.randomUUID(),
      // Match the base intensity number optionally followed by a "(synth from …)" annotation
      filename: selectedClip.filename.replace(
        new RegExp(`- ${baseSourceIntensity}(?: \\(synth[^)]*\\))? -`),
        `- ${targetIntensity} (synth from ${sourceIntensity}) -`,
      ),
      imported_at: Date.now(),
      bpm: selectedClip.bpm,
      gesture: synthGesture,
      harmonic: synthHarmonic,
      rating: null,
      notes: `Synthesized intensity ${targetIntensity} from intensity ${sourceIntensity} (${selectedClip.filename}). Target: ${targetNoteCount} notes, vel ${targetVelMean.toFixed(1)}.${sibling ? '' : ' (no sibling in DB — used fallback ratios)'}`,
      source: selectedClip.id,
      sourceFilename: selectedClip.filename,
      leadsheet: selectedClip.leadsheet,
      vpMeta: { source: vpMeta.source, pattern: vpMeta.pattern, intensity: `${targetIntensity}-synth` },
    };

    await db.addClip(synthClip);
    await db.addTag(synthClip.id, `${vpMeta.source.toLowerCase()}-synth`);
    await db.addTag(synthClip.id, `vp-pattern:${vpMeta.pattern}`);
    await db.addTag(synthClip.id, `vp-intensity:${targetIntensity}-synth`);

    refreshClips();
    setAnnouncement(`Synthesized intensity ${targetIntensity} (${synthGesture.onsets.length} notes)`);
  }, [selectedClip, vpSiblings, db, refreshClips]);

  /** Synthesize every intensity in `targets` sequentially. */
  const handleSynthesizeAllIntensities = useCallback(async (targets: string[]) => {
    for (const target of targets) {
      await handleSynthesizeIntensity(target);
    }
  }, [handleSynthesizeIntensity]);

  /** Intensity variant from a ratio preset — works for any clip, no vpMeta required. */
  const handleSynthesizeGeneralIntensity = useCallback(async (preset: IntensityPreset) => {
    if (!selectedClip || !db) return;

    const { noteRatio, velRatio, label } = preset;
    const targetNoteCount = Math.max(1, Math.round(selectedClip.gesture.onsets.length * noteRatio));
    const targetVelMean   = Math.min(127, Math.round(selectedClip.gesture.avg_velocity * velRatio));

    const synthesize = noteRatio > 1 ? synthesizeIntensityUp : synthesizeIntensityDown;
    const { gesture: synthGesture, harmonic: synthHarmonic } = synthesize(
      selectedClip.gesture,
      selectedClip.harmonic,
      targetNoteCount,
      targetVelMean,
    );

    const dotIdx = selectedClip.filename.lastIndexOf('.');
    const base   = dotIdx >= 0 ? selectedClip.filename.slice(0, dotIdx) : selectedClip.filename;
    const ext    = dotIdx >= 0 ? selectedClip.filename.slice(dotIdx)    : '.mid';

    const synthClip: Clip = {
      id:             crypto.randomUUID(),
      filename:       `${base} (intensity ${label})${ext}`,
      imported_at:    Date.now(),
      bpm:            selectedClip.bpm,
      gesture:        synthGesture,
      harmonic:       synthHarmonic,
      rating:         null,
      notes:          `Intensity ${label} variant of "${selectedClip.filename}". ` +
                      `${targetNoteCount} notes (×${noteRatio}), vel ${targetVelMean} (×${velRatio.toFixed(2)}).`,
      source:         selectedClip.id,
      sourceFilename: selectedClip.filename,
      leadsheet:      selectedClip.leadsheet,
    };

    await db.addClip(synthClip);
    await db.addTag(synthClip.id, 'intensity-variant');
    await db.addTag(synthClip.id, `intensity-synth:${label}`);

    refreshClips();
    setAnnouncement(`Intensity ${label}: ${synthGesture.onsets.length} notes, vel ${Math.round(synthGesture.avg_velocity)}`);
  }, [selectedClip, db, refreshClips]);

  const handleRealizeForChord = useCallback(async (
    sourceChord: DetectedChord,
    targetChord: DetectedChord,
  ) => {
    if (!selectedClip || !db) return;

    // Look up root-relative intervals for the target chord
    const targetQuality = findQualityByKey(targetChord.qualityKey);
    if (!targetQuality) return;

    const { gesture: realGesture, harmonic: realHarmonic } = realizeForChordTransform(
      selectedClip.gesture,
      selectedClip.harmonic,
      sourceChord.root,       // resolved by ChordRealizeControls (leadsheet-preferred)
      targetChord.root,
      targetQuality.pcs,
    );

    const dotIdx = selectedClip.filename.lastIndexOf('.');
    const base   = dotIdx >= 0 ? selectedClip.filename.slice(0, dotIdx) : selectedClip.filename;
    const ext    = dotIdx >= 0 ? selectedClip.filename.slice(dotIdx)    : '.mid';

    // Build a fresh leadsheet for the target chord — the realized clip's
    // pitches are now in the target chord's world, not the source's.
    const realLeadsheet = parseLeadsheet(targetChord.symbol, realGesture.num_bars);

    const realClip: Clip = {
      id:             crypto.randomUUID(),
      filename:       `${base} (realized ${targetChord.symbol})${ext}`,
      imported_at:    Date.now(),
      bpm:            selectedClip.bpm,
      gesture:        realGesture,
      harmonic:       realHarmonic,
      rating:         null,
      notes:          `Chord realization of "${selectedClip.filename}": ` +
                      `${sourceChord.symbol} → ${targetChord.symbol}.`,
      source:         selectedClip.id,
      sourceFilename: selectedClip.filename,
      leadsheet:      realLeadsheet,
    };

    await db.addClip(realClip);
    await db.addTag(realClip.id, 'chord-realize');
    await db.addTag(realClip.id, `realize:${targetChord.symbol}`);

    refreshClips();
    setAnnouncement(`Realized for ${targetChord.symbol}`);
  }, [selectedClip, db, refreshClips]);

  /**
   * Import a single MIDI ArrayBuffer into the database.
   * Shared by direct .mid import and Apple Loops extraction.
   *
   * @param midiBuffer  Raw SMF bytes
   * @param filename    Display filename for the clip
   * @param extraTags   Additional tags to apply (e.g. "apple-loop")
   * @param extraNotes  Extra notes string for the clip
   */
  const importMidiBuffer = useCallback(async (
    midiBuffer: ArrayBuffer,
    filename: string,
    extraTags: string[] = [],
    extraNotes: string = '',
    providedLeadsheet?: Leadsheet | null,
    loopMeta?: LoopMeta,
  ) => {
    if (!db) return;

    const midiData = parseMIDI(midiBuffer);
    const notes = extractNotes(midiData);

    if (notes.length === 0) return;

    // Try structured UJAM filename first; fall back to generic BPM regex
    const ujamMeta = parseUjamFilename(filename);
    let bpm: number | null = ujamMeta?.bpm ?? null;
    if (!bpm) {
      const bpmMatch = filename.match(/(\d+)[-_\s]?bpm/i);
      if (bpmMatch) bpm = parseInt(bpmMatch[1]!);
    }
    if (!bpm) {
      bpm = extractBPM(midiData);
    }

    const timeSig = extractTimeSignature(midiData);
    const gesture = extractGesture(notes, midiData.ticksPerBeat, timeSig);
    let harmonic = extractHarmonic(notes, gesture);

    // Extract MCURATOR segmentation metadata (if present)
    const mcurator = extractMcuratorSegments(midiData);
    let segmentation: Segmentation | undefined;
    if (mcurator && mcurator.boundaries.length > 0) {
      const clipEndTick = gesture.num_bars * gesture.ticks_per_bar;
      const segResults = detectChordsForSegments(
        harmonic.pitches,
        gesture.onsets,
        gesture.durations,
        mcurator.boundaries,
        clipEndTick,
      );
      const segmentChords: SegmentChordInfo[] = segResults.map(sr => ({
        index: sr.index,
        startTick: sr.startTick,
        endTick: sr.endTick,
        chord: toDetectedChord(sr.chord),
        pitchClasses: sr.pitchClasses,
      }));
      segmentation = { boundaries: mcurator.boundaries, segmentChords };
    }

    // Restore leadsheet from MCURATOR metadata, or use provided leadsheet (e.g., from Apple Loops)
    let leadsheet: Leadsheet | undefined;
    if (providedLeadsheet) {
      leadsheet = providedLeadsheet;
    } else if (mcurator?.leadsheetText) {
      leadsheet = parseLeadsheet(mcurator.leadsheetText, gesture.num_bars);
      // Restore per-chord beat timing that was serialized by the exporter.
      // parseLeadsheet gives equal-division positions; timing overrides replace those.
      if (leadsheet && mcurator.leadsheetTiming) {
        const timing = mcurator.leadsheetTiming;
        for (const bar of leadsheet.bars) {
          for (let j = 0; j < bar.chords.length; j++) {
            const entry = timing[`${bar.bar}:${j}`];
            if (entry) {
              bar.chords[j]!.beatPosition = entry[0];
              bar.chords[j]!.duration = entry[1];
            }
          }
        }
      }
    }

    const clipNotes = [mcurator?.clipNotes, extraNotes].filter(Boolean).join('; ');

    // If we have a leadsheet but no segmentation yet, auto-derive one.
    if (leadsheet && !segmentation) {
      segmentation = computeSegmentationFromLeadsheet(gesture, harmonic, leadsheet);
    }

    // When a leadsheet is present (e.g. from Apple Loop Sequ data), override
    // barChords with leadsheet-derived chords rather than MIDI note detection.
    // MIDI note detection works well for pad/chord loops but produces phantom
    // chords for melodic/monophonic loops — the Sequ annotation is authoritative.
    if (leadsheet && harmonic.barChords) {
      const leadsheetBarMap = new Map(leadsheet.bars.map(lb => [lb.bar, lb]));
      harmonic = {
        ...harmonic,
        barChords: harmonic.barChords.map(bc => {
          const lb = leadsheetBarMap.get(bc.bar);
          if (!lb || lb.isRepeat || lb.chords.length === 0) return bc;
          // Use the first chord in the bar (bar opener, lowest beatPosition).
          const primary = lb.chords[0]!;
          return { ...bc, chord: primary.chord };
        }),
      };
    }

    // Prefer live DB lookup (passed in), fall back to embedded MIDI metadata.
    const resolvedLoopMeta = loopMeta ?? mcurator?.loopMeta;

    const clip: Clip = {
      id: crypto.randomUUID(),
      filename,
      imported_at: Date.now(),
      bpm,
      gesture,
      harmonic,
      rating: null,
      notes: clipNotes,
      sourceFilename: mcurator?.variantOf,
      segmentation,
      leadsheet,
      loopMeta: resolvedLoopMeta,
      // Filename-derived UJAM metadata takes precedence over embedded MIDI metadata
      vpMeta: ujamMeta
        ? { source: ujamMeta.source, pattern: ujamMeta.pattern, intensity: ujamMeta.intensity }
        : mcurator?.vpMeta,
    };

    await db.addClip(clip);

    // Auto-tag: clips with ≤5 distinct pitch classes likely contain
    // a single chord.  Tag with "single-chord" and the chord symbol.
    const uniquePcs = new Set(harmonic.pitchClasses);
    if (uniquePcs.size <= 5 && uniquePcs.size >= 2) {
      await db.addTag(clip.id, 'single-chord');
      if (harmonic.detectedChord?.symbol) {
        await db.addTag(clip.id, harmonic.detectedChord.symbol);
      }
    }

    // Auto-tag VP clips with source, pattern, and intensity
    if (clip.vpMeta) {
      await db.addTag(clip.id, clip.vpMeta.source.toLowerCase());          // "vp-grit" / "vp-vibe-basic" / "vp-vibe-advanced"
      await db.addTag(clip.id, `vp-pattern:${clip.vpMeta.pattern}`);       // "vp-pattern:Barbara"
      await db.addTag(clip.id, `vp-intensity:${clip.vpMeta.intensity}`);   // "vp-intensity:10a"
    }

    // Apply extra tags (e.g. "apple-loop")
    for (const tag of extraTags) {
      await db.addTag(clip.id, tag);
    }
  }, [db]);

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!db) return;

    const warnings: string[] = [];

    for (const file of files) {
      try {
        // ── Apple Loops files (.aif, .aiff, .caf) ──────────────────
        if (isAppleLoopFile(file.name)) {
          const arrayBuffer = await readFileBuffer(file);
          const result = parseAppleLoop(arrayBuffer);

          if (!result.midi) {
            console.warn('Apple Loop has no embedded MIDI:', file.name);
            warnings.push(`${file.name}: no embedded MIDI found — skipped`);
            continue;
          }

          // Parse MIDI to get notes and determine number of bars
          const midiData = parseMIDI(result.midi);
          const midiNotes = extractNotes(midiData);
          const timeSig = extractTimeSignature(midiData);
          const tempGesture = extractGesture(midiNotes, midiData.ticksPerBeat, timeSig);
          // Prefer numberOfBeats from basc chunk (exact loop length) over MIDI note content,
          // which may be shorter than the declared loop if the last bar has sparse notes.
          const numBars = result.numberOfBeats
            ? Math.round(result.numberOfBeats / result.beatsPerBar)
            : tempGesture.num_bars;

          // Enrich chord events with roots inferred from MIDI (for b8=15 case)
          let chordEvents = result.chordEvents;
          if (chordEvents.some(e => e.accidentalHint !== undefined)) {
            chordEvents = enrichChordEventsWithMidiRoots(chordEvents, midiNotes as any);
          }

          // Build a .mid filename from the loop filename
          const baseName = file.name.replace(/\.(aif|aiff|caf)$/i, '');
          const midiFilename = `${baseName}.mid`;

          // Build extra notes with chord timeline (if chord events found)
          let extraNotes = `Source: Apple Loop (${result.format.toUpperCase()})`;
          if (chordEvents.length > 0) {
            extraNotes += ` | Chords: ${formatChordTimeline(chordEvents)}`;
          }

          // Fetch DB metadata first — needed for root transposition.
          const loopMeta = lookupLoopMeta(file.name);

          // Convert chord events to leadsheet structure.
          // Pass loopMeta.rootPc so that chord roots are transposed from the loop's
          // original Sequ key to the DB-tagged playback key.
          const leadsheet = appleLoopEventsToLeadsheet(
            chordEvents, numBars, result.beatsPerBar,
            loopMeta?.rootPc !== undefined && loopMeta.rootPc >= 0 ? loopMeta.rootPc : undefined,
          );

          await importMidiBuffer(result.midi, midiFilename, ['apple-loop'], extraNotes, leadsheet, loopMeta);
          continue;
        }

        // ── Standard MIDI files (.mid) ──────────────────────────────
        if (!file.name.match(/\.midi?$/i)) continue;

        const arrayBuffer = await readFileBuffer(file);
        await importMidiBuffer(arrayBuffer, file.name);
      } catch (error) {
        console.error('Error importing', file.name, error);
        let msg: string;
        if (error instanceof DOMException && error.name === 'NotReadableError') {
          msg = `${file.name}: cannot read file — if stored in iCloud, download it locally first ` +
                `(right-click → Download Now in Finder); otherwise the file may be locked or restricted`;
        } else {
          msg = `${file.name}: error — ${error instanceof Error ? error.message : String(error)}`;
        }
        warnings.push(msg);
      }
    }

    if (warnings.length > 0) setImportWarnings(w => [...w, ...warnings]);
    refreshClips();
  }, [db, refreshClips, importMidiBuffer]);

  const clearAllClips = useCallback(async () => {
    if (!db) return;
    if (confirm('Clear all clips? This will remove everything from the database.')) {
      stop();
      setSelectedClip(null);
      setTags([]);
      await db.clearAllClips();
      refreshClips();
    }
  }, [db, refreshClips, stop]);

  const handleDownloadCurrent = useCallback(() => {
    if (!selectedClip) return;
    downloadMIDI(selectedClip);
  }, [selectedClip]);

  const handleDownloadVariantsZip = useCallback(() => {
    if (!selectedClip) return;
    const variants = clips.filter(c => c.source === selectedClip.id);
    if (variants.length > 0) {
      downloadVariantsAsZip(variants, selectedClip.filename);
    } else {
      alert('No variants found for this clip');
    }
  }, [selectedClip, clips]);

  // ─── Range selection chord detection ──────────────────────────────

  const rangeChordInfo = useMemo(() => {
    if (!selectionRange || !selectedClip) return null;

    const indices = getNotesInTickRange(
      selectedClip.gesture.onsets,
      selectedClip.gesture.durations,
      selectionRange.startTick,
      selectionRange.endTick,
    );

    if (indices.length === 0) return null;

    // Detect chord blocks (notes that start and end together)
    const blocks = detectChordBlocks(
      indices,
      selectedClip.gesture.onsets,
      selectedClip.gesture.durations,
    );

    // Get pitch classes for each block and detect chords
    const ticksPerBeat = selectedClip.gesture.ticks_per_beat || 480;
    const ticksPerBar = selectedClip.gesture.ticks_per_bar;

    const blockInfo = blocks.map(b => {
      const pitches = b.noteIndices.map(i => selectedClip.harmonic.pitches[i]!);
      const pcs = [...new Set(pitches.map(p => ((p % 12) + 12) % 12))].sort((a, b) => a - b);
      const chord = detectChord(pitches);

      // Calculate beat position within bar for scoring
      const barStart = Math.floor(b.startTick / ticksPerBar) * ticksPerBar;
      const localTick = b.startTick - barStart;
      const beat = Math.floor(localTick / ticksPerBeat);

      // Score: prefer more notes, strong beats (1 and 4), simple triads
      const noteCountScore = b.noteIndices.length * 10;
      const beatBonus = (beat === 0 || beat === 3) ? 5 : 0;
      const simpleTriadBonus = chord && ['maj', 'min', '5'].includes(chord.quality.key) ? 3 : 0;
      const score = noteCountScore + beatBonus + simpleTriadBonus;

      return { pitches, pcs, pcsKey: pcs.join(','), chord, score };
    });

    // Strategy: merge all block pitches first — within a selection,
    // arpeggiated/broken patterns collectively spell one harmony.
    const allPitches = blockInfo.flatMap(b => b.pitches);
    let match = detectChord(allPitches);

    if (!match) {
      // Merged set too dense / unrecognizable — fall back to best single block
      const best = blockInfo.reduce((a, b) => b.score > a.score ? b : a);
      match = detectChord(best.pitches);
    }

    const pitchClasses = [...new Set(allPitches.map(p => ((p % 12) + 12) % 12))];

    const chord: DetectedChord | null = match
      ? {
          root: match.root,
          rootName: match.rootName,
          qualityKey: match.quality.key,
          symbol: match.symbol,
          qualityName: match.quality.fullName,
          observedPcs: match.observedPcs,
          templatePcs: match.templatePcs,
          extras: match.extras,
          missing: match.missing,
          bassPc: match.bassPc,
          bassName: match.bassName,
        }
      : null;

    return { chord, pitchClasses, noteCount: indices.length };
  }, [selectionRange, selectedClip]);

  const handleOverrideBarChords = useCallback(async () => {
    if (!selectedClip || !db || !selectionRange || !rangeChordInfo?.chord) return;

    const { ticks_per_bar } = selectedClip.gesture;
    const startBar = Math.floor(selectionRange.startTick / ticks_per_bar);
    const endBar = Math.floor((selectionRange.endTick - 1) / ticks_per_bar);

    const existingBarChords = selectedClip.harmonic.barChords ?? [];
    const updatedBarChords = existingBarChords.map((bc) => {
      // Skip bars outside the selection range
      if (bc.bar < startBar || bc.bar > endBar) return bc;

      // Calculate bar-relative tick positions
      const barStartTick = bc.bar * ticks_per_bar;
      const localStart = Math.max(0, selectionRange.startTick - barStartTick);
      const localEnd = Math.min(ticks_per_bar, selectionRange.endTick - barStartTick);

      // Whole bar override? Set chord directly, clear segments
      if (localStart === 0 && localEnd === ticks_per_bar) {
        return { ...bc, chord: rangeChordInfo.chord, segments: undefined };
      }

      // Sub-bar override: splice into segments
      const splicedSegments = spliceSegment(
        bc.segments,
        bc.chord,
        ticks_per_bar,
        localStart,
        localEnd,
        rangeChordInfo.chord,
      );

      // Remove segments that cover rests (no notes) - rests carry no chord info
      const newSegments = removeRestSegments(
        splicedSegments,
        barStartTick,
        selectedClip.gesture.onsets,
        selectedClip.gesture.durations,
      );

      // If result is trivial (single full-bar segment), simplify to chord field
      if (isTrivialSegments(newSegments, ticks_per_bar)) {
        return { ...bc, chord: newSegments[0]?.chord ?? null, segments: undefined };
      }

      // If no segments left (all were rests), keep the bar's detected chord
      if (newSegments.length === 0) {
        return bc;
      }

      return { ...bc, segments: newSegments };
    });

    const updated: Clip = {
      ...selectedClip,
      harmonic: { ...selectedClip.harmonic, barChords: updatedBarChords },
    };

    await db.updateClip(updated);
    setSelectedClip(updated);
    refreshClips();
  }, [selectedClip, db, selectionRange, rangeChordInfo, refreshClips]);

  // ─── Chord substitution (adapt notes to new chord) ─────────────────
  const handleAdaptChord = useCallback(async (newChord: DetectedChord) => {
    if (!selectedClip || !db || !selectionRange) return;

    // 1. Substitute pitches in the selected range
    const newPitches = substituteSegmentPitches(
      selectedClip.harmonic.pitches,
      selectedClip.gesture.onsets,
      selectionRange.startTick,
      selectionRange.endTick,
      newChord,
    );

    // 2. Re-extract harmonic info with the new pitches
    const updatedHarmonic = extractHarmonic(
      selectedClip.gesture.onsets.map((onset, i) => ({
        midi: newPitches[i]!,
        velocity: selectedClip.gesture.velocities[i]!,
        ticks: onset,
        durationTicks: selectedClip.gesture.durations[i]!,
      })),
      selectedClip.gesture,
    );

    // 3. Merge old segments with new harmonic data, then update the adapted segment
    const { ticks_per_bar } = selectedClip.gesture;
    const startBar = Math.floor(selectionRange.startTick / ticks_per_bar);
    const endBar = Math.floor((selectionRange.endTick - 1) / ticks_per_bar);

    // IMPORTANT: extractHarmonic creates fresh barChords with NO segments.
    // We need to preserve existing user-defined segments from the old clip.
    const existingBarChords = selectedClip.harmonic.barChords ?? [];

    const updatedBarChords = updatedHarmonic.barChords?.map((newBc) => {
      // Find the OLD bar that may have user-defined segments
      const oldBc = existingBarChords.find((bc) => bc.bar === newBc.bar);

      // Calculate bar-relative tick positions
      const barStartTick = newBc.bar * ticks_per_bar;
      const localStart = Math.max(0, selectionRange.startTick - barStartTick);
      const localEnd = Math.min(ticks_per_bar, selectionRange.endTick - barStartTick);

      // For bars outside the adapted range, preserve old segments entirely
      if (newBc.bar < startBar || newBc.bar > endBar) {
        return { ...newBc, segments: oldBc?.segments };
      }

      // Whole bar: set chord directly, clear segments
      if (localStart === 0 && localEnd === ticks_per_bar) {
        return { ...newBc, chord: newChord, segments: undefined };
      }

      // Sub-bar: splice the new chord into OLD segments (not the empty newBc.segments!)
      const splicedSegments = spliceSegment(
        oldBc?.segments,
        oldBc?.chord ?? newBc.chord,
        ticks_per_bar,
        localStart,
        localEnd,
        newChord,
      );

      // Remove segments covering rests (no notes)
      const newSegments = removeRestSegments(
        splicedSegments,
        barStartTick,
        selectedClip.gesture.onsets,
        selectedClip.gesture.durations,
      );

      // If result is trivial (single full-bar segment), simplify to chord field
      if (isTrivialSegments(newSegments, ticks_per_bar)) {
        return { ...newBc, chord: newSegments[0]?.chord ?? null, segments: undefined };
      }

      // If no segments left (all were rests), keep the bar's auto-detected chord
      if (newSegments.length === 0) {
        return newBc;
      }

      return { ...newBc, segments: newSegments };
    });

    const updated: Clip = {
      ...selectedClip,
      harmonic: { ...updatedHarmonic, barChords: updatedBarChords },
    };

    await db.updateClip(updated);
    setSelectedClip(updated);
    setSelectionRange(null); // Clear selection after adapting
    refreshClips();
  }, [selectedClip, db, selectionRange, refreshClips]);

  // ─── Leadsheet (underlying chords) ──────────────────────────────
  const handleLeadsheetChange = useCallback(async (inputText: string) => {
    if (!selectedClip || !db) return;
    if (inputText === '') {
      // Clear leadsheet
      const updated: Clip = { ...selectedClip, leadsheet: undefined };
      await db.updateClip(updated);
      setSelectedClip(updated);
      refreshClips();
      return;
    }
    const leadsheet = parseLeadsheet(inputText, selectedClip.gesture.num_bars);
    // Auto-segment from the new leadsheet (replaces any prior leadsheet-derived boundaries).
    // Manually-placed boundaries that differ from the leadsheet are also replaced — the
    // assumption is that typing a new leadsheet means you want a fresh segmentation.
    const segmentation = computeSegmentationFromLeadsheet(selectedClip.gesture, selectedClip.harmonic, leadsheet);
    const updated: Clip = { ...selectedClip, leadsheet, segmentation };
    await db.updateClip(updated);
    setSelectedClip(updated);
    refreshClips();
  }, [selectedClip, db, refreshClips]);

  /**
   * Handle a drag on a chord boundary divider in LeadsheetBar.
   * Updates the beatPosition/duration of the chords on either side of the boundary
   * directly on the Leadsheet object (bypassing text serialization to preserve beat timing).
   *
   * @param barIndex       0-based bar index
   * @param boundaryIndex  0-based divider index (boundary between chord[n] and chord[n+1])
   * @param newBeatPosition new beat-position of chord[n+1] within the bar
   */
  const handleLeadsheetBoundaryMove = useCallback(async (
    barIndex: number,
    boundaryIndex: number,
    newBeatPosition: number,
  ) => {
    if (!selectedClip?.leadsheet || !db) return;

    const tpb = selectedClip.gesture.ticks_per_beat;
    const tpBar = selectedClip.gesture.ticks_per_bar;
    const beatsPerBar = tpBar / tpb;

    // Deep-clone the leadsheet bars so we don't mutate state
    const newBars = selectedClip.leadsheet.bars.map(bar => ({
      ...bar,
      chords: bar.chords.map(c => ({ ...c })),
    }));

    const bar = newBars.find(b => b.bar === barIndex);
    if (!bar) return;

    const chords = bar.chords;
    const leftChord = chords[boundaryIndex];
    const rightChord = chords[boundaryIndex + 1];
    if (!leftChord || !rightChord) return;

    // Determine the start of leftChord (beats from bar start)
    const leftStart = leftChord.beatPosition !== undefined
      ? leftChord.beatPosition
      : (boundaryIndex / chords.length) * beatsPerBar;

    // Determine the end of rightChord (beats from bar start)
    const rightEnd = rightChord.beatPosition !== undefined && rightChord.duration !== undefined
      ? rightChord.beatPosition + rightChord.duration
      : ((boundaryIndex + 2) / chords.length) * beatsPerBar;

    // Update left chord: keep its start, new duration up to the new boundary
    leftChord.beatPosition = leftStart;
    leftChord.duration = newBeatPosition - leftStart;

    // Update right chord: new start at boundary, keep its end
    rightChord.beatPosition = newBeatPosition;
    rightChord.duration = rightEnd - newBeatPosition;

    // Also initialise any chords in the bar that don't yet have explicit timing
    // (This happens the first time the user drags, when chords were equal-divided)
    for (let k = 0; k < chords.length; k++) {
      const c = chords[k]!;
      if (c.beatPosition === undefined) {
        c.beatPosition = (k / chords.length) * beatsPerBar;
        c.duration = beatsPerBar / chords.length;
      }
    }

    const updatedLeadsheet: Leadsheet = {
      ...selectedClip.leadsheet,
      bars: newBars,
    };
    const updated: Clip = { ...selectedClip, leadsheet: updatedLeadsheet };
    await db.updateClip(updated);
    setSelectedClip(updated);
    // No refreshClips() — no need to re-parse, and avoids re-render flicker during drag
  }, [selectedClip, db]);

  const [loadingSamples, setLoadingSamples] = useState(false);

  const handleLoadSamples = useCallback(async () => {
    if (!db || loadingSamples) return;
    setLoadingSamples(true);
    try {
      const base = import.meta.env.BASE_URL;
      const res = await fetch(`${base}samples/manifest.json`);
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
      const manifest: Array<{ filename: string }> = await res.json();

      for (const entry of manifest) {
        const midiRes = await fetch(`${base}samples/${entry.filename}`);
        if (!midiRes.ok) continue;
        const arrayBuffer = await midiRes.arrayBuffer();
        // Create a File object so the existing pipeline can handle it
        const file = new File([arrayBuffer], entry.filename, { type: 'audio/midi' });
        await handleFileUpload([file]);
      }
    } catch (error) {
      console.error('Error loading samples:', error);
    } finally {
      setLoadingSamples(false);
    }
  }, [db, loadingSamples, handleFileUpload]);

  const handleLoadLoopDb = useCallback(async (file: File) => {
    if (!db) return;
    setLoopDbStatus('loading');
    try {
      const buffer = await file.arrayBuffer();
      await loadLoopDb(buffer, file.name);
      setLoopDbFileName(getLoadedDbFileName());

      // Back-fill: enrich existing apple-loop clips that have no loopMeta yet.
      // The lookup uses the clip filename (e.g. "Something.mid") which
      // lookupLoopMeta converts to "Something.caf" for the DB match.
      const allClips = await db.getAllClips();
      let enriched = 0;
      for (const clip of allClips) {
        if (clip.loopMeta) continue;           // already has metadata
        const meta = lookupLoopMeta(clip.filename);
        if (!meta) continue;
        await db.updateClip({ ...clip, loopMeta: meta });
        enriched++;
      }
      setLoopDbEnriched(enriched);
      if (enriched > 0) refreshClips();
      setLoopDbStatus('ok');
    } catch (err) {
      console.error('Failed to load loop database:', err);
      setLoopDbStatus('error');
    }
  }, [db, refreshClips]);

  const handleGenerateProgression = useCallback(async (
    progressionIndex: number,
    keyOffset: number,
    voicing: VoicingShape,
  ) => {
    if (!db) return;

    const baseProg = PROGRESSIONS[progressionIndex];
    if (!baseProg) return;

    const prog = transposeProgression(baseProg, keyOffset);
    const { notes, leadsheetText, filename, ppq } = generateProgressionClip(prog, voicing, 120);

    if (notes.length === 0) return;

    const gesture = extractGesture(notes, ppq);
    const harmonic = extractHarmonic(notes, gesture);
    const leadsheet = parseLeadsheet(leadsheetText, gesture.num_bars);

    const clip: Clip = {
      id: crypto.randomUUID(),
      filename,
      imported_at: Date.now(),
      bpm: 120,
      gesture,
      harmonic,
      rating: null,
      notes: '',
      leadsheet,
    };

    await db.addClip(clip);
    refreshClips();
    selectClip(clip);
  }, [db, refreshClips, selectClip]);

  const filteredClips = useMemo(() => {
    if (!filterTag) return clips;
    // Field-scoped filter: "field:value" emitted by metadata chip clicks
    const fieldMatch = filterTag.match(/^(\w+):(.+)$/);
    if (fieldMatch) {
      const [, field, val] = fieldMatch;
      const q = val.toLowerCase();

      // Special problem filters for QA / triage
      if (field === 'problem') {
        if (q === 'metadata') {
          // Clips with no loopMeta at all, or with sparse metadata (no instrument AND no genre)
          return clips.filter(c => {
            if (!c.loopMeta) return true;
            const m = c.loopMeta;
            return !m.instrumentType && !m.genre;
          });
        }
        if (q === 'chord') {
          // Clips with at least one unrecognised chord quality (symbol contains '?' or '[').
          // We check two places:
          //   1. barChords: for clips whose chord was detected from MIDI notes (chord non-null).
          //   2. leadsheet inputText: for Apple Loop clips whose chord is null (no quality match)
          //      but whose inputText carries the bracket/question notation.
          const hasUnknownSym = (sym: string) => sym.includes('?') || sym.includes('[');
          return clips.filter(c => {
            const chords = getEffectiveBarChords(c);
            if (chords?.some(b => b.chord && hasUnknownSym(b.chord.symbol))) return true;
            return c.leadsheet?.bars.some(bar =>
              bar.chords.some(lc => !lc.chord && hasUnknownSym(lc.inputText ?? ''))
            ) ?? false;
          });
        }
        if (q === 'flagged') {
          return clips.filter(c => c.flagged);
        }
        return [];
      }

      return clips.filter(c => {
        const m = c.loopMeta;
        if (!m) return false;
        switch (field) {
          case 'instrument':
            return m.instrumentType.toLowerCase().includes(q) ||
                   m.instrumentSubType.toLowerCase().includes(q);
          case 'genre':
            return m.genre.toLowerCase().includes(q);
          case 'key':
            return `${rootPcName(m.rootPc)} ${keyTypeLabel(m.keyType)}`.toLowerCase().includes(q);
          case 'looptype':
            return gbLoopTypeLabel(m.gbLoopType, m.hasMidi).toLowerCase() === q;
          case 'descriptor':
            return m.descriptors.split(',').some(d => d.trim().toLowerCase().includes(q));
          case 'collection':
            return (m.collection ?? '').toLowerCase().includes(q);
          case 'jampak':
            return (m.jamPack ?? '').toLowerCase().includes(q);
          default:
            return false;
        }
      });
    }
    // Free-text fallback: match filename, user tags, or any loopMeta field
    const q = filterTag.toLowerCase();
    return clips.filter(c => {
      if (c.filename.toLowerCase().includes(q)) return true;
      const clipTags = tagIndex.get(c.id);
      if (clipTags?.some(t => t.toLowerCase().includes(q))) return true;
      const m = c.loopMeta;
      if (!m) return false;
      const metaTerms = [
        m.instrumentType, m.instrumentSubType, m.genre,
        m.descriptors, m.collection, m.author, m.jamPack ?? '',
        `${rootPcName(m.rootPc)} ${keyTypeLabel(m.keyType)}`,
      ];
      return metaTerms.some(t => t && t.toLowerCase().includes(q));
    });
  }, [clips, filterTag, tagIndex]);

  /**
   * Apply a single chord symbol as the leadsheet for every clip in
   * `filteredClips`.  Useful for bulk-correcting chord annotations when
   * importing batches that share the same underlying chord (e.g. VP Score
   * files that are all C major but were imported without a leadsheet).
   */
  const handleBulkLeadsheetUpdate = useCallback(async (symbol: string) => {
    if (!db) return;
    for (const clip of filteredClips) {
      const newLeadsheet = parseLeadsheet(symbol, clip.gesture.num_bars);
      const updated: Clip = { ...clip, leadsheet: newLeadsheet };
      await db.updateClip(updated);
      // Keep the selected clip in sync so the detail panel refreshes immediately
      if (selectedClip?.id === clip.id) setSelectedClip(updated);
    }
    refreshClips();
    setAnnouncement(`Leadsheet set to ${symbol} for ${filteredClips.length} clip${filteredClips.length !== 1 ? 's' : ''}`);
  }, [db, filteredClips, selectedClip, refreshClips]);

  // Escape key clears range selection or exits scissors mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (scissorsMode) {
          setScissorsMode(false);
        } else if (selectionRange) {
          setSelectionRange(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionRange, scissorsMode]);

  // Enter key sets chord segment (when selection exists with detected chord)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;

      if (e.key === 'Enter' && selectionRange && rangeChordInfo?.chord) {
        e.preventDefault();
        handleOverrideBarChords();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectionRange, rangeChordInfo, handleOverrideBarChords]);

  // S key toggles scissors mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey && selectedClip) {
        e.preventDefault();
        setScissorsMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip]);

  // Arrow key navigation: Up/Down for clips, Left/Right for segments
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input, textarea')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const isUpDown = e.key === 'ArrowUp' || e.key === 'ArrowDown';
      const isLeftRight = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (!isUpDown && !isLeftRight) return;

      e.preventDefault();

      // Up/Down: navigate clips in the filtered list
      if (isUpDown && filteredClips.length > 0) {
        const currentIdx = selectedClip
          ? filteredClips.findIndex(c => c.id === selectedClip.id)
          : -1;
        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < filteredClips.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : filteredClips.length - 1;
        }
        selectClip(filteredClips[nextIdx]!);
        return;
      }

      // Left/Right: navigate segments in the current clip
      if (isLeftRight && selectedClip?.segmentation?.segmentChords) {
        const segs = selectedClip.segmentation.segmentChords;
        if (segs.length === 0) return;

        // Find current segment based on selection range
        let currentSegIdx = -1;
        if (selectionRange) {
          currentSegIdx = segs.findIndex(
            s => s.startTick === selectionRange.startTick && s.endTick === selectionRange.endTick,
          );
        }

        let nextSegIdx: number;
        if (e.key === 'ArrowRight') {
          nextSegIdx = currentSegIdx < segs.length - 1 ? currentSegIdx + 1 : 0;
        } else {
          nextSegIdx = currentSegIdx > 0 ? currentSegIdx - 1 : segs.length - 1;
        }
        const seg = segs[nextSegIdx]!;
        setSelectionRange({ startTick: seg.startTick, endTick: seg.endTick });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredClips, selectedClip, selectionRange, selectClip]);

  // ─── Segmentation boundary management ──────────────────────────────

  /**
   * Compute segment chords for a clip given its boundaries.
   * Returns the full Segmentation object with segmentChords populated.
   */
  const computeSegmentation = useCallback((clip: Clip, boundaries: number[]): Segmentation | undefined => {
    if (boundaries.length === 0) return undefined;

    const { onsets, durations, ticks_per_bar, num_bars } = clip.gesture;
    const clipEndTick = num_bars * ticks_per_bar;

    const segResults = detectChordsForSegments(
      clip.harmonic.pitches,
      onsets,
      durations,
      boundaries,
      clipEndTick,
    );

    const segmentChords: SegmentChordInfo[] = segResults.map(sr => ({
      index: sr.index,
      startTick: sr.startTick,
      endTick: sr.endTick,
      chord: toDetectedChord(sr.chord),
      pitchClasses: sr.pitchClasses,
    }));

    return { boundaries, segmentChords };
  }, []);

  /**
   * Update the clip with new boundaries (recomputing segment chords), persist, and refresh.
   */
  const updateBoundaries = useCallback(async (boundaries: number[]) => {
    if (!selectedClip || !db) return;

    const segmentation = computeSegmentation(selectedClip, boundaries);
    const updated: Clip = { ...selectedClip, segmentation };

    await db.updateClip(updated);
    setSelectedClip(updated);
    refreshClips();
  }, [selectedClip, db, computeSegmentation, refreshClips]);

  const addBoundary = useCallback(async (tick: number) => {
    if (!selectedClip) return;
    const existing = selectedClip.segmentation?.boundaries ?? [];
    if (existing.includes(tick)) return;
    const boundaries = [...existing, tick].sort((a, b) => a - b);
    await updateBoundaries(boundaries);
  }, [selectedClip, updateBoundaries]);

  const removeBoundary = useCallback(async (tick: number) => {
    if (!selectedClip?.segmentation) return;
    const boundaries = selectedClip.segmentation.boundaries.filter(b => b !== tick);
    await updateBoundaries(boundaries);
  }, [selectedClip, updateBoundaries]);

  const moveBoundary = useCallback(async (fromTick: number, toTick: number) => {
    if (!selectedClip?.segmentation) return;
    const boundaries = selectedClip.segmentation.boundaries
      .map(b => b === fromTick ? toTick : b)
      .sort((a, b) => a - b);
    // Deduplicate (in case moved onto another boundary)
    const deduped = [...new Set(boundaries)];
    await updateBoundaries(deduped);
  }, [selectedClip, updateBoundaries]);

  /**
   * Auto-segment the current clip using its leadsheet chord boundaries.
   * Each chord change point becomes a segment boundary, snapped to the
   * nearest note onset or note-end within half a beat.
   */
  const handleSegmentFromLeadsheet = useCallback(async () => {
    if (!selectedClip?.leadsheet || !db) return;
    const segmentation = computeSegmentationFromLeadsheet(
      selectedClip.gesture, selectedClip.harmonic, selectedClip.leadsheet,
    );
    const updated: Clip = { ...selectedClip, segmentation };
    await db.updateClip(updated);
    setSelectedClip(updated);
    refreshClips();
  }, [selectedClip, db, refreshClips]);

  const handleTogglePlayback = useCallback(() => {
    if (selectedClip) toggle(selectedClip);
  }, [selectedClip, toggle]);

  // Keyboard shortcuts (only active when a clip is selected)
  useKeyboardShortcuts(
    selectedClip
      ? {
          onDownload: handleDownloadCurrent,
          onGenerateVariants: generateVariants,
          onGenerateSingle: generateSingleVariant,
          onDelete: deleteClip,
          onTogglePlayback: handleTogglePlayback,
          onFlag: toggleFlag,
        }
      : {},
  );

  return (
    <div className="mc-app">
      {/* Live region for accessibility announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      {importWarnings.length > 0 && (
        <div className="mc-import-warnings" role="alert">
          <div className="mc-import-warnings-header">
            <span>⚠ {importWarnings.length} file{importWarnings.length !== 1 ? 's' : ''} skipped during import</span>
            <button
              className="mc-import-warnings-dismiss"
              onClick={() => setImportWarnings([])}
              aria-label="Dismiss warnings"
            >✕</button>
          </div>
          <ul className="mc-import-warnings-list">
            {importWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      <div className="mc-layout">
        <Sidebar
          clips={filteredClips}
          allClips={clips}
          selectedClipId={selectedClip?.id ?? null}
          filterTag={filterTag}
          onFilterChange={setFilterTag}
          onSelectClip={selectClip}
          onDownloadAll={() => downloadAllAsZip(filteredClips)}
          onDownloadFlagged={() => downloadAllAsZip(clips.filter(c => c.flagged), 'MIDIcurator-flagged.zip')}
          onClearAll={clearAllClips}
          onFilesDropped={handleFileUpload}
          fileInputRef={fileInputRef}
          onLoadSamples={handleLoadSamples}
          loadingSamples={loadingSamples}
          onGenerateProgression={handleGenerateProgression}
          onLoadLoopDb={handleLoadLoopDb}
          loopDbFileName={loopDbFileName}
          loopDbStatus={loopDbStatus}
          loopDbEnriched={loopDbEnriched}
          onBulkLeadsheetUpdate={handleBulkLeadsheetUpdate}
        />

        {selectedClip ? (
          <ClipDetail
            clip={selectedClip}
            clips={clips}
            tags={tags}
            newTag={newTag}
            onNewTagChange={setNewTag}
            onAddTag={addTag}
            editingBpm={editingBpm}
            bpmValue={bpmValue}
            onBpmChange={setBpmValue}
            onBpmSave={saveBpm}
            onStartEditBpm={() => setEditingBpm(true)}
            densityMultiplier={densityMultiplier}
            onDensityChange={setDensityMultiplier}
            onGenerateSingle={generateSingleVariant}
            onGenerateVariants={generateVariants}
            onDownload={handleDownloadCurrent}
            onDelete={deleteClip}
            onDownloadVariantsZip={handleDownloadVariantsZip}
            playbackState={playbackState}
            playbackTime={currentTime}
            onPlay={() => play(selectedClip)}
            onPause={pause}
            onStop={stop}
            selectionRange={selectionRange}
            onRangeSelect={setSelectionRange}
            rangeChordInfo={rangeChordInfo}
            onOverrideChord={handleOverrideBarChords}
            onAdaptChord={handleAdaptChord}
            scissorsMode={scissorsMode}
            onToggleScissors={() => setScissorsMode(prev => !prev)}
            onAddBoundary={addBoundary}
            onRemoveBoundary={removeBoundary}
            onMoveBoundary={moveBoundary}
            onFilterByTag={setFilterTag}
            onLeadsheetChange={handleLeadsheetChange}
            onLeadsheetBoundaryMove={handleLeadsheetBoundaryMove}
            onSegmentFromLeadsheet={selectedClip?.leadsheet ? handleSegmentFromLeadsheet : undefined}
            vpSiblings={vpSiblings}
            onSynthesizeIntensity={handleSynthesizeIntensity}
            onSynthesizeAllIntensities={handleSynthesizeAllIntensities}
            onSynthesizeGeneralIntensity={handleSynthesizeGeneralIntensity}
            onRealizeForChord={handleRealizeForChord}
          />
        ) : (
          <div className="mc-main">
            <div className="mc-welcome">
              <h2>Welcome to MIDI Curator</h2>
              <p>Drop MIDI files to get started, or select a clip from the sidebar.</p>
              {clips.length === 0 && (
                <button
                  className="mc-btn--samples"
                  onClick={handleLoadSamples}
                  disabled={loadingSamples}
                >
                  {loadingSamples ? 'Loading...' : 'Load Sample Progressions'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <KeyboardShortcutsBar />
    </div>
  );
}
