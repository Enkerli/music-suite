// Design tokens — migrated onto @enkerli/ui "paper & ink" (shared-frame pass).
// Surfaces and inks below ARE the --es-* token values (light + WARM dark;
// the old cool blue-violet dark is retired, per the signed-off pass).
// Accents and lane colours stay app-local ("one language, per-app voice").
// If packages/ui/tokens/tokens.css changes, re-sync these literals.
// Shared between v1 "Sketchbook" and v2 "Studio"

const PAPER = {
  // surfaces — hex for SVG compat; oklch for CSS vars
  bg:      '#f5f2eb',
  bgDeep:  '#efebe2',
  card:    '#fcfbf7',
  rule:    '#ddd6ca',
  ruleFaint:'#eae3d4',
  // ink
  ink:     '#2d2b27',
  ink70:   '#4b463e',
  ink50:   '#6b665b',  // --es-fg-muted (AA on bg, card and bgDeep)
  ink30:   '#b3ac9e',  // --es-fg-faint (disabled ink only)
  // accents
  amber:   '#C4873A',
  amberInk:'#8A5520',
  // lanes
  laneInk:   '#3A4060',
  laneRose:  '#C4624A',
  laneMoss:  '#4A7A55',
  lanePlum:  '#6B4F7C',
};

const PAPER_DARK = {
  bg:       '#1a1814',
  bgDeep:   '#14130f',
  card:     '#221f1a',
  rule:     '#38332b',
  ruleFaint:'#2b2620',
  ink:      '#e8e1d2',
  ink70:    '#cfc7b5',
  ink50:    '#908672',  // --es-fg-muted (AA)
  ink30:    '#5f584a',  // --es-fg-faint (disabled ink only)
  amber:    '#E8A838',
  amberInk: '#E8C878',
  laneInk:  '#4A90E2',
  laneRose: '#E8A838',
  laneMoss: '#5CB85C',
  lanePlum: '#B888D4',
};

// Each lane has light + dark color variants so the theme toggle can update
// rendering without reinitialising the engine.  dash is shared across themes.
const LANES = [
  { id: 0, name: 'One',   color: PAPER.laneInk,  colorDark: PAPER_DARK.laneInk,  tint: 'oklch(88% 0.02 250)', tintDark: 'rgba(74,144,226,0.13)',  dash: '0'       }, // solid
  { id: 1, name: 'Two',   color: PAPER.laneRose, colorDark: PAPER_DARK.laneRose, tint: 'oklch(92% 0.03  25)', tintDark: 'rgba(232,168,56,0.13)',  dash: '10 4'    }, // long-dash
  { id: 2, name: 'Three', color: PAPER.laneMoss, colorDark: PAPER_DARK.laneMoss, tint: 'oklch(91% 0.03 145)', tintDark: 'rgba(92,184,92,0.13)',   dash: '6 3 2 3' }, // dash-dot
  { id: 3, name: 'Four',  color: PAPER.lanePlum, colorDark: PAPER_DARK.lanePlum, tint: 'oklch(90% 0.03 295)', tintDark: 'rgba(184,136,212,0.13)', dash: '3 4'     }, // short-dot
];

// Scale presets — pitch-class bitmasks (MSB = root, bit 11 = interval 0).
// Masks are INTERVAL-based.  The engine looks up (semi - scaleRoot) % 12 before
// pcActive(mask, …), so the same mask transposes when scaleRoot changes — the
// wheel UI must therefore also rotate by scaleRoot before display (see
// ChromaticWheel in scale-editor.jsx).
//
// This is the SAME taxonomy as Source/ScaleData.h (8 families, 47 scales) so
// the JS UI shows everything the C++ engine recognises.  Hex masks match
// dcScale::kFamilies entries exactly — keep them in sync if either side
// adds a scale.
const SCALES = [
  // Diatonic — 7 modes of the major scale
  { id: 'ionian',        name: 'Ionian',          mask: 0xAB5, family: 'Diatonic' }, // 0 2 4 5 7 9 11  (Major)
  { id: 'dorian',        name: 'Dorian',          mask: 0x6AD, family: 'Diatonic' }, // 0 2 3 5 7 9 10
  { id: 'phrygian',      name: 'Phrygian',        mask: 0x5AB, family: 'Diatonic' }, // 0 1 3 5 7 8 10
  { id: 'lydian',        name: 'Lydian',          mask: 0xAD5, family: 'Diatonic' }, // 0 2 4 6 7 9 11
  { id: 'mixolydian',    name: 'Mixolydian',      mask: 0x6B5, family: 'Diatonic' }, // 0 2 4 5 7 9 10
  { id: 'aeolian',       name: 'Aeolian',         mask: 0x5AD, family: 'Diatonic' }, // 0 2 3 5 7 8 10  (Nat. Minor)
  { id: 'locrian',       name: 'Locrian',         mask: 0x56B, family: 'Diatonic' }, // 0 1 3 5 6 8 10

  // Pentatonic — 5 rotations of the major pentatonic
  { id: 'pentMaj',       name: 'Major',           mask: 0x295, family: 'Pentatonic' }, // 0 2 4 7 9
  { id: 'suspended',     name: 'Suspended',       mask: 0x4A5, family: 'Pentatonic' }, // 0 2 5 7 10  (Egyptian)
  { id: 'manGong',       name: 'Man Gong',        mask: 0x529, family: 'Pentatonic' }, // 0 3 5 8 10
  { id: 'ritusen',       name: 'Ritusen',         mask: 0x2A5, family: 'Pentatonic' }, // 0 2 5 7 9
  { id: 'pentMin',       name: 'Minor',           mask: 0x4A9, family: 'Pentatonic' }, // 0 3 5 7 10

  // Jazz Minor — 7 modes of melodic minor (ascending)
  { id: 'jazzMinor',     name: 'Jazz Minor',      mask: 0xAAD, family: 'Jazz Minor' }, // 0 2 3 5 7 9 11
  { id: 'dorianFlat2',   name: 'Dorian ♭2',       mask: 0x6AB, family: 'Jazz Minor' }, // 0 1 3 5 7 9 10
  { id: 'lydianAug',     name: 'Lydian Aug.',     mask: 0xB55, family: 'Jazz Minor' }, // 0 2 4 6 8 9 11
  { id: 'lydianDom',     name: 'Lydian Dom.',     mask: 0x6D5, family: 'Jazz Minor' }, // 0 2 4 6 7 9 10
  { id: 'mixoFlat6',     name: 'Mixo. ♭6',        mask: 0x5B5, family: 'Jazz Minor' }, // 0 2 4 5 7 8 10
  { id: 'halfDim',       name: 'Half-Dim.',       mask: 0x56D, family: 'Jazz Minor' }, // 0 2 3 5 6 8 10
  { id: 'altered',       name: 'Altered',         mask: 0x55B, family: 'Jazz Minor' }, // 0 1 3 4 6 8 10

  // Harm. Minor — 7 modes of harmonic minor
  { id: 'harmMinor',     name: 'Harmonic Minor',  mask: 0x9AD, family: 'Harm. Minor' }, // 0 2 3 5 7 8 11
  { id: 'locrianNat6',   name: 'Locrian ♮6',      mask: 0x66B, family: 'Harm. Minor' }, // 0 1 3 5 6 9 10
  { id: 'ionianSharp5',  name: 'Ionian ♯5',       mask: 0xB35, family: 'Harm. Minor' }, // 0 2 4 5 8 9 11
  { id: 'ukrainianDor',  name: 'Ukrainian Dor.',  mask: 0x6CD, family: 'Harm. Minor' }, // 0 2 3 6 7 9 10
  { id: 'phrygianDom',   name: 'Phrygian Dom.',   mask: 0x5B3, family: 'Harm. Minor' }, // 0 1 4 5 7 8 10
  { id: 'lydianSharp2',  name: 'Lydian ♯2',       mask: 0xAD9, family: 'Harm. Minor' }, // 0 3 4 6 7 9 11
  { id: 'ultraLocrian',  name: 'Ultra Locrian',   mask: 0x35B, family: 'Harm. Minor' }, // 0 1 3 4 6 8 9

  // Symmetric — equal-step / interval-pattern scales
  { id: 'chromatic',     name: 'Chromatic',       mask: 0xFFF, family: 'Symmetric' }, // all 12
  { id: 'wholeTone',     name: 'Whole Tone',      mask: 0x555, family: 'Symmetric' }, // 0 2 4 6 8 10
  { id: 'dimWH',         name: 'Dim. WH',         mask: 0xB6D, family: 'Symmetric' }, // 0 2 3 5 6 8 9 11
  { id: 'dimHW',         name: 'Dim. HW',         mask: 0x6DB, family: 'Symmetric' }, // 0 1 3 4 6 7 9 10
  { id: 'augmented',     name: 'Augmented',       mask: 0x999, family: 'Symmetric' }, // 0 3 4 7 8 11

  // Bebop — 8-note diatonic + chromatic passing tone
  { id: 'bebopDom',      name: 'Dominant',        mask: 0xEB5, family: 'Bebop' }, // 0 2 4 5 7 9 10 11
  { id: 'bebopMaj',      name: 'Major',           mask: 0xBB5, family: 'Bebop' }, // 0 2 4 5 7 8 9 11
  { id: 'bebopMin',      name: 'Minor',           mask: 0xDAD, family: 'Bebop' }, // 0 2 3 5 7 8 10 11
  { id: 'bebopMelMin',   name: 'Mel. Minor',      mask: 0xEAD, family: 'Bebop' }, // 0 2 3 5 7 9 10 11

  // Blues
  { id: 'blues',         name: 'Blues',           mask: 0x4E9, family: 'Blues' }, // 0 3 5 6 7 10
  { id: 'majBlues',      name: 'Major Blues',     mask: 0x29D, family: 'Blues' }, // 0 2 3 4 7 9

  // Chordal — triads & 7th chords as degenerate scales for chord-tone
  // quantization / "glorified arp" workflows
  { id: 'chordMaj',      name: 'Major',           mask: 0x91, family: 'Chordal' }, // 0 4 7
  { id: 'chordMin',      name: 'Minor',           mask: 0x89, family: 'Chordal' }, // 0 3 7
  { id: 'chordDim',      name: 'Diminished',      mask: 0x49, family: 'Chordal' }, // 0 3 6
  { id: 'chordAug',      name: 'Augmented',       mask: 0x111, family: 'Chordal' }, // 0 4 8
  { id: 'chordSus2',     name: 'Sus 2',           mask: 0x85, family: 'Chordal' }, // 0 2 7
  { id: 'chordSus4',     name: 'Sus 4',           mask: 0xA1, family: 'Chordal' }, // 0 5 7
  { id: 'chordMaj7',     name: 'Maj 7',           mask: 0x891, family: 'Chordal' }, // 0 4 7 11
  { id: 'chordMin7',     name: 'Min 7',           mask: 0x489, family: 'Chordal' }, // 0 3 7 10
  { id: 'chordDom7',     name: 'Dom 7',           mask: 0x491, family: 'Chordal' }, // 0 4 7 10
  { id: 'chordHalfDim7', name: 'Half-Dim 7',      mask: 0x449, family: 'Chordal' }, // 0 3 6 10
  { id: 'chordDim7',     name: 'Dim 7',           mask: 0x249, family: 'Chordal' }, // 0 3 6 9
];

// Pitch-class names — split into all-sharp / all-flat tables so the
// chromatic notation toggle (♯/♭) in the top bar can swap between them.
// Source/ScaleLattice.h uses the same convention: false = sharps, true = flats.
const PITCH_SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const PITCH_FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];

// Backward-compat: PITCH_SHORT used to be a mixed-spelling array (sharps for
// C♯/F♯, flats for E♭/A♭/B♭).  Keep it pointing at the sharps table so any
// stale call site degrades to a sensible default; new code should call
// pitchName(pc, useFlats) instead.
const PITCH_NAMES = PITCH_SHARP;
const PITCH_SHORT = PITCH_SHARP;

// Resolve a pitch class index (0..11) to a name using the active spelling.
function pitchName(pc, useFlats) {
  return (useFlats ? PITCH_FLAT : PITCH_SHARP)[((pc % 12) + 12) % 12];
}

// Utility: bit i of mask (i=0 → C, i=11 → B when MSB order)
function pcActive(mask, pc) {
  return (mask >> (pc)) & 1;
}
function togglePc(mask, pc) {
  return mask ^ (1 << (pc));
}

Object.assign(window, {
  PAPER, PAPER_DARK, LANES, SCALES,
  PITCH_NAMES, PITCH_SHORT, PITCH_SHARP, PITCH_FLAT,
  pitchName,
  pcActive, togglePc,
});
