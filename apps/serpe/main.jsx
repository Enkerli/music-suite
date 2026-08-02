// main.jsx — Serpe React app. Recreates the suite redesign; reuses the
// framework-agnostic engine (engine/*.js) and the shared suite design language.
// Runs standalone in the browser and inside the JUCE WebView (bridge no-ops
// when JUCE is absent).

// CSS is imported as text (esbuild --loader:.css=text) and injected at runtime,
// so the build produces a single bundle.js (no separate bundle.css). This keeps
// the JUCE binary-data step to two artifacts and avoids an Xcode build cycle.
// Tokens + components come from @enkerli/ui (the single source of the design
// language — no longer vendored here); only serpe.css is app-specific.
import fontsCss from '@enkerli/ui/fonts.css';
import tokensCss from '@enkerli/ui/tokens.css';
import componentsCss from '@enkerli/ui/components.css';
import serpeCss from './styles/serpe.css';
{
  const el = document.createElement('style');
  // fontsCss first: its @font-face url('./fonts/*.woff2') resolve relative to
  // the page, and the build copies the woff2 into dist/fonts (self-hosted, no
  // CDN — works offline and in the plugin WebView).
  el.textContent = [fontsCss, tokensCss, componentsCss, serpeCss].join('\n');
  document.head.appendChild(el);
}

import { parseUPI, euclid, polygon, rotate, complement, invert,
         barlowTransform, indispensabilityWeights, onsetCount,
         analyse, analyzeSyncopation, funkyEuclidean, bellCurveRandomSteps,
         mutatePattern, parsePolyUPI, splitLanes, polyLaneAt, formatPolyUPI,
         longShort, durations, dynamicDurations, identify,
         microtiming, timingScales,
         parseNamedPatterns, parseProgressive, progressiveAt } from '@enkerli/upi';
import { createCircleView, createStepView, createPolyCircleView } from './engine/render.js';
import { laneStepMs as computeLaneStepMs, laneOffsetMs as computeLaneOffsetMs } from './engine/poly-clock.js';
import serpeManifest from './manifest.json';
import { connectSerpe } from './control.js';
import { initJuceBridge, sendParamActual, sendUPI, sendPlaying, sendBPM, sendToggleAccent, juceAvailable } from './juce-bridge.js';
import { startWebMidi, selectMidiInput, selectMidiOutput, sendMidiNoteOn, sendMidiNoteOff, allMidiNotesOff, midiSupported } from './webmidi-bridge.js';
import { initTheme } from '@enkerli/ui/theme';
import { createGlobalCluster } from '@enkerli/ui/global-cluster';
import { createLibraryBrowser } from '@enkerli/ui/library-browser';
import { toast } from '@enkerli/ui/toast';

// ── theme: the ONE shared mechanism (shared frame) ──
// Serpe used to persist its own 'serpe.theme'; migrate it to the suite-wide
// 'enkerli.theme' once, then let @enkerli/ui/theme own [data-theme].
try {
  const old = localStorage.getItem('serpe.theme');
  if (old != null) {
    if (localStorage.getItem('enkerli.theme') == null && (old === 'light' || old === 'dark'))
      localStorage.setItem('enkerli.theme', old);
    localStorage.removeItem('serpe.theme');
  }
} catch { /* storage unavailable */ }
initTheme();

// Inline SVG mark — a data-URL <img> with unescaped '#' hex colours renders in
// Chrome but breaks in macOS WKWebView, so inject the markup directly.
const ICON_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-label="Serpe">
<rect x="16" y="16" width="992" height="992" rx="208" fill="#f5f2eb"/>
<rect x="16" y="16" width="992" height="992" rx="208" fill="none" stroke="#ddd6ca" stroke-width="12"/>
<circle cx="512" cy="512" r="300" fill="none" stroke="#ddd6ca" stroke-width="14"/>
<polygon points="512,212 724,512 618,724 406,724 300,512" fill="#2d9d8a" fill-opacity="0.14" stroke="#2d9d8a" stroke-width="26" stroke-linejoin="round"/>
<circle cx="512" cy="212" r="42" fill="#2d9d8a" stroke="#2d2b27" stroke-width="14"/>
<circle cx="724" cy="300" r="24" fill="#fcfbf7" stroke="#2d2b27" stroke-width="12"/>
<circle cx="724" cy="512" r="42" fill="#2d9d8a" stroke="#2d2b27" stroke-width="14"/>
<circle cx="618" cy="724" r="42" fill="#2d9d8a" stroke="#2d2b27" stroke-width="14"/>
<circle cx="406" cy="724" r="42" fill="#2d9d8a" stroke="#2d2b27" stroke-width="14"/>
<circle cx="300" cy="512" r="42" fill="#2d9d8a" stroke="#2d2b27" stroke-width="14"/>
<circle cx="300" cy="300" r="24" fill="#fcfbf7" stroke="#2d2b27" stroke-width="12"/>
<circle cx="512" cy="512" r="20" fill="#2d2b27"/></svg>`;

const { useState, useRef, useEffect, useMemo, createElement: h } = React;

const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('serpe.' + k); return v == null ? d : v; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('serpe.' + k, v); } catch {} },
};

// Runtime config — feature gating + density. Real deployment detects the
// runtime (JUCE present ⇒ plugin; C++ may refine to ipad-p/ipad-l).
const RT = {
  webapp:  { web: true,  host: false, dense: false },
  plugin:  { web: false, host: true,  dense: false },
  'ipad-p':{ web: false, host: true,  dense: true  },
  'ipad-l':{ web: false, host: true,  dense: true  },
};

// Subdivision param (how long each step is, relative to the host beat) — order
// matches the C++ AudioParameterChoice "subdivision".
const SUBDIV = ['64th Triplet', '64th', '32nd Triplet', '32nd', '16th Triplet', '16th',
  '8th Triplet', '8th', 'Quarter Triplet', 'Quarter', 'Half Triplet', 'Half', 'Whole'];

// Pattern-length unit (C++ AudioParameterChoice "patternLengthUnit") and the
// value choices ("patternLengthValue"). Beats/Bars let the WHOLE pattern span a
// fixed musical length (e.g. Bars = 1 → one bar); Steps makes each step a fixed
// note value (subdivision); Auto fits the host bar.
const PLEN_UNIT = ['Steps', 'Beats', 'Bars', 'Auto'];
const PLEN_VAL = ['0.125', '0.25', '0.5', '0.75', '1', '2', '3', '4', '5', '6', '7', '8',
  '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23',
  '24', '25', '26', '27', '28', '29', '30', '31', '32'];

// Onset index of step `idx` within its cycle — how many onsets precede it.
function onsetIndexAt(steps, idx) {
  let n = 0;
  for (let i = 0; i < idx; i++) if (steps[i]) n++;
  return n;
}

// Re-project each lane's accents at its current precession. Lanes carry the
// FIRST-CYCLE projection from the parser; mono advances its phase every cycle
// (see tick()) and poly did not, so a lane whose accent layer is not the same
// length as its onset count disagreed with the engine from cycle 2 — `{10}E(5,8)`
// has 2 accents over 5 onsets and only repeats every 10. Fixed 2026-08-01.
//
// Done here rather than inside PolyLanesPanel so the rows AND the circle view
// both get it: they each read `lane.accents`.
function withPrecessedAccents(poly, offsets) {
  if (!poly || !Array.isArray(poly.lanes)) return poly;
  return { ...poly, lanes: poly.lanes.map((l, i) => {
    const pat = l.accentPattern;
    if (!pat || !pat.length || !(offsets[i] > 0)) return l;
    return { ...l, accents: applyAccents(l.steps, pat, offsets[i]) };
  }) };
}

// Apply a raw accent pattern to a step array's onsets, offset by `off` onsets
// (the precession). Onset k is accented when pattern[(k + off) % len] is set.
function applyAccents(steps, pattern, off = 0) {
  const acc = new Array(steps.length).fill(0);
  if (pattern && pattern.length) {
    let onset = 0;
    for (let i = 0; i < steps.length; i++)
      if (steps[i]) { acc[i] = pattern[(onset + off) % pattern.length] ? 1 : 0; onset++; }
  }
  return acc;
}

// An imperative SVG view (render.js) wrapped as a React component.
/** Generator family of a UPI string (for the browser's badge + facet). */
function upiFamily(u) {
  const s = (u || '').trim();
  if (/^E\(/i.test(s)) return 'Euclidean';
  if (/^P\(/i.test(s)) return 'Polygon';
  if (/^R\(/i.test(s)) return 'Random';
  if (/^[BWD]\(/i.test(s)) return 'Barlow';
  if (/^0x|:\d/.test(s)) return 'Numeric';
  if (/^[[{]/.test(s)) return 'Explicit';
  return 'Other';
}

/** The pattern library as the shared @enkerli/ui LibraryBrowser (Design pass ·
 *  Q2), in compact mode for Serpe's 340px rail. Consolidates the old three tabs
 *  (Presets / Saved / History) into one browser with a Source facet. */
function PatternLibrary({ items, onOpen, onDelete }) {
  const host = useRef(null), br = useRef(null), cb = useRef({});
  cb.current = { onOpen, onDelete };
  useEffect(() => {
    br.current = createLibraryBrowser(host.current, {
      items, compact: true, favorites: false, frontDoors: false, title: 'Patterns',
      openOnRowClick: true, // a pattern picker — single tap loads (Serpe's original feel)
      keys: { name: 'name', source: 'source' },
      sorts: [{ value: 'recent', label: 'Added' }, { value: 'name', label: 'UPI A–Z' }],
      facets: [
        { key: 'source', label: 'Source', kind: 'multi', values: ['Named', 'Saved', 'Preset', 'Recent'], accessor: (it) => it.source },
        { key: 'family', label: 'Generator', kind: 'multi', badge: true, accessor: (it) => it.family },
        { key: 'tags', label: 'Tags', kind: 'multi', tag: true, defaultOpen: false, limit: 20, accessor: (it) => it.tags },
      ],
      rowActionsFor: (it) => (it.source === 'Saved' ? ['open', 'delete'] : ['open']),
      emptyHint: 'Save patterns with “Save current”.',
      onOpen: (it) => cb.current.onOpen(it),
      onDelete: (it) => cb.current.onDelete(it),
    });
    return () => br.current && br.current.destroy();
  }, []);
  useEffect(() => { if (br.current) br.current.setItems(items); }, [items]);
  return h('div', { ref: host });
}

/* Named-pattern import — one line or a pasted block. Collapsed by default so
   the rail stays a picker; the syntax is shown in the placeholder because it
   is the whole interface (docs/SERPE_RECOVERY.md). */
function NamedImport({ onImport }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [errs, setErrs] = useState([]);
  if (!open) {
    return h('button', { className: 'es-btn es-small ghost', style: { width: '100%', marginBottom: 8 },
      onClick: () => setOpen(true) }, 'import named…');
  }
  return h('div', { className: 'named-import' },
    h('textarea', { className: 'es-control', rows: 3, value: text, spellCheck: false,
      'aria-label': 'Named patterns to import',
      placeholder: 'Fume-Fume: [0,2,4,7,9]/12\nBembé: 0x5BA:12\nGahu: E(7,12)',
      onChange: e => setText(e.target.value) }),
    h('div', { style: { display: 'flex', gap: 6, margin: '6px 0' } },
      h('button', { className: 'es-btn es-small', disabled: !text.trim(),
        onClick: () => { const e = onImport(text); setErrs(e); if (!e.length) { setText(''); setOpen(false); } } }, 'import'),
      h('button', { className: 'es-btn es-small ghost', onClick: () => { setOpen(false); setErrs([]); } }, 'cancel')),
    errs.length > 0 && h('ul', { className: 'named-errs' },
      errs.map((e, i) => h('li', { key: i }, `line ${e.line}: ${e.error}`))));
}

function EngineView({ create, opts, data }) {
  const host = useRef(null), view = useRef(null);
  useEffect(() => { view.current = create(host.current, opts || {}); }, []);
  useEffect(() => { if (view.current) view.current.update(data); });
  return h('div', { ref: host });
}

// ── Poly lanes view (docs/SERPE_POLY.md §4, semantics revised after field
// testing 2026-07-18) ────────────────────────────────────────────────────────
// Each row shows ONE cycle of its lane, stretched to the full width — so a
// 15-step lane's cells are visibly wider than a 16-step lane's: in the
// default cycle lock (POLYRHYTHM) that IS the timing. Per-lane playheads
// sweep at their own rates. The lock toggle switches to step lock
// (POLYMETER: equal steps, lanes drift); the kit menu sets note defaults
// (a lane's own note input always wins). Routing stays UI state.
//
// Rows/Circle (KT item 9): a second, purely visual reading of the SAME
// lanes as nested rings (engine/render.js createPolyCircleView). Works
// under EITHER lock — the ring geometry comes from the parsed pattern
// (lane.steps/accents), not from how it's scheduled, so it's just as valid
// under step lock as cycle lock (v2: the earlier cycle-lock-only gate is
// gone — see the doc comment on createPolyCircleView for why it was never
// actually needed). Per-lane controls (mute/note/chan/offset) stay in the
// rows either way; Circle only swaps out the flat cell-strip for one
// shared ring graphic above them.
/**
 * What this lane's progressive operator has done by trigger N. Trigger 1 always
 * reads "base" and says nothing further: it IS the untransformed pattern
 * (INTENT D6), and claiming "rotated 0" would suggest otherwise.
 */
function triggerConsequence(lane) {
  const n = lane.triggerIndex || 0;
  const g = lane.progressive;
  if (n <= 1 || !g) return 'base';
  if (g.kind === 'offset')   return `rotated ${g.step * (n - 1)}`;
  if (g.kind === 'lengthen') return `+${g.step * (n - 1)} steps`;
  if (g.kind === 'transform') return `step ${n}`;
  return `trigger ${n}`;
}

function PolyLanesPanel({ poly, lanePh, polyLock, setPolyLock, polyView, setPolyView, drumKit, setDrumKit, kitNames,
                          laneNote, laneChan, laneMuted, setLaneUi, isHost, polyLagMs, setPolyLagMs }) {
  const fmtOff = (o) => o == null ? '' : o.kind === 'ms'
    ? `@${o.ms >= 0 ? '+' : ''}${o.ms}ms` : `@${o.num >= 0 ? '+' : ''}${o.num}/${o.den}`;
  const showCircle = polyView === 'circle';
  return h('div', { className: 'viz poly-lanes' },
    h('div', { className: 'viz-head' },
      h('span', { className: 'es-eyebrow' }, 'Lanes'),
      // Named by WHAT IT DOES, not by the mechanism. This read 'Timing lock'
      // with options 'Cycle' and 'Step' — neither word said polyrhythm or
      // polymeter, and Alex concluded from a DAW session that polymeter was
      // not implemented at all when it was simply the non-default choice of a
      // control naming neither mode (DESIGN_BRIEF §3.3). Values are unchanged:
      // 'cycle'/'step' still go to state, localStorage and the host parameter,
      // so this is a label change and nothing else.
      h('div', { className: 'seg seg-2line', role: 'group', 'aria-label': 'Lane alignment' },
        [['cycle', 'Polyrhythm', 'one shared cycle'],
         ['step', 'Polymeter', 'shared step · drifts']].map(([v, t, sub]) =>
          h('button', { key: v, 'aria-pressed': polyLock === v,
            'aria-label': `${t} — ${sub}`, title: sub,
            onClick: () => setPolyLock(v) },
            h('span', { className: 'seg-name' }, t),
            h('span', { className: 'seg-sub' }, sub)))),
      h('div', { className: 'seg', role: 'group', 'aria-label': 'Lane view',
        title: 'Rows: stacked step lanes. Circle: the same lanes as nested rings — under Step lock the rings still draw correctly, they just won’t stay lined up between realignments.' },
        [['rows', 'Rows'], ['circle', 'Circle']].map(([v, t]) =>
          h('button', { key: v, 'aria-pressed': polyView === v,
            onClick: () => setPolyView(v) }, t))),
      h('label', { className: 'poly-ctl', title: 'Drumkit note defaults by lane label; a lane’s own note input wins' }, 'kit ',
        h('select', { className: 'es-control', value: drumKit, 'aria-label': 'Drumkit',
          onChange: e => setDrumKit(e.target.value) },
          kitNames.map(k => h('option', { key: k, value: k }, k)))),
      // The plugin's base scheduling lag (docs/SERPE_POLY.md §3b/§8.1): an
      // automatable host parameter, so it's only meaningful — and only
      // shown — running in the plugin. The webapp preview uses a fixed
      // constant (POLY_LAG_MS) since it has no host automation to expose.
      isHost && h('label', { className: 'poly-ctl', title: 'Base scheduling lag: every onset is delayed this many ms so a negative (push-early) micro-timing offset has room to land before it' }, 'lag ',
        h('input', { className: 'es-control poly-num', type: 'number', min: 0, max: 200,
          value: polyLagMs, 'aria-label': 'Poly lane lag (ms)',
          onChange: e => setPolyLagMs(Math.max(0, Math.min(200, +e.target.value))) }), 'ms'),
      h('span', { className: 'poly-meta' },
        polyLock === 'cycle' ? `polyrhythm · cycle = ${poly.lanes[0].steps.length} steps of lane 1`
                             : `polymeter · realigns every ${poly.lcm} steps`)),
    showCircle && h('div', { className: 'poly-rings' },
      h(EngineView, { create: createPolyCircleView, opts: {},
        data: { lanes: poly.lanes, lanePh, muted: poly.lanes.map((l, i) => laneMuted(l, i)) } })),
    poly.lanes.map((lane, i) => {
      const muted = laneMuted(lane, i);
      return h('div', { key: lane.label, className: 'poly-lane' + (muted ? ' muted' : '') },
        h('div', { className: 'poly-lane-head' },
          h('button', { className: 'poly-mute', 'aria-pressed': muted,
            title: muted ? 'Unmute lane' : 'Mute lane', 'aria-label': `Mute ${lane.label}`,
            onClick: () => setLaneUi(lane.label, i, { mute: !muted }) }, muted ? '◌' : '●'),
          h('span', { className: 'poly-label' }, lane.label),
          h('span', { className: 'poly-src es-num' }, lane.parsedLabel),
          lane.offset && h('span', { className: 'poly-off es-num', title: 'Micro-timing (Keil) offset' }, fmtOff(lane.offset)),
          h('label', { className: 'poly-ctl' }, 'note ',
            h('input', { className: 'es-control poly-num', type: 'number', min: 0, max: 127,
              value: laneNote(lane, i), 'aria-label': `${lane.label} MIDI note`,
              onChange: e => setLaneUi(lane.label, i, { note: +e.target.value }) })),
          h('label', { className: 'poly-ctl' }, 'ch ',
            h('input', { className: 'es-control poly-num', type: 'number', min: 1, max: 16,
              value: laneChan(lane, i), 'aria-label': `${lane.label} MIDI channel`,
              onChange: e => setLaneUi(lane.label, i, { chan: +e.target.value }) }))),
        // Trigger readout — the ordinal the engine is on, plus what this
        // lane's operator does with it. Absent (not zero) when the engine has
        // not reported one, so it never invents a number.
        lane.triggerIndex > 0 && h('span', { className: 'trig-chip', title: 'Trigger the engine is on for this lane' },
          h('span', { className: 'trig-n' }, `\u27F3 ${lane.triggerIndex}`),
          h('span', { className: 'trig-what' }, triggerConsequence(lane))),
        !showCircle && h('div', { className: 'poly-cells', role: 'img',
          'aria-label': `${lane.label}: ${lane.steps.join('')} over ${lane.steps.length} steps` },
          lane.steps.map((s, c) =>
            h('span', {
              key: c,
              className: 'poly-cell' + (s ? ' on' : '') + (lane.accents[c] ? ' acc' : '')
                + (c === lanePh[i] ? ' ph' : ''),
            }))));
    }));
}

function SerpeApp() {
  // Per-lane accent precession, the poly counterpart of mono's accentOffset.
  // The ref is what the scheduler reads (synchronously, like lanePhRef); the
  // state is what the display re-renders from.
  // Shared trigger ordinal for poly progression in the WEBAPP. In a plugin the
  // engine owns this and reports it back via polyState; here the app is the
  // engine, so it counts — and feeds the same trigger chip.
  const [polyTrig, setPolyTrig] = useState(1);
  const laneAccOffRef = useRef([]);
  const [laneAccOff, setLaneAccOff] = useState([]);
  const [steps, setSteps]     = useState(() => euclid(5, 8));
  // Accents are derived: the raw {…} pattern re-applied to the onsets with a
  // live offset, so they precess across playback cycles (offset from the C++
  // engine in the plugin, tracked locally in the webapp).
  // The accent layer is a single {bits} pattern (cyclic over onsets). Hand-edits
  // write an explicit length-K pattern; either way it lives in the UPI as {bits},
  // so it survives transforms and round-trips. No separate override state.
  const [accentPattern, setAccentPattern] = useState(null);
  const [accentOffset, setAccentOffset] = useState(0);
  const [editAccent, setEditAccent] = useState(false);
  // In the plugin the C++ engine is authoritative: it reports the real per-step
  // accents (matching what's heard). When set, these override the JS derivation.
  const [engineAccents, setEngineAccents] = useState(null);
  const [label, setLabel]     = useState('E(5,8)');
  const [upiText, setUpiText] = useState(LS.get('upi', 'E(5,8)'));
  const [accText, setAccText] = useState('');
  const [parseErr, setParseErr] = useState(null);

  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [tempo, setTempo]     = useState(+LS.get('tempo', 120));
  const [group, setGroup]     = useState(4);
  const [swing, setSwing]     = useState(0);
  const [subdiv, setSubdiv]   = useState(5);   // subdivision param index (5 = 16th)
  const [lenUnit, setLenUnit] = useState(0);   // patternLengthUnit (0 Steps,1 Beats,2 Bars,3 Auto)
  const [lenVal, setLenVal]   = useState(4);   // patternLengthValue index (4 = "1")
  const [view, setView]       = useState('both');
  const [showLabels, setShowLabels] = useState(false);

  const [runtime, setRuntime] = useState(juceAvailable() ? 'plugin' : 'webapp');
  const cfg = RT[runtime];
  // Density lives on <body> now (the shared cluster toggles .es-dense there);
  // seed the runtime default once.
  useEffect(() => { document.body.classList.toggle('es-dense', cfg.dense); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [genType, setGenType] = useState('E');
  const [genK, setGenK] = useState(5), [genN, setGenN] = useState(8), [genRot, setGenRot] = useState(0);
  const [funkiness, setFunkiness] = useState(50);   // % deviation for the Funk generator
  const [dilMode, setDilMode] = useState('barlow');   // dilute/concentrate weighting
  const [mutStyle, setMutStyle] = useState('balanced');   // mutation style
  const [mutAmount, setMutAmount] = useState(50);         // mutation amount %

  // Long/short durations + the pattern library (docs/SERPE_RECOVERY.md).
  const [lsMin, setLsMin] = useState(+LS.get('lsMin', 1.5));
  const [lsMax, setLsMax] = useState(+LS.get('lsMax', 1.5));
  const [lsDepth, setLsDepth] = useState(+LS.get('lsDepth', 0));
  // Microtiming (Keil participatory discrepancies): push/pull around the beat.
  const [pdDepth, setPdDepth] = useState(+LS.get('pdDepth', 0));
  const [pdSeed, setPdSeed] = useState(1);
  const [pdCycle, setPdCycle] = useState(0);   // bumped each cycle so passes differ
  useEffect(() => { LS.set('lsMin', lsMin); LS.set('lsMax', lsMax); LS.set('lsDepth', lsDepth);
                    LS.set('pdDepth', pdDepth); },
            [lsMin, lsMax, lsDepth, pdDepth]);

  const [accVel, setAccVel] = useState(112);
  const [unaccVel, setUnaccVel] = useState(72);
  const [accPitch, setAccPitch] = useState(0);
  const [midiNote, setMidiNote] = useState(38);
  const [midiChan, setMidiChan] = useState(1);
  // ── Standalone MIDI I/O (webapp runtime only; the plugin uses C++ MIDI) ──
  const [midiPorts, setMidiPorts] = useState({ inputs: [], outputs: [] });
  const [midiInId, setMidiInId]   = useState(() => LS.get('midiIn', ''));
  const [midiOutId, setMidiOutId] = useState(() => LS.get('midiOut', ''));
  const [midiErr, setMidiErr]     = useState('');

  const [progOff, setProgOff] = useState(1);
  const [progLeng, setProgLeng] = useState(false);
  const [cycle, setCycle] = useState(0);
  // Notation-driven progression (`E(1,8)>8`, `E(3,8)%2`, `E(3,8)*3`) as opposed
  // to the slider-driven one below. The webapp had NEITHER until 2026-08-01:
  // parseUPI is the single-body parser and rejects every progressive form, so
  // standalone answered "Unrecognised" for notation the plugin plays. In the
  // plugin the string goes straight to C++ (engine-authoritative, INTENT D3),
  // which is why this only ever bit outside a host.
  const progNotationRef = useRef(null);   // { desc, index } or null
  const baseRef = useRef(null);
  const lenRef = useRef(null);   // accumulating pattern for progressive lengthening

  const [scenes, setScenes] = useState(() => new Array(8).fill(null));
  const [activeScene, setActiveScene] = useState(-1);

  const parseJSON = (k, d) => { try { return JSON.parse(LS.get(k, d)); } catch { return JSON.parse(d); } };
  const [lib, setLib]   = useState(() => parseJSON('library', '[]'));
  const [hist, setHist] = useState(() => parseJSON('history', '[]'));
  const [waOn, setWaOn] = useState(true), [waVol, setWaVol] = useState(0.7);
  const [hostSync, setHostSync] = useState(false);
  const [hostInfo, setHostInfo] = useState(null);  // { bpm, playing } from C++

  const a = useMemo(() => analyse(steps), [steps]);
  const sync = useMemo(() => analyzeSyncopation(steps, steps.length), [steps]);
  const accents = useMemo(() => engineAccents || applyAccents(steps, accentPattern, accentOffset),
    [steps, accentPattern, accentOffset, engineAccents]);
  // Round-trippable pattern notation: hex + step count for ≤64 steps; binary
  // beyond that (the C++ hex/decimal parse is 64-bit, so longer patterns — e.g.
  // progressive lengthening — would lose their high onsets as trailing zeros).
  const patternUPI = (s) => s.length > 64
    ? 'b' + s.map(x => (x ? 1 : 0)).join('')
    : `${analyse(s).hex}:${s.length}`;

  // live mirror for the audio loop (avoids stale closures)
  // ── Poly lanes (docs/SERPE_POLY.md; the C++ engine plays them too now —
  // SERPE_POLY §8 milestone 2). `poly` is the parsed PolyResult when the UPI
  // field holds `/`-separated lanes, else null (mono mode, everything as
  // before). Routing lives in UI state per the design note: the notation
  // says WHEN, this rack says WHAT.
  const [poly, setPoly] = useState(null);
  const [polyUi, setPolyUi] = useState(() => LS.get('polyUi', {}));
  // Playback lock (user call, 2026-07-18): 'cycle' = POLYRHYTHM, the default —
  // every lane spans the SAME cycle, so 15 against 16 is a true cross-rhythm
  // (steps of different sizes). 'step' = POLYMETER — equal step sizes, lanes
  // drift and realign at the lcm. The first lane defines the cycle length.
  const [polyLock, setPolyLock] = useState(() => LS.get('polyLock', 'cycle'));
  // Lane VISUALIZATION mode (KT item 9): 'rows' (default, stacked strips) or
  // 'circle' (nested rings — see PolyLanesPanel). Works under either timing
  // lock; no fallback needed (v2 dropped the earlier cycle-lock-only gate).
  const [polyView, setPolyView] = useState(() => LS.get('polyView', 'rows'));
  // Per-lane playheads (each lane cycles its own length at its own rate). In
  // the plugin these come from the C++ engine (the 'polyState' bridge event,
  // real playback); in the webapp the JS scheduler (polyPlayStart) drives them.
  const [lanePh, setLanePh] = useState([]);
  // Plugin-only: what the C++ engine says each lane is ACTUALLY sounding —
  // rotated by its progressive offset, grown by its lengthening, and resolved
  // to the scene that lane is on. The panel used to draw from the JS parse of
  // the typed text, so a lane with a `|` chain displayed its first scene
  // forever while the engine cycled behind it (Alex, 2026-07-29). The webapp's
  // own scheduler below still uses the JS parse — it IS the engine there.
  const [engineLanes, setEngineLanes] = useState(null);
  // ── Plugin-only: lane note/channel/mute mirror the automatable APVTS
  // params (laneNote0-5/laneChannel0-5/laneMute0-5), not local-only state —
  // a host can automate them, and a saved session recalls them. Index-keyed
  // (a lane's C++ param slot is its position, not its label). polyUi (above)
  // stays the webapp's label-keyed, localStorage-persisted routing.
  const [hostLaneParams, setHostLaneParams] = useState(() => Array.from({ length: 6 }, () => ({})));
  const [polyLagMs, setPolyLagMs] = useState(60);
  // The engine's lane patterns win for DISPLAY when the plugin is reporting
  // them; the parsed lane keeps its label, offset and routing. Falls back to
  // the JS parse in the webapp, or before the first polyState arrives.
  const displayPoly = useMemo(() => {
    if (!poly) return poly;
    // STANDALONE: no engine to report lane state, so derive it here. Each lane
    // resolves its own progression at the shared trigger ordinal — polyLaneAt
    // is pure in that index, so replaying the same number always gives the
    // same pattern, and the chip below shows the number it was derived from
    // rather than a tally kept beside it.
    if (!engineLanes || !Array.isArray(engineLanes.patterns)) {
      if (!poly.lanes.some((l) => l.progressive)) return poly;
      return {
        ...poly,
        lanes: poly.lanes.map((lane) => (lane.progressive
          ? { ...lane, steps: polyLaneAt(lane, polyTrig), triggerIndex: polyTrig }
          : { ...lane, triggerIndex: polyTrig })),
      };
    }
    return {
      ...poly,
      lanes: poly.lanes.map((lane, i) => {
        const bits = engineLanes.patterns[i];
        if (typeof bits !== 'string' || bits.length === 0) return lane;
        const si = engineLanes.sceneIndices[i] ?? 0;
        const sc = engineLanes.sceneCounts[i] ?? 1;
        const steps = Array.from(bits, (c) => c === '1');
        return {
          ...lane,
          steps,
          // Accents came from the parsed scene; a lengthened lane is longer
          // than they are, and an absent entry just reads as unaccented.
          accents: lane.accents ?? [],
          sceneIndex: si,
          sceneCount: sc,
          triggerIndex: engineLanes.triggers?.[i] ?? 0,
          // Label the scene actually sounding, with its position in the chain.
          // Showing the first scene's text forever was half of what looked
          // like a frozen display (Alex, 2026-07-29).
          parsedLabel: sc > 1 && Array.isArray(lane.scenes) && lane.scenes[si]
            ? `${lane.scenes[si]}  (${si + 1}/${sc})`
            : lane.parsedLabel,
        };
      }),
    };
  }, [poly, engineLanes, polyTrig]);

  const setLaneUi = (label, i, patch) => {
    if (cfg.host && juceAvailable()) {
      setHostLaneParams(prev => {
        const next = prev.slice();
        next[i] = { ...next[i], ...patch };
        return next;
      });
      if ('note' in patch) sendParamActual(`laneNote${i}`, patch.note);
      if ('chan' in patch) sendParamActual(`laneChannel${i}`, patch.chan);
      if ('mute' in patch) sendParamActual(`laneMute${i}`, patch.mute ? 1 : 0);
      return;
    }
    setPolyUi(u => {
      const next = { ...u, [label]: { ...u[label], ...patch } };
      LS.set('polyUi', next);
      return next;
    });
  };
  // Drumkit note maps: label → MIDI note. A kit sets the DEFAULTS; a lane's
  // own note input always wins. 'Chromatic C2' maps lanes 36, 37, 38… by index.
  const KITS = {
    'GM': { kick: 36, snare: 38, rim: 37, clap: 39, hat: 42, hihat: 42, openhat: 46,
            pedal: 44, tom: 45, tomhi: 50, crash: 49, ride: 51, cow: 56, clave: 75 },
    'Volca Beats': { kick: 36, snare: 38, tom: 43, tomhi: 50, hat: 42, hihat: 42,
                     openhat: 46, clap: 39, clave: 75, agogo: 67, crash: 49 },
    'Chromatic C2': null,
  };
  const [drumKit, setDrumKit] = useState(() => LS.get('drumKit', 'GM'));
  // In the plugin, a lane's routing is the automatable APVTS param
  // (hostLaneParams, synced via the bridge); the kit/polyUi chain below is
  // only the pre-first-snapshot default while that arrives.
  const laneNote = (lane, i) => (cfg.host ? hostLaneParams[i]?.note : undefined) ?? polyUi[lane.label]?.note
    ?? (KITS[drumKit] ? KITS[drumKit][lane.label.toLowerCase()] : undefined)
    ?? (KITS[drumKit] === null ? 36 + i : 60 + i * 2);
  const laneChan = (lane, i) => (cfg.host ? hostLaneParams[i]?.channel : undefined) ?? polyUi[lane.label]?.chan
    ?? (KITS[drumKit] && KITS[drumKit][lane.label.toLowerCase()] !== undefined ? 10 : midiChan);
  const laneMuted = (lane, i) => cfg.host ? !!hostLaneParams[i]?.mute : !!polyUi[lane.label]?.mute;
  // Advance-on-note-in is a SPECIAL CASE, not the default (user call: an IAC
  // echo or any incoming note shouldn't silently rotate the pattern).
  const [midiAdvance, setMidiAdvance] = useState(() => LS.get('midiAdvance', false));

  const live = useRef({});
  live.current = { steps, accents, accentPattern, accText, editAccent, tempo, group, swing, waOn, waVol,
                   midiNote, accVel, unaccVel, accPitch, midiChan, midiInId, midiOutId,
                   poly, polyUi, polyLock, drumKit, midiAdvance, pdDepth, pdSeed, pdCycle };

  // Notes we've sent out recently, so we can drop their echo when the same port
  // is routed back into our input (e.g. IAC In == Out) — otherwise each output
  // note re-triggers an advance and the pattern "swirls".
  const sentEcho = useRef([]);

  // MIDI-in handler, refreshed each render so the once-registered listener never
  // sees stale state. Parity with the plugin: an incoming note sets the output
  // pitch and advances (next scene if any are filled, else the progressive).
  const onMidiNoteRef = useRef(() => {});
  onMidiNoteRef.current = (e) => {
    const L = live.current;
    // Echo guard: only a concern when In and Out are the same port. Drop an
    // incoming note that matches one we just sent on the same channel.
    if (L.midiInId && L.midiInId === L.midiOutId) {
      const now = performance.now();
      sentEcho.current = sentEcho.current.filter(s => now - s.t < 200);
      const i = sentEcho.current.findIndex(s => s.n === e.note && s.c === e.channel);
      if (i >= 0) { sentEcho.current.splice(i, 1); return; }
    }
    setMidiNote(Math.max(0, Math.min(127, e.note)));
    // Advancing the pattern from a note-in is opt-in (Timing & output →
    // "advance on note-in") — the special case, not the default. Without the
    // gate, any routed-back note (IAC loops, monitoring) swirls the pattern.
    if (!L.midiAdvance) return;
    const filled = scenes.map((s, i) => (s ? i : -1)).filter(i => i >= 0);
    if (filled.length) { const c = filled.indexOf(activeScene); sceneClick(filled[(c + 1 + filled.length) % filled.length]); }
    else progAdvance();
  };

  // The {bits} prefix to carry the accent layer (field overrides inline).
  const accLayerPrefix = (L) => L.accText.trim() ? ''
    : (L.accentPattern && L.accentPattern.length ? `{${L.accentPattern.join('')}}` : '');

  // Tap a step (lane or circle node). Accent-edit mode toggles that onset's
  // accent and writes the whole accent layer back as an explicit length-K {bits}
  // pattern (so it persists + round-trips); otherwise it toggles the onset.
  // Both go through the UPI path so they work in browser and plugin. Reads refs
  // to stay correct from the mount-time closure render.js holds.
  const toggleStepAt = (i) => {
    const L = live.current;
    if (L.editAccent) {
      if (!L.steps[i]) return;                     // accents land only on onsets
      const acc = L.accents.slice(); acc[i] = acc[i] ? 0 : 1;
      const perOnset = [];
      for (let s = 0; s < L.steps.length; s++) if (L.steps[s]) perOnset.push(acc[s] ? 1 : 0);
      const prefix = perOnset.some((b) => b) ? `{${perOnset.join('')}}` : '';
      setUpiText(prefix + patternUPI(L.steps));
      if (juceAvailable()) sendToggleAccent(i);
      return;
    }
    const next = L.steps.slice(); next[i] = L.steps[i] ? 0 : 1;
    setUpiText(accLayerPrefix(L) + patternUPI(next));
  };

  // ── apply runtime to the document (theme is owned by @enkerli/ui/theme) ──
  useEffect(() => { document.documentElement.setAttribute('data-runtime', runtime); }, [runtime]);

  // ── core: set a pattern from parsed UPI or generator ──
  // Clear all progressive state. Called by every action that REPLACES the
  // pattern (type, load, generate, one-shot transform/mutate/dilute, scene) so
  // no stale base/length/cycle leaks into the next progression. progAdvance is
  // the one action that does NOT call this — it deliberately continues.
  function resetProgressive() { baseRef.current = null; lenRef.current = null; progNotationRef.current = null; setCycle(0); }

  function applyPattern(p, { syncField = true } = {}) {
    setSteps(p.steps); setAccentPattern(p.accentPattern); setAccentOffset(0); setLabel(p.label);
    if (syncField && p.label) setUpiText(p.label);
    // An LS(…) suffix in the notation drives the Durations controls, so the
    // text field is a complete way to state a rhythm INCLUDING how it breathes
    // — not just which steps sound.
    if (p.longShort) {
      setLsMin(p.longShort.min); setLsMax(p.longShort.max); setLsDepth(p.longShort.depth);
    }
    if (p.microtiming) { setPdDepth(p.microtiming.depth); setPdSeed(p.microtiming.seed); }
  }

  // The full engine string: the Accents field prepends as {…} unless the
  // pattern text already carries its own inline prefix (don't double up).
  function fullUPI(text = upiText, acc = accText) {
    const hasInline = /^\s*\{/.test(text);
    return (!hasInline && acc.trim()) ? `{${acc.trim()}}${text}` : text;
  }

  // Notation the C++ engine advances on re-send: scenes (a|b|c), progressive
  // transforms (pat>N), and progressive offset/lengthening (pat%N, pat+N, pat*N
  // with a numeric tail). Combinations (pat+pat) don't match — the tail isn't
  // numeric — and route to the engine as plain re-parses, same as Tick.
  const ENGINE_ADVANCE_RE = /[|>]|[%+*]\s*-?\d+\s*$/;

  function parseField(text = upiText, acc = accText) {
    // Poly lanes (top-level `/`): the C++ engine plays these too now
    // (SERPE_POLY.md §8 milestone 2) — send the raw text same as mono's
    // engine-authoritative path below. Accents are inline per lane ({…}
    // inside each lane); the Accents field is mono's, never merged in here.
    // Scenes ('|') come here too, even with no top-level '/'. parsePolyUPI
    // handles the one-lane case and returns the scene chain; the mono path
    // below uses the single-body parser, which rejects '|' outright — so
    // standalone answered "unrecognised" for notation the plugin plays, while
    // ENGINE_ADVANCE_RE above already listed '|' as engine notation. Same
    // one-line root cause fixed in `msuite upi` on 2026-08-01.
    //
    // FOR THE DESIGN PASS: a scene chain with no '/' now renders through the
    // POLY panel as a single lane. That is correct but not obviously right —
    // see docs/DESIGN_BRIEF.md §3.1.
    if (splitLanes(text).length > 1 || text.includes('|')) {
      LS.set('upi', text);
      const pp = parsePolyUPI(text, { n: steps.length || 16 });
      // Mid-edit errors KEEP the last good poly (same contract as mono, which
      // keeps its last good steps) — typing never blanks a playing pattern.
      if (pp.ok) {
        // A different poly string starts its chains over; re-submitting the
        // SAME one advances, matching Enter's meaning in the plugin.
        setPolyTrig((t) => (poly && formatPolyUPI(poly) === formatPolyUPI(pp) ? t + 1 : 1));
        setPoly(pp); setParseErr(null);
      }
      else setParseErr(pp.error || 'unrecognised poly');
      // Plugin: send raw, don't gate on the JS parse succeeding — the C++
      // engine is authoritative and has its own fallback for a bad string
      // (same reasoning as the mono host branch just below).
      if (cfg.host && juceAvailable()) sendUPI(text);
      return;
    }
    const full = fullUPI(text, acc);
    LS.set('upi', text);
    if (cfg.host && juceAvailable()) {
      // Plugin: the C++ engine is authoritative — send raw (don't gate on the JS
      // subset parser) so Morse / > / progressive / combinations all reach it;
      // the display comes back via engineState. Use the JS parse only as a soft
      // hint (it may not understand engine-only notation).
      sendUPI(full);
      setParseErr(null);
      // No '/' in this string, so we have just left poly. Retire the lanes
      // here as well as in the standalone branch below: this branch returns
      // early, so without it the plugin kept the old poly panel on screen
      // over a pattern that is now mono.
      if (poly) setPoly(null);
      return;
    }
    const p = parseUPI(full, { n: steps.length || 16 });
    if (p.ok) {
      progNotationRef.current = null;
      setParseErr(null); applyPattern(p, { syncField: false }); if (poly) setPoly(null);
      return;
    }
    // Progressive notation denotes a pattern PER TRIGGER, so the pure parser has
    // nothing single to return and refuses. Show trigger 1 — the bare base
    // (INTENT D6) — and let Advance step it, which is what the engine does.
    const desc = parseProgressive(full);
    // Re-submitting the SAME progressive string ADVANCES it — that is what
    // Enter does in the plugin (the string is re-sent and the engine steps),
    // and the webapp has to match or Enter would silently restart a chain the
    // user is playing. A DIFFERENT string starts over at the base.
    const prev = progNotationRef.current;
    const same = prev && desc && prev.desc.source === desc.source;
    const index = same ? prev.index + 1 : 1;
    const first = desc && progressiveAt(desc, index, {
      parseBase: (str) => { const r = parseUPI(str, { n: steps.length || 16 }); return r.ok ? { steps: r.steps } : null; },
    });
    if (first && !first.error) {
      progNotationRef.current = { desc, index };
      setCycle(index - 1);
      setParseErr(null);
      setSteps(first.steps);
      setLabel(desc.source);
      if (poly) setPoly(null);
      return;
    }
    progNotationRef.current = null;
    setParseErr(p.error || 'unrecognised');
  }

  // parse whenever the text/accents change (debounced-ish via React batching)
  useEffect(() => { parseField(); /* eslint-disable-next-line */ }, [upiText, accText]);

  // record settled (valid) patterns in history — debounced so mid-typing
  // keystrokes don't pile up; dedups and caps at 16.
  const histTimer = useRef(null);
  useEffect(() => {
    const u = upiText.trim();
    if (parseErr || !u) return;
    clearTimeout(histTimer.current);
    histTimer.current = setTimeout(() => {
      setHist(prev => { const next = [u, ...prev.filter(x => x !== u)].slice(0, 16); LS.set('history', JSON.stringify(next)); return next; });
    }, 700);
    return () => clearTimeout(histTimer.current);
  }, [upiText, parseErr]);

  // The accent layer to carry onto a new pattern. If it lives in the Accents
  // field, parseField prepends it (return ''); if it was typed inline in the UPI
  // field, re-attach it as a {…} prefix so it survives the change either way.
  function accentPrefix() {
    if (accText.trim()) return '';
    return (accentPattern && accentPattern.length) ? `{${accentPattern.join('')}}` : '';
  }

  // ── generators ──
  function generate() {
    resetProgressive();
    // Funk is stochastic (no notation) — write the explicit steps. Others write
    // their UPI label so the engine regenerates them.
    if (genType === 'F') {
      const s = funkyEuclidean(genN, { hits: genK, rotation: genRot, funkiness: funkiness / 100 });
      setUpiText(accentPrefix() + patternUPI(s));
      return;
    }
    let lbl;
    if (genType === 'E') lbl = `E(${genK},${genN}${genRot ? ',' + genRot : ''})`;
    else if (genType === 'P') lbl = `P(${genK},${genRot},${genN})`;
    else if (genType === 'R') lbl = `R(${genK},${genN})`;
    else lbl = `${genType}(${genK},${genN})`;
    setUpiText(accentPrefix() + lbl);   // keep the accent layer across pattern changes
  }

  // ── transforms ──
  function applyTransform(fn) {
    if (poly) return;     // poly slice 1: transforms are mono-only (SERPE_POLY.md §4)
    resetProgressive();   // a one-shot transform starts a fresh pattern
    // Re-attach the accent layer to the new pattern; parseField applies it and
    // sends the UPI — so accents survive transforms (inline or from the field).
    setUpiText(accentPrefix() + patternUPI(fn(steps.slice())));
  }
  const TX = {
    rotl: s => rotate(s, -1),
    rotr: s => rotate(s, 1),
    comp: complement,                  // swap onsets and rests (the webapp's "invert")
    retro: s => s.slice().reverse(),   // retrograde — reverse the step order
  };
  // Mutate: move each onset by the selected style/amount (keeps onset count).
  // amount is 0..1; defaults to the UI's mutAmount (also used by the control plane).
  function applyMutate(amount = mutAmount / 100) {
    if (poly) return;     // mono-only in poly slice 1
    resetProgressive();
    const r = mutatePattern(steps.slice(), amount, { mutationStyle: mutStyle });
    setUpiText(accentPrefix() + patternUPI(r.mutated.map(Number)));
  }
  // Resize to n steps, keeping the onset count (re-spaced Euclidean) — the
  // control plane's `steps` param. Predictable: same hits, new grid.
  function applyResize(n) {
    if (poly) return;     // mono-only in poly slice 1
    const target = Math.max(1, Math.min(128, Math.round(n)));
    if (target === steps.length) return;
    resetProgressive();
    setUpiText(patternUPI(euclid(Math.max(1, Math.min(target, onsetCount(steps))), target)));
  }
  // Dilute (−1 onset) / concentrate (+1) using the selected weighting — Euclid,
  // Dilcue, Barlow and Wolrab are all *modes* that change onset count (as in the
  // original engine), not fixed-count regenerators.
  function applyDilCon(delta) {
    const n = steps.length, k = onsetCount(steps);
    const target = Math.max(1, Math.min(n, k + delta));
    if (target === k) return;
    resetProgressive();
    let next;
    if (dilMode === 'barlow')      next = barlowTransform(steps.slice(), target, false);
    else if (dilMode === 'wolrab') next = barlowTransform(steps.slice(), target, true);
    else if (dilMode === 'euclid') next = euclid(target, n);                 // even spacing
    else                           next = complement(euclid(n - target, n)); // dilcue: anti-even
    setUpiText(accentPrefix() + patternUPI(next));
  }

  // ── control plane: keyboard shortcuts + incoming messages (control.js) ──
  // Serpe's actions, exposed to the plane. Kept in a ref so the keyboard/bus
  // listeners always see the current handlers (no stale closures across renders).
  const ctlApi = useRef({});
  ctlApi.current = {
    rotate: (by) => applyTransform((s) => rotate(s, by)),
    invert: () => applyTransform(invert),
    complement: () => applyTransform(complement),
    mutate: (amount) => applyMutate(amount),
    setTempo, setSwing, setSteps: applyResize,
    setPattern: (s) => applyTransform(() => s),
  };
  useEffect(() => connectSerpe({ getApi: () => ctlApi.current, manifests: [serpeManifest] }), []);

  // ── progressive ──
  // Each step evolves the base rhythm and re-attaches the accent layer (via
  // accentPrefix, inline or field), so accents survive progressive offset AND
  // lengthening — parseField re-applies them, onset-indexed, to the new pattern.
  function progAdvance() {
    // Poly lanes advance too. This used to return early ("mono-only in poly
    // slice 1"), so Advance did nothing at all for a poly pattern while
    // working for the same notation on one lane — reported 2026-08-01.
    //
    // One shared ordinal, applied per lane: every trigger advances EVERY
    // lane's own chain by one, and each lane derives its own pattern from it
    // (INTENT D5 — lanes are independent in what they do per trigger, not in
    // how often they are triggered). polyLaneAt is a pure function of that
    // index, so this cannot drift the way an accumulated pattern can.
    if (poly) {
      if (!poly.lanes.some((l) => l.progressive)) return;   // nothing to advance
      if (cfg.host && juceAvailable()) { sendUPI(fullUPI()); return; }  // engine owns it
      setPolyTrig((t) => t + 1);
      return;
    }
    // Plugin + engine notation in the field (scenes / >N / %N / *N): the C++
    // engine owns progression — re-send the same string to advance (the exact
    // semantics of Tick and MIDI-in). The local rotate below stays for the
    // slider-driven progression and for the webapp.
    if (cfg.host && juceAvailable() && ENGINE_ADVANCE_RE.test(upiText)) {
      setCycle(c => c + 1);          // display hint; the engine holds the truth
      sendUPI(fullUPI());
      return;
    }
    // Notation-driven progression wins over the slider: the field says what to
    // do, and progressiveAt is a pure function of the trigger index, so this
    // cannot drift the way an accumulated pattern can.
    if (progNotationRef.current) {
      const g = progNotationRef.current;
      const n = g.index + 1;
      const r = progressiveAt(g.desc, n, {
        parseBase: (str) => { const q = parseUPI(str, { n: steps.length || 16 }); return q.ok ? { steps: q.steps } : null; },
      });
      if (r && !r.error) {
        g.index = n;
        setCycle(n - 1);
        setSteps(r.steps);
        return;
      }
    }
    if (!baseRef.current) baseRef.current = { steps: steps.slice() };
    const c = cycle + 1; setCycle(c);
    let next;
    if (progLeng) {
      // Lengthening = APPEND bell-curve random steps to the accumulating pattern
      // (the base is preserved; the pattern grows), matching the C++ engine's
      // advanceProgressiveLengthening — NOT a fresh Euclidean. The offset slider
      // sets how many steps are added per cycle (≥1, so it works at offset 0).
      const cur = lenRef.current || baseRef.current.steps.slice();
      next = cur.concat(bellCurveRandomSteps(Math.max(1, Math.abs(progOff))));
      lenRef.current = next.slice();
    } else {
      next = rotate(baseRef.current.steps, progOff * c);
    }
    setUpiText(accentPrefix() + patternUPI(next));
  }
  function progReset() {
    setCycle(0);
    lenRef.current = null;
    if (baseRef.current) setUpiText(accentPrefix() + patternUPI(baseRef.current.steps));
    baseRef.current = null;
  }

  // ── scenes ──
  function sceneClick(i) {
    setScenes(prev => {
      const next = prev.slice();
      if (next[i]) {
        const sc = next[i];
        resetProgressive();
        setSteps(sc.steps.slice()); setAccentPattern(sc.accentPattern); setAccentOffset(0); setLabel(sc.label); setUpiText(sc.label);
        setActiveScene(i);
      } else {
        next[i] = { steps: steps.slice(), accentPattern, label: label || analyse(steps).binary };
        setActiveScene(i);
      }
      return next;
    });
  }
  function sceneClear(i) { setScenes(prev => { const n = prev.slice(); n[i] = null; return n; }); if (activeScene === i) setActiveScene(-1); }

  // ── transport (Web Audio in standalone; host drives the plugin) ──
  const audioCtx = useRef(null), timer = useRef(null);
  function click(accent) {
    const L = live.current;
    if (!cfg.web || !L.waOn || !audioCtx.current) return;  // Web Audio is webapp-only
    const t = audioCtx.current.currentTime;
    const o = audioCtx.current.createOscillator(), g = audioCtx.current.createGain();
    o.frequency.value = accent ? 1320 : 880; g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.current.destination);
    const v = L.waVol * (accent ? 1 : 0.55);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.start(t); o.stop(t + 0.1);
  }
  // MIDI out (standalone): play the onset on the selected output. Accents take
  // the accent velocity and pitch offset, matching the plugin's engine.
  function midiHit(accent, idx) {
    const L = live.current;
    if (!L.midiOutId) return;
    const note = Math.max(0, Math.min(127, L.midiNote + (accent ? L.accPitch : 0)));
    sendMidiNoteOn(note, accent ? L.accVel : L.unaccVel, L.midiChan);
    if (L.midiInId && L.midiInId === L.midiOutId) sentEcho.current.push({ n: note, c: L.midiChan, t: performance.now() });
    setTimeout(() => sendMidiNoteOff(note, L.midiChan), Math.max(30, stepDur(idx) * 0.9));
  }
  function stepDur(idx) {
    const L = live.current; const grp = L.group || 4;
    const base = (60 / L.tempo) / grp; const s = L.swing / 100 * 0.5;
    let ms = (s <= 0) ? base * 1000 : base * (idx % 2 === 0 ? 1 + s : 1 - s) * 1000;
    // Microtiming rides ON TOP of swing: swing is a fixed, repeating subdivision;
    // push/pull is a correlated walk that differs per cycle. Applied as a scale
    // on this step's length, and because the scales are differenced from
    // per-onset displacements the cycle still lasts exactly as long as it did.
    if (L.pdDepth > 0 && L.steps && L.steps.length) {
      const sc = pdScales(L.steps, L.pdDepth, L.pdSeed, L.pdCycle);
      ms *= sc[idx % sc.length] ?? 1;
    }
    return ms;
  }
  // Memoised per (pattern, depth, seed, cycle) — recomputing a whole cycle's
  // walk on every step would be wasteful and, worse, non-deterministic in feel.
  const pdCache = useRef({ key: null, scales: null });
  function pdScales(stepsArr, depth, seed, cycle) {
    const key = stepsArr.join('') + '|' + depth + '|' + seed + '|' + cycle;
    if (pdCache.current.key !== key) {
      const sh = microtiming(stepsArr.map(Boolean), { depth, seed, pass: cycle });
      pdCache.current = { key, scales: timingScales(sh) };
    }
    return pdCache.current.scales;
  }
  // ── Poly playback: PER-LANE clocks (SERPE_POLY.md, playback semantics
  // decided 2026-07-18 after field testing). Default 'cycle' lock is
  // POLYRHYTHM: every lane spans the same cycle (the first lane's natural
  // length at the base step rate), so 15 against 16 is a steady cross-rhythm.
  // 'step' lock is POLYMETER: equal step sizes, lanes drift and realign.
  // Every hit is scheduled POLY_LAG ms out so a negative Keil offset (a push)
  // can genuinely sound EARLY relative to the grid — you can't play in the
  // past, but you can delay the whole band a constant everyone shares.
  const POLY_LAG_MS = 60;
  const POLY_FREQS = [220, 880, 1760, 440, 1320, 660, 2200, 330]; // audibly distinct lanes
  const laneTimers = useRef([]);
  function polyClick(laneIdx, accent) {
    const L = live.current;
    if (!cfg.web || !L.waOn || !audioCtx.current) return;
    const t = audioCtx.current.currentTime;
    const o = audioCtx.current.createOscillator(), g = audioCtx.current.createGain();
    o.frequency.value = POLY_FREQS[laneIdx % POLY_FREQS.length] * (accent ? 1.5 : 1);
    g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.current.destination);
    const v = L.waVol * (accent ? 1 : 0.55);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.start(t); o.stop(t + 0.1);
  }
  // Math lives in engine/poly-clock.js (pulled out and unit-tested with
  // coprime step counts — 8-vs-16-style fixtures realign too fast to prove
  // anything about the two lock modes actually differing). These wrappers
  // just adapt the pure functions to the live React state.
  function laneOffsetMs(lane) { return computeLaneOffsetMs(lane, live.current.tempo); }
  function laneStepMs(lane) {
    const L = live.current;
    return computeLaneStepMs({
      lane,
      refSteps: L.poly ? L.poly.lanes[0].steps.length : undefined,
      polyLock: (!L.poly || L.polyLock === 'step') ? 'step' : 'cycle',
      tempo: L.tempo, group: L.group,
    });
  }
  // Per-lane microtiming. Each lane carries its OWN PD(…) — the point of poly
  // being that one lane can push while another stays straight — so the scales
  // are cached per (lane, depth, seed, cycle) rather than globally.
  const laneCycles = useRef([]);
  const lanePhRef = useRef([]);
  const lanePdCache = useRef([]);
  function laneStepMsAt(lane, li, idx) {
    const base = laneStepMs(lane);
    const pd = lane.microtiming;
    if (!pd || !(pd.depth > 0) || !lane.steps || !lane.steps.length) return base;
    const cycle = laneCycles.current[li] || 0;
    const key = lane.steps.join('') + '|' + pd.depth + '|' + pd.seed + '|' + cycle;
    const slot = lanePdCache.current[li];
    if (!slot || slot.key !== key) {
      const sh = microtiming(lane.steps.map(Boolean), { depth: pd.depth, seed: pd.seed, pass: cycle });
      lanePdCache.current[li] = { key, scales: timingScales(sh) };
    }
    const sc = lanePdCache.current[li].scales;
    return base * (sc[idx % sc.length] ?? 1);
  }

  function polyHit(lane, laneIdx, accent) {
    const L = live.current;
    const ui = L.polyUi[lane.label] || {};
    if (ui.mute) return;
    const delay = Math.max(0, POLY_LAG_MS + laneOffsetMs(lane));
    setTimeout(() => {
      polyClick(laneIdx, accent);
      if (L.midiOutId) {
        const note = Math.max(0, Math.min(127, ui.note ?? laneNote(lane, laneIdx)));
        const chan = ui.chan ?? laneChan(lane, laneIdx);
        sendMidiNoteOn(note, accent ? L.accVel : L.unaccVel, chan);
        // Echo guard, same as mono's midiHit: register what we sent so an
        // IAC-style In==Out routing doesn't feed our own hits back as input
        // (which would swirl the pattern one rotation per hit).
        if (L.midiInId && L.midiInId === L.midiOutId) sentEcho.current.push({ n: note, c: chan, t: performance.now() });
        setTimeout(() => sendMidiNoteOff(note, chan), Math.max(30, laneStepMs(lane) * 0.9));
      }
    }, delay);
  }
  // Each lane ticks on its own clock; refs keep the closures fresh across
  // renders (the timer chain calls whatever the LATEST render defined).
  const laneTickRef = useRef(() => {});
  laneTickRef.current = (li) => {
    const L = live.current;
    if (!L.poly || !L.poly.lanes[li]) return;
    const lane = L.poly.lanes[li];
    // The phase advance is tracked in a REF, not read out of the state updater:
    // a functional setState may run after this function returns (and twice in
    // StrictMode), so anything the scheduler needs synchronously — like the
    // next step's microtiming — has to be computed here, not in there.
    const len = lane.steps.length || 1;
    const next = ((lanePhRef.current[li] ?? -1) + 1) % len;
    lanePhRef.current[li] = next;
    if (next === 0) {
      const seen = laneCycles.current[li] || 0;
      // seen === 0 is this lane's FIRST arrival at step 0, i.e. the start of
      // cycle 1, not a boundary — advancing there would skip the layer's first
      // entry. Only cycles actually completed count.
      const pat = lane.accentPattern;
      if (seen > 0 && pat && pat.length) {
        const k = lane.steps.reduce((a, st) => a + (st ? 1 : 0), 0);
        const off = ((laneAccOffRef.current[li] || 0) + k) % pat.length;
        laneAccOffRef.current[li] = off;
        setLaneAccOff(prev => { const cur = prev.slice(); cur[li] = off; return cur; });
      }
      laneCycles.current[li] = (seen + 1) % 1024;
    }
    if (lane.steps[next]) {
      // Precessed, not the frozen first-cycle projection.
      const pat = lane.accentPattern;
      const accented = pat && pat.length
        ? !!pat[(onsetIndexAt(lane.steps, next) + (laneAccOffRef.current[li] || 0)) % pat.length]
        : !!lane.accents[next];
      polyHit(lane, li, accented);
    }
    setLanePh(ph => { const cur = ph.slice(); cur[li] = next; return cur; });
    laneTimers.current[li] = setTimeout(() => laneTickRef.current(li), laneStepMsAt(lane, li, next));
  };
  function polyPlayStart() {
    // A fresh run starts every lane's accent layer at its first entry.
    laneAccOffRef.current = [];
    setLaneAccOff([]);
    laneTimers.current.forEach(clearTimeout);
    laneTimers.current = [];
    setLanePh(live.current.poly.lanes.map(() => -1));
    laneCycles.current = live.current.poly.lanes.map(() => 0);
    lanePhRef.current = live.current.poly.lanes.map(() => -1);
    lanePdCache.current = [];
    live.current.poly.lanes.forEach((_, li) => { laneTimers.current[li] = setTimeout(() => laneTickRef.current(li), 0); });
  }
  function polyStopTimers() {
    laneTimers.current.forEach(clearTimeout);
    laneTimers.current = [];
  }
  function tick() {
    setPlayhead(ph => {
      const L = live.current;
      const n = L.steps.length || 1;
      const next = (ph + 1) % n;
      if (next === 0) setPdCycle(c => (c + 1) % 1024);   // a new walk each cycle
      // at the cycle boundary, advance the accent phase by this cycle's onset
      // count so the displayed accents precess like the engine's onset counter
      if (next === 0 && L.accentPattern && L.accentPattern.length) {
        const k = L.steps.reduce((acc, s) => acc + (s ? 1 : 0), 0);
        setAccentOffset(o => (o + k) % L.accentPattern.length);
      }
      if (L.steps[next]) { const acc = !!L.accents[next]; click(acc); midiHit(acc, next); }
      timer.current = setTimeout(tick, stepDur(next));
      return next;
    });
  }
  function play() {
    if (cfg.host) {                       // plugin: drive the C++ internal sequencer
      const next = !playing; setPlaying(next); sendPlaying(next);
      return;
    }
    if (playing) { pause(); return; }     // webapp: Web Audio transport
    if (!audioCtx.current) { try { audioCtx.current = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    if (audioCtx.current && audioCtx.current.state === 'suspended') audioCtx.current.resume();
    setPlaying(true);
    if (live.current.poly) polyPlayStart();
    else timer.current = setTimeout(tick, stepDur(0));
  }
  function pause() {
    setPlaying(false); clearTimeout(timer.current); polyStopTimers();
    const L = live.current;
    if (L.midiOutId) {
      allMidiNotesOff(L.midiChan);
      // Poly lanes may route to their own channels — silence each one.
      if (L.poly) L.poly.lanes.forEach((lane, i) => allMidiNotesOff(laneChan(lane, i)));
    }
  }
  function stop() {
    if (cfg.host) { setPlaying(false); sendPlaying(false); return; }  // plugin
    pause(); setPlayhead(-1); setLanePh([]);
  }
  useEffect(() => () => { clearTimeout(timer.current); polyStopTimers(); }, []);

  // Live edits while playing: when the parsed poly changes (lanes added or
  // removed, offsets tweaked), restart the lane clocks against the new shape;
  // when the field goes back to mono mid-play, hand the transport to the mono
  // tick — and vice versa. Editing never silently stops the groove.
  useEffect(() => {
    if (!playing || cfg.host) return;
    clearTimeout(timer.current); polyStopTimers();
    if (poly) polyPlayStart();
    else timer.current = setTimeout(tick, stepDur(0));
    // eslint-disable-next-line
  }, [poly]);

  // ── JUCE bridge ──
  useEffect(() => {
    initJuceBridge(ev => {
      if (ev.type === 'stateSnapshot') {
        const s = ev.snap || {};
        if (s.runtime) setRuntime(s.runtime);
        if (s.bpm != null && s.bpm >= 20) setTempo(Math.round(s.bpm));  // never 0
        if (s.accentVelocity != null) setAccVel(Math.round(s.accentVelocity));
        if (s.unaccentedVelocity != null) setUnaccVel(Math.round(s.unaccentedVelocity));
        if (s.accentPitchOffset != null) setAccPitch(s.accentPitchOffset);
        if (s.midiNote != null) setMidiNote(s.midiNote);
        if (s.useHostTransport != null) setHostSync(!!s.useHostTransport);
        if (s.subdivision != null) setSubdiv(s.subdivision);
        if (s.patternLengthUnit != null) setLenUnit(s.patternLengthUnit);
        if (s.patternLengthValue != null) setLenVal(s.patternLengthValue);
        if (s.internalPlaying != null) setPlaying(!!s.internalPlaying);
        if (typeof s.upi === 'string' && s.upi) setUpiText(s.upi);
        // Poly lanes (SERPE_POLY §8 milestone 3): seed hostLaneParams from the
        // real APVTS values on load, so the panel shows automation-recalled
        // state rather than defaults for the first render.
        if (s.polyLagMs != null) setPolyLagMs(Math.round(s.polyLagMs));
        if (s.polyLock != null) setPolyLock(s.polyLock > 0.5 ? 'step' : 'cycle');
        setHostLaneParams(prev => {
          const next = prev.slice();
          for (let i = 0; i < 6; i++) {
            const note = s[`laneNote${i}`], chan = s[`laneChannel${i}`], mute = s[`laneMute${i}`];
            next[i] = {
              ...next[i],
              ...(note != null && { note }),
              ...(chan != null && { channel: chan }),
              ...(mute != null && { mute: !!mute }),
            };
          }
          return next;
        });
      } else if (ev.type === 'engineState') {
        // C++ reports the real pattern + per-step accents (== what plays).
        if (typeof ev.pattern === 'string' && ev.pattern.length) setSteps([...ev.pattern].map(Number));
        if (typeof ev.accents === 'string') setEngineAccents([...ev.accents].map(Number));
      } else if (ev.type === 'transport') {
        // In the plugin the C++ sequencer owns the playhead and effective tempo.
        setHostInfo({ bpm: ev.bpm, playing: ev.playing, hostSync: ev.hostSync });
        if (typeof ev.step === 'number') setPlayhead(ev.step);
        if (typeof ev.accentOffset === 'number') setAccentOffset(ev.accentOffset);
        if (ev.bpm >= 20) setTempo(ev.bpm);
        setHostSync(!!ev.hostSync);
        setPlaying(!!ev.playing);
      } else if (ev.type === 'polyState') {
        // Real per-lane playhead from the C++ engine (SERPE_POLY §8 milestone
        // 3) — the poly equivalent of 'transport's step, one per active lane.
        if (ev.active && Array.isArray(ev.steps)) setLanePh(ev.steps);
        else if (!ev.active) setLanePh([]);
        if (ev.active && Array.isArray(ev.patterns)) {
          setEngineLanes({ patterns: ev.patterns,
                           sceneIndices: ev.sceneIndices || [],
                           sceneCounts: ev.sceneCounts || [],
                           // Read from the engine, never recomputed here — a
                           // display that keeps its own tally drifts from the
                           // thing it describes (DESIGN_BRIEF §3.2).
                           triggers: ev.triggers || [] });
        } else if (!ev.active) setEngineLanes(null);
      } else if (ev.type === 'paramChange') {
        // Host automation of a lane param — keep the panel in sync live, not
        // just at load (unlike the older non-poly params, which don't have
        // this wired yet — a pre-existing gap this doesn't attempt to fix).
        const m = /^lane(Note|Channel|Mute)(\d)$/.exec(ev.id);
        if (m) {
          const i = +m[2];
          setHostLaneParams(prev => {
            const next = prev.slice();
            const field = m[1] === 'Note' ? 'note' : m[1] === 'Channel' ? 'channel' : 'mute';
            next[i] = { ...next[i], [field]: field === 'mute' ? ev.value > 0.5 : Math.round(ev.value) };
            return next;
          });
        } else if (ev.id === 'polyLagMs') {
          setPolyLagMs(Math.round(ev.value));
        } else if (ev.id === 'polyLock') {
          setPolyLock(ev.value > 0.5 ? 'step' : 'cycle');
        }
      }
    });
  }, []);

  // ── Web MIDI (standalone only): enable once, then keep the selected
  //    in/out in sync. The plugin runtime leaves this untouched (C++ MIDI). ──
  useEffect(() => {
    if (runtime !== 'webapp' || !midiSupported()) return undefined;
    let cancelled = false;
    startWebMidi({
      onDevices: p => { if (!cancelled) setMidiPorts(p); },
      onNoteIn: e => onMidiNoteRef.current(e),
    }).then(res => {
      if (cancelled) return;
      if (res.ok) { setMidiPorts(res.ports); setMidiErr(''); }
      else setMidiErr(res.error || 'MIDI unavailable');
    });
    return () => { cancelled = true; };
  }, [runtime]);
  // Apply the chosen ports (re-run when the device list changes so a remembered
  // device binds as soon as it appears).
  useEffect(() => { selectMidiInput(midiInId); }, [midiInId, midiPorts]);
  useEffect(() => { selectMidiOutput(midiOutId); }, [midiOutId, midiPorts]);

  // ── derived UI bits ──
  const weights = useMemo(() => indispensabilityWeights(steps.length || 1), [steps.length]);
  const intervalsStr = a.intervals.join(' ');

  const chips = [
    ['E(5,8)', 'cinquillo'], ['E(3,8)', 'tresillo'], ['E(7,16)', '16-step'],
    ['P(3,0)', 'triangle'], ['0x94', 'hex'], ['[0,3,6,9]:12', 'array'], ['{10010}E(5,8)', 'accented'],
  ];
  function applyChip(v) {
    resetProgressive();
    const m = v.match(/^\{([^}]*)\}(.*)$/);
    if (m) { setAccText(m[1]); setUpiText(m[2]); } else { setAccText(''); setUpiText(v); }
  }

  // ── pattern library: presets / saved / history ──
  const PRESETS = [
    ['E(3,8)', 'tresillo'], ['E(5,8)', 'cinquillo'], ['E(2,5)', 'khafif-e-ramal'],
    ['E(4,9)', 'aksak'], ['E(5,12)', 'venda'], ['E(7,12)', 'west-african'],
    ['E(7,16)', 'samba-ish'], ['E(5,16)', 'bossa-adjacent'], ['E(9,16)', 'central-african'],
    ['E(4,7)', 'bulgarian'], ['P(3,0)', 'triangle'], ['P(5,0)', 'pentagon'],
    ['{10010}E(5,8)', 'accented cinquillo'], ['0x94:8', 'tresillo (hex)'],
    ['[0,3,6,9]:12', 'even four'], ['E(2,3)', 'duple-against-triple'],
  ];
  const patInfo = (u) => { try { const p = parseUPI(u, { n: 16 }); if (!p.ok) return null; const a = analyse(p.steps); return `${a.k}/${a.n}`; } catch { return null; } };
  const loadPattern = (u) => { resetProgressive(); setAccText(''); setUpiText(u); };
  function saveToLibrary() {
    const u = upiText.trim(); if (!u || !patInfo(u)) return;
    setLib(prev => { const next = [{ upi: u }, ...prev.filter(x => x.upi !== u)].slice(0, 64); LS.set('library', JSON.stringify(next)); return next; });
  }
  /** Import a named-pattern block (docs/SERPE_RECOVERY.md) into the library.
   *  Each line becomes a saved entry carrying its NAME, so the browser lists
   *  "Bembé" rather than the raw hex. Returns the parse errors for display. */
  function importNamed(text) {
    const { patterns, errors } = parseNamedPatterns(text);
    if (patterns.length) {
      setLib(prev => {
        const next = prev.slice();
        for (const p of patterns) {
          const upi = p.steps.map(x => x ? '1' : '0').join('');
          const at = next.findIndex(x => x.name === p.name || x.upi === upi);
          const entry = { upi, name: p.name };
          if (at >= 0) next[at] = entry; else next.unshift(entry);
        }
        const capped = next.slice(0, 128);
        LS.set('library', JSON.stringify(capped));
        return capped;
      });
      toast({ text: `Imported ${patterns.length} pattern${patterns.length === 1 ? '' : 's'}` });
    }
    return errors;
  }

  const delFromLibrary = (u) => setLib(prev => { const next = prev.filter(x => x.upi !== u); LS.set('library', JSON.stringify(next)); return next; });
  /** Delete a saved pattern with the suite's undo-toast idiom (Q4). */
  function delSavedWithUndo(u) {
    const idx = lib.findIndex(x => x.upi === u);
    delFromLibrary(u);
    toast({ text: `Removed ${u}`, undo: () => setLib(prev => {
      if (prev.some(x => x.upi === u)) return prev;
      const next = prev.slice(); next.splice(Math.min(idx < 0 ? 0 : idx, next.length), 0, { upi: u });
      LS.set('library', JSON.stringify(next)); return next;
    }) });
  }
  // One merged stream for the LibraryBrowser: saved · presets · recents. The
  // UPI string is the name (what players read); label + k/n ride as tags.
  const libItems = useMemo(() => {
    const mk = (u, source, name, i) => {
      const info = patInfo(u);
      // What IS this rhythm? Recognition + durational reading ride as tags so
      // the browser can filter by them (the capability the original RPE's
      // database had via its own `euclidean` field). Cheap: only on re-memo.
      let reading = null, foot = null;
      try {
        const p = parseUPI(u, { n: 16 });
        if (p.ok) {
          const st = p.steps.map(Boolean);
          const id = identify(st);
          reading = id.best ? id.best.formula : null;
          const f = longShort(st).foot;
          foot = f && f !== 'none' && f !== 'mixed' && f !== 'complex' ? f : null;
        }
      } catch { /* unparseable entries still list, just without analysis */ }
      const tags = [name && name !== u ? name : null, info, reading, foot].filter(Boolean);
      return { id: source[0] + i, name: name || u, upi: u, source, family: upiFamily(u), tags };
    };
    return [
      ...lib.map((x, i) => mk(x.upi, x.name ? 'Named' : 'Saved', x.name || null, i)),
      ...PRESETS.map(([u, n], i) => mk(u, 'Preset', n, i)),
      ...hist.map((u, i) => mk(u, 'Recent', null, i)),
    ];
  }, [lib, hist]);

  const synced = cfg.host && hostSync;

  // Cluster slot 2 (MIDI) — webapp runtime only (a plugin host owns routing);
  // memoized so pattern-typing re-renders don't re-render the cluster.
  const clusterMidi = useMemo(() => {
    if (runtime !== 'webapp') return null;
    if (midiErr) return { unavailable: true };
    return {
      inputs: midiPorts.inputs, outputs: midiPorts.outputs,
      selectedInId: midiInId || null, selectedOutId: midiOutId || null,
      onSelectIn: (v) => { setMidiInId(v || ''); LS.set('midiIn', v || ''); },
      onSelectOut: (v) => { setMidiOutId(v || ''); LS.set('midiOut', v || ''); },
      badge: 'Standalone',
    };
  }, [runtime, midiErr, midiPorts, midiInId, midiOutId]);

  // ── render ──
  return h('div', { className: 'serpe', id: 'serpe' },
    // top bar
    h('div', { className: 'serpe-top' },
      h('div', { className: 'title' }, h('span', { className: 'title-mark', dangerouslySetInnerHTML: { __html: ICON_SVG } }), 'Serpe'),
      h('div', { className: 'transport' },
        h('button', { className: 'tbtn play' + (playing ? ' on' : ''), onClick: play, title: 'Play / pause', 'aria-label': 'Play' },
          playing
            ? h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, h('rect', { x: 6, y: 5, width: 4, height: 14 }), h('rect', { x: 14, y: 5, width: 4, height: 14 }))
            : h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, h('path', { d: 'M8 5v14l11-7z' }))),
        h('button', { className: 'tbtn', onClick: stop, title: 'Stop', 'aria-label': 'Stop' },
          h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, h('rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 })))),
      h('div', { className: 'tempo', style: { opacity: synced ? 0.45 : 1 } },
        h('input', { className: 'es-control', type: 'number', min: 40, max: 240, value: tempo, disabled: synced,
          onChange: e => { const t = Math.max(40, Math.min(240, +e.target.value || 120)); setTempo(t); LS.set('tempo', t); if (juceAvailable()) sendBPM(t); }, 'aria-label': 'Tempo' }),
        h('span', { className: 'unit' }, 'BPM')),
      cfg.host && h('div', { className: 'hostchip' + (synced ? ' synced' : '') },
        h('span', { className: 'led' }), h('span', null, synced ? `Host: ${hostInfo?.bpm ?? 124} BPM` : 'Host sync off')),
      h('div', { className: 'spacer' }),
      // The shared frame's global cluster — theme · MIDI · density, same
      // order and ids as every suite app. Replaces the bespoke Density/Theme
      // iconbtns. No Library slot: the rail's Patterns section (below) is
      // the LibraryBrowser, always visible — a cluster toggle would just
      // duplicate it (same call as MIDIcurator's sidebar).
      h(ClusterMount, { midi: clusterMidi })),

    // body
    h('div', { className: 'serpe-body' },
      // stage column
      h('div', { className: 'serpe-stage-col' },
        h('div', { className: 'upi' },
          h('div', { className: 'upi-row' },
            h('span', { className: 'prompt' }, '›'),
            h('input', { className: 'upi-field' + (parseErr ? ' bad' : ''), type: 'text', spellCheck: false, autoComplete: 'off',
              value: upiText, onChange: e => { resetProgressive(); setUpiText(e.target.value); },
              // Enter re-sends the same string. In the plugin that is the
              // engine's advance trigger (scenes / >N / %N step forward, same
              // path as Tick and MIDI-in); in the webapp it's a no-op re-parse.
              onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); parseField(); } },
              'aria-label': 'Universal Pattern Input' })),
          h('div', { className: 'upi-status' }, parseErr
            ? [h('span', { key: 'e', className: 'err' }, '✗ ' + parseErr), h('span', { key: 'd', className: 'dot' }), h('span', { key: 't' }, 'try E(5,8), 0x94, [0,3,6]:8, P(3,0), or kick=E(4,16) / snare=E(2,4)@+12ms')]
            : poly
            ? [h('span', { key: 'o', className: 'ok' }, '✓ poly'), h('span', { key: 'd1', className: 'dot' }),
               h('span', { key: 'k' }, `${poly.lanes.length} lanes · lcm ${poly.lcm}`), h('span', { key: 'd2', className: 'dot' }),
               h('span', { key: 'l', className: 'es-num' }, poly.lanes.map(l => l.label).join(' / '))]
            : [h('span', { key: 'o', className: 'ok' }, '✓ parsed'), h('span', { key: 'd1', className: 'dot' }),
               h('span', { key: 'k' }, `${a.k} onsets in ${a.n} steps`), h('span', { key: 'd2', className: 'dot' }),
               h('span', { key: 'b', className: 'es-num' }, a.binary), h('span', { key: 'd3', className: 'dot' }),
               h('span', { key: 'h', className: 'es-num' }, a.hex), ' · ', h('span', { key: 'dec', className: 'es-num' }, 'd' + a.decimal)]),
          h('div', { className: 'upi-chips' }, chips.map(([v, t]) =>
            h('button', { key: v, className: 'upi-chip', onClick: () => applyChip(v) }, h('b', null, v), ' ' + t)))),

        poly
        ? h(PolyLanesPanel, { poly: withPrecessedAccents(displayPoly || poly, laneAccOff), lanePh,
            polyLock, setPolyLock: v => {
              setPolyLock(v); LS.set('polyLock', v);
              if (cfg.host && juceAvailable()) sendParamActual('polyLock', v === 'step' ? 1 : 0);
            },
            polyView, setPolyView: v => { setPolyView(v); LS.set('polyView', v); },
            drumKit, setDrumKit: v => { setDrumKit(v); LS.set('drumKit', v); }, kitNames: Object.keys(KITS),
            laneNote, laneChan, laneMuted, setLaneUi,
            isHost: cfg.host, polyLagMs,
            setPolyLagMs: v => { setPolyLagMs(v); if (juceAvailable()) sendParamActual('polyLagMs', v); } })
        : h('div', { className: 'viz' + (view === 'circle' ? ' solo-circle' : '') },
          h('div', { className: 'viz-head' },
            h('span', { className: 'es-eyebrow' }, 'Pattern'),
            h('button', { className: 'iconbtn', title: 'Accent edit: tap onsets to toggle their accent',
              'aria-pressed': editAccent, onClick: () => setEditAccent(v => !v),
              style: { height: 30, fontSize: 12, ...(editAccent ? { borderColor: 'var(--es-dim-pressure)', color: 'var(--es-dim-pressure)', background: 'var(--es-dim-pressure-tint)' } : {}) } },
              h('span', { 'aria-hidden': true }, '✦'), h('span', null, ' accent')),
            h('label', { className: 'iconbtn', style: { height: 30, fontSize: 12, gap: 6 } },
              h('input', { type: 'checkbox', checked: showLabels, onChange: e => setShowLabels(e.target.checked) }), ' step numbers'),
            h('div', { className: 'seg', role: 'group', 'aria-label': 'View' },
              ['both', 'circle', 'step'].map(v =>
                h('button', { key: v, 'aria-pressed': view === v, onClick: () => setView(v) }, v[0].toUpperCase() + v.slice(1))))),
          h('div', { className: 'viz-body' },
            view !== 'step' && h('div', { className: 'viz-circle' },
              h(EngineView, { create: createCircleView, opts: { showCog: true, onToggle: toggleStepAt }, data: { steps, accents, playhead, showLabels } })),
            h('div', { className: 'viz-side' },
              view !== 'circle' && h(EngineView, { create: createStepView, opts: { group, onToggle: toggleStepAt }, data: { steps, accents, playhead, group } }),
              h('div', { className: 'readstrip' },
                h('span', null, h('span', { className: 'k' }, 'pattern '), h('b', { className: 'es-num' }, label || a.binary)),
                h('span', null, h('span', { className: 'k' }, 'onsets '), h('b', null, a.k), '/', h('b', null, a.n)),
                h('span', null, h('span', { className: 'k' }, 'intervals '), h('b', { className: 'es-num' }, intervalsStr || '—'))))))),

      // control rail — MIDI routing moved to the cluster's chip (slot 2)
      h('div', { className: 'serpe-rail' },
        // Generators
        h(Section, { title: 'Generators', open: true },
          h(Field, { label: 'Type' },
            h('select', { className: 'es-control', value: genType, onChange: e => setGenType(e.target.value) },
              [['E', 'Euclidean — E(k,n)'], ['P', 'Polygon — P(k,off)'], ['R', 'Random — R(k,n)'],
               ['B', 'Barlow — B(k,n)'], ['W', 'Wolrab — W(k,n)'], ['D', 'Dilcue — D(k,n)'],
               ['F', 'Funk — funky Euclidean']].map(([v, t]) =>
                h('option', { key: v, value: v }, t)))),
          h(Slider, { label: genType === 'F' ? 'Hits' : 'Onsets', value: genK, min: 1, max: 16, set: setGenK }),
          h(Slider, { label: 'Steps', value: genN, min: 2, max: 32, set: setGenN }),
          genType !== 'R' && h(Slider, { label: genType === 'P' ? 'Offset' : 'Rotation', value: genRot, min: 0, max: Math.max(1, genN - 1), set: setGenRot }),
          genType === 'F' && h(Slider, { label: 'Funkiness', value: funkiness, min: 0, max: 100, set: setFunkiness, fmt: v => v + '%' }),
          h('button', { className: 'es-btn es-primary', style: { width: '100%' }, onClick: generate }, 'Generate')),

        // Transform
        h(Section, { title: 'Transform', open: true },
          h(Field, { label: 'Dilute / concentrate mode' },
            h('select', { className: 'es-control', value: dilMode, onChange: e => setDilMode(e.target.value) },
              [['barlow', 'Barlow — metric indispensability'], ['wolrab', 'Wolrab — anti-Barlow'],
               ['euclid', 'Euclidean — even spacing'], ['dilcue', 'Dilcue — anti-Euclidean']].map(([v, t]) =>
                h('option', { key: v, value: v }, t)))),
          h('div', { className: 'btn-grid', style: { marginBottom: 6 } },
            h('button', { className: 'es-btn es-small', onClick: () => applyDilCon(-1) }, 'Dilute −'),
            h('button', { className: 'es-btn es-small', onClick: () => applyDilCon(1) }, 'Concentrate +'),
            h('button', { className: 'es-btn es-small', onClick: () => applyTransform(TX.rotl) }, 'Rotate ←'),
            h('button', { className: 'es-btn es-small', onClick: () => applyTransform(TX.rotr) }, 'Rotate →'),
            h('button', { className: 'es-btn es-small', onClick: () => applyTransform(TX.retro) }, 'Retrograde'),
            h('button', { className: 'es-btn es-small', onClick: () => applyTransform(TX.comp) }, 'Complement')),
          h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '2px 0 8px' } },
            'Dilute/concentrate adds or removes one onset by the selected weighting. Retrograde reverses the step order; Complement swaps onsets and rests.'),
          // Mutator — nudge each onset by a style + amount (keeps the onset count).
          h(Field, { label: 'Mutate style' },
            h('select', { className: 'es-control', value: mutStyle, onChange: e => setMutStyle(e.target.value) },
              [['balanced', 'Balanced — random nudge'], ['groove', 'Groove — toward groove grid'],
               ['syncopate', 'Syncopate — toward off-beats'], ['straighten', 'Straighten — toward strong beats'],
               ['swing', 'Swing'], ['shuffle', 'Shuffle']].map(([v, t]) => h('option', { key: v, value: v }, t)))),
          h(Slider, { label: 'Mutate amount', value: mutAmount, min: 0, max: 100, set: setMutAmount, fmt: v => v + '%' }),
          h('button', { className: 'es-btn es-small', style: { width: '100%' }, onClick: applyMutate }, 'Mutate')),

        // Progressive
        h(Section, { title: 'Progressive' },
          h(Slider, { label: progLeng ? 'Steps added / cycle' : 'Offset / cycle',
            value: progOff, min: progLeng ? 1 : -4, max: 4, set: setProgOff,
            fmt: v => progLeng ? '+' + Math.max(1, Math.abs(v)) : (v >= 0 ? '+' : '') + v }),
          h('label', { className: 'iconbtn', style: { height: 34, width: '100%', justifyContent: 'flex-start', marginBottom: 8 } },
            h('input', { type: 'checkbox', checked: progLeng, onChange: e => setProgLeng(e.target.checked) }), ' Progressive lengthening'),
          h('div', { className: 'field-row' },
            h('button', { className: 'es-btn es-small', style: { flex: 1 }, onClick: progAdvance }, 'Advance cycle'),
            h('button', { className: 'es-btn es-small', onClick: progReset }, 'Reset')),
          h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '8px 0 0' } },
            'Cycle ', h('b', { className: 'es-num' }, cycle), ' — ',
            progLeng ? 'each cycle appends random (bell-curve) steps; the base is kept.'
                     : 'rotate the base by the offset each cycle.')),

        // Accents
        h(Section, { title: 'Accents' },
          h(Field, { label: 'Accent pattern { }' },
            h('input', { className: 'es-control', type: 'text', spellCheck: false, placeholder: '10010', value: accText, onChange: e => setAccText(e.target.value) })),
          h(Slider, { label: 'Accent velocity', value: accVel, min: 1, max: 127, set: v => { setAccVel(v); if (juceAvailable()) sendParamActual('accentVel', v); } }),
          h(Slider, { label: 'Unaccented velocity', value: unaccVel, min: 1, max: 127, set: v => { setUnaccVel(v); if (juceAvailable()) sendParamActual('unaccentVel', v); } }),
          h(Slider, { label: 'Accent pitch offset', value: accPitch, min: -12, max: 12, set: v => { setAccPitch(v); if (juceAvailable()) sendParamActual('accentPitch', v); }, fmt: v => (v >= 0 ? '+' : '') + v })),

        // Analysis
        // Analysis describes the MONO pattern; in poly mode it would show a
        // stale pattern (and the indispensability bars overflow) — hide it
        // until per-lane analysis lands with the parity milestone.
        !poly && h(Section, { title: 'Analysis', open: true },
          h('div', { style: { marginBottom: 12 } },
            h('span', { className: 'balance-flag' + (a.balanced && a.k >= 2 ? ' yes' : '') },
              h('span', { className: 'led' }), h('span', null, a.k < 2 ? 'needs ≥2 onsets' : a.balanced ? 'Perfectly balanced' : 'Not balanced'))),
          h(Meter, { label: 'Evenness', frac: a.evenness, text: Math.round(a.evenness * 100) + '%' }),
          h(Meter, { label: 'Density', frac: a.density, text: Math.round(a.density * 100) + '%' }),
          h(Meter, { label: 'CoG radius', frac: a.cog.magnitude, text: a.cog.magnitude.toFixed(2) }),
          h(Meter, { label: 'Syncopation', frac: sync.overallSyncopation,
            text: Math.round(sync.overallSyncopation * 100) + '% · ' + sync.level }),
          h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '-4px 0 4px' },
            title: `note-to-beat ${Math.round(sync.weightedNoteToBeats*100)}% · off-beat ${Math.round(sync.offBeatRatio*100)}% · expectancy ${Math.round(sync.expectancyViolation*100)}% · displacement ${Math.round(sync.rhythmicDisplacement*100)}% · cross-rhythmic ${Math.round(sync.crossRhythmic*100)}% · Barlow ${Math.round(sync.barlowIndispensability*100)}%` },
            sync.description),
          h('p', { className: 'es-eyebrow', style: { margin: '14px 0 6px' } }, 'Barlow indispensability'),
          h('div', { className: 'indisp' }, steps.map((on, i) =>
            h('div', { key: i, className: 'b' + (on ? ' on' : ''), style: { height: (10 + weights[i] * 46) + 'px' }, title: `step ${i} · weight ${weights[i].toFixed(2)}` }))),
          steps.length <= 16 && h('div', { className: 'indisp-x' }, steps.map((_, i) => h('span', { key: i }, i)))),

        // Durations — makes the long/short reading playable (dynamicDurations).
        !poly && h(Section, { title: 'Feel (push/pull & durations)' },
          h(MicrotimingPanel, { steps, pdDepth, setPdDepth, pdSeed, tempo, group }),
          h('hr', { style: { border: 0, borderTop: '1px solid var(--es-border)', margin: '14px 0 12px' } }),
          h(DurationsPanel, { steps, lsMin, setLsMin, lsMax, setLsMax, lsDepth, setLsDepth,
                              lsPass: playing ? playhead : 0 })),

        // Scenes
        h(Section, { title: 'Scenes' },
          h('div', { className: 'scenes' }, scenes.map((sc, i) => {
            let timer;
            return h('button', { key: i, className: 'scene' + (sc ? ' filled' : '') + (i === activeScene ? ' active' : ''),
              onPointerDown: () => { timer = setTimeout(() => sceneClear(i), 600); },
              onPointerUp: () => clearTimeout(timer), onPointerLeave: () => clearTimeout(timer),
              onClick: () => sceneClick(i) }, i + 1);
          })),
          h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '9px 0 0' } },
            'Tap to recall · long-press a filled slot clears it. Step between scenes while playing.')),

        // Timing & output
        h(Section, { title: 'Timing & output' },
          h('label', { className: 'iconbtn', style: { height: 30, fontSize: 12, gap: 6, marginBottom: 8 },
            title: 'When on, an incoming MIDI note advances the pattern (next scene, else progressive) — the special-case behavior. Off by default so routed-back notes (IAC loops) never rotate the pattern.' },
            h('input', { type: 'checkbox', checked: midiAdvance,
              onChange: e => { setMidiAdvance(e.target.checked); LS.set('midiAdvance', e.target.checked); } }),
            ' advance on note-in'),
          h(Field, { label: 'Pattern length' },
            h('select', { className: 'es-control', value: lenUnit,
              onChange: e => { const u = +e.target.value; setLenUnit(u);
                if (juceAvailable()) sendParamActual('patternLengthUnit', u); } },
              PLEN_UNIT.map((t, i) => h('option', { key: i, value: i }, t)))),
          // Steps → each step is a fixed subdivision; Beats/Bars → whole pattern
          // spans N beats/bars; Auto → no extra control (fits the host bar).
          lenUnit === 0
            ? h(Field, { label: 'Step length' },
                h('select', { className: 'es-control', value: subdiv,
                  onChange: e => { setSubdiv(+e.target.value);
                    if (juceAvailable()) sendParamActual('subdivision', +e.target.value); } },
                  SUBDIV.map((t, i) => h('option', { key: i, value: i }, 'each step = ' + t))))
            : (lenUnit === 1 || lenUnit === 2)
              ? h(Field, { label: 'Length' },
                  h('select', { className: 'es-control', value: lenVal,
                    onChange: e => { setLenVal(+e.target.value);
                      if (juceAvailable()) sendParamActual('patternLengthValue', +e.target.value); } },
                    PLEN_VAL.map((t, i) => h('option', { key: i, value: i },
                      'pattern = ' + t + ' ' + (lenUnit === 2 ? 'bar' : 'beat') + (t === '1' ? '' : 's')))))
              : null,
          h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '-4px 0 10px' } },
            'Steps: each step is a fixed note value. Beats / Bars: the whole pattern spans that many beats or bars (Bars = 1 → one bar). Auto: the pattern fits the host’s bar.'),
          h(Field, { label: 'Beat grouping (visual)' },
            h('select', { className: 'es-control', value: group, onChange: e => setGroup(+e.target.value) },
              [['2', '2'], ['3', '3'], ['4', '4'], ['0', 'none']].map(([v, t]) => h('option', { key: v, value: +v }, t)))),
          h(Slider, { label: 'Swing', value: swing, min: 0, max: 60, set: setSwing, fmt: v => v + '%' }),
          h(Field, { label: 'MIDI note' },
            h('select', { className: 'es-control', value: midiNote, onChange: e => { setMidiNote(+e.target.value); if (juceAvailable()) sendParamActual('midiNote', +e.target.value); } },
              [[36, 'C1 — kick'], [38, 'D1 — snare'], [42, 'F♯1 — hat'], [60, 'C3']].map(([v, t]) => h('option', { key: v, value: v }, t)))),
          h(Field, { label: 'MIDI channel' },
            h('select', { className: 'es-control', value: midiChan, onChange: e => setMidiChan(+e.target.value) },
              [1, 2, 3, 10].map(v => h('option', { key: v, value: v }, v))))),

        // Patterns: presets / library / history — available everywhere (web,
        // plugin, standalone). Was mistakenly gated on cfg.web, which also
        // hides it in the JUCE Standalone build (same 'plugin' runtime as the
        // AU/VST3/CLAP formats, since all three host the same WebView bridge).
        // Pattern library — the shared LibraryBrowser (Q2), compact for the
        // rail; the old presets/saved/history tabs are now one Source facet.
        h(Section, { title: 'Patterns', badge: cfg.web ? 'web' : 'plugin' },
          h('button', { className: 'es-btn es-small', style: { width: '100%', marginBottom: 8 }, onClick: saveToLibrary }, '+ Save current'),
          h(NamedImport, { onImport: importNamed }),
          h(PatternLibrary, {
            items: libItems,
            onOpen: (it) => loadPattern(it.upi),
            onDelete: (it) => delSavedWithUndo(it.upi),
          })),

        // Web Audio (web)
        cfg.web && h(Section, { title: 'Web Audio', badge: 'web' },
          h('label', { className: 'iconbtn', style: { height: 34, width: '100%', justifyContent: 'flex-start', marginBottom: 9 } },
            h('input', { type: 'checkbox', checked: waOn, onChange: e => setWaOn(e.target.checked) }), ' Audible click'),
          h(Slider, { label: 'Volume', value: Math.round(waVol * 100), min: 0, max: 100, set: v => setWaVol(v / 100), fmt: v => v + '%' })),

        // Host & automation (plugin)
        cfg.host && h(Section, { title: 'Host & automation', badge: 'host' },
          h('label', { className: 'iconbtn', style: { height: 38, width: '100%', justifyContent: 'flex-start', marginBottom: 10 } },
            h('input', { type: 'checkbox', checked: hostSync, onChange: e => { setHostSync(e.target.checked); if (juceAvailable()) sendParamActual('hostTransport', e.target.checked ? 1 : 0); } }), ' Follow host transport'),
          h('p', { className: 'es-eyebrow', style: { margin: '4px 0 8px' } }, 'Automatable parameters'),
          h('div', null, [['Pattern length', a.n], ['Subdivision', group || '—'], ['Accent velocity', accVel],
            ['MIDI note', midiNote], ['BPM', tempo], ['Host transport', hostSync ? 'on' : 'off']].map(([k, v]) =>
            h('div', { key: k, className: 'meter-row', style: { gridTemplateColumns: '1fr auto' } },
              h('span', { className: 'lab' }, k), h('span', { className: 'val', style: { textAlign: 'right' } }, String(v)))))))));
}

// ── shared-frame mount (the framework-agnostic cluster as an island) ──
function ClusterMount({ midi }) {
  const host = useRef(null), cluster = useRef(null);
  useEffect(() => {
    cluster.current = createGlobalCluster(host.current, { midi, densityTarget: document.body });
    return () => cluster.current.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mounts once
  useEffect(() => { cluster.current?.update({ midi }); }, [midi]); // eslint-disable-line react-hooks/exhaustive-deps
  return h('div', { ref: host });
}

// ── small presentational helpers ──
const BADGE_LABEL = { web: 'web', host: 'plugin', standalone: 'standalone' };
/* ── Microtiming (push/pull) ───────────────────────────────────────────────
   Keil's participatory discrepancies: WHERE each attack lands relative to the
   beat. Unlike swing (fixed, every bar the same) this is a correlated walk
   that differs each cycle, pinned at the downbeat and loosest off the beat —
   and the cycle still lasts exactly as long, so nothing drifts out of time.
   This one IS wired to playback: the web-audio scheduler applies it. */
function MicrotimingPanel({ steps, pdDepth, setPdDepth, pdSeed, tempo, group }) {
  const stepMs = (60 / (tempo || 120)) / (group || 4) * 1000;
  const shift = microtiming(steps.map(Boolean), { depth: pdDepth, seed: pdSeed, pass: 0 });
  const onsets = steps.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const ms = onsets.map(i => shift[i] * stepMs);
  const peak = Math.max(1, ...ms.map(Math.abs));
  return h('div', null,
    h(Field, { label: 'Push / pull' },
      h('input', { className: 'es-range', type: 'range', min: 0, max: 100,
        value: Math.round(pdDepth * 100), 'aria-label': 'Microtiming push and pull depth',
        onChange: e => setPdDepth(+e.target.value / 100) }),
      h('span', { className: 'ls-depth-val' }, Math.round(pdDepth * 100) + '%')),
    h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '0 0 8px' } },
      pdDepth > 0
        ? `Attacks lean up to ${peak.toFixed(0)} ms early or late. The downbeat stays put and the cycle keeps its length — it leans, it doesn't drift.`
        : 'Dead straight. Raise it to let attacks sit ahead of or behind the beat.'),
    pdDepth > 0 && h('div', { className: 'pd-lane' }, onsets.map((i, k) =>
      h('div', { key: i, className: 'pd-mark' + (ms[k] < -0.5 ? ' early' : ms[k] > 0.5 ? ' late' : ''),
        title: `onset at step ${i}: ${ms[k] >= 0 ? '+' : ''}${ms[k].toFixed(1)} ms`,
        style: { left: (i / steps.length * 100) + '%',
                 transform: `translateX(${Math.max(-14, Math.min(14, ms[k] / peak * 14))}px)` } }))),
    pdDepth > 0 && h('code', { className: 'ls-durs' },
      onsets.map((i, k) => (ms[k] >= 0 ? '+' : '') + ms[k].toFixed(0)).join('  ') + ' ms'));
}

/* ── Durations (long/short) ────────────────────────────────────────────────
   The pattern says WHICH steps sound; this says HOW LONG each one lasts.
   `longShort` reads the inter-onset intervals into short/long (the reading the
   original Rhythm Pattern Explorer had — docs/SERPE_RECOVERY.md); the two
   controls below turn that reading into durations you can perform.

   Ratio is the long:short contrast. A RANGE (min < max) makes it breathe: the
   walk moves within the range and never outside it, correlated and anchored at
   strong positions — GloriArp's pocket model applied to duration rather than
   placement (Keil's participatory discrepancies). Depth 0 = perfectly static. */
function DurationsPanel({ steps, lsMin, setLsMin, lsMax, setLsMax, lsDepth, setLsDepth, lsPass }) {
  const ls = longShort(steps);
  if (!ls.intervals.length) {
    return h('p', { className: 'note', style: { fontSize: 12, color: 'var(--es-fg-muted)' } },
      ls.description + ' — durations need at least two onsets.');
  }
  const breathing = lsMax > lsMin && lsDepth > 0;
  const durs = breathing
    ? dynamicDurations(steps, { ratio: [lsMin, lsMax], depth: lsDepth, seed: 1, pass: lsPass })
    : durations(steps, { ratio: lsMin });
  const maxD = Math.max(...durs, 1);
  return h('div', null,
    h('div', { className: 'ls-read' },
      h('code', { className: 'ls-morse', title: 'short = dot, long = dash' }, ls.morse),
      h('span', { className: 'ls-foot' }, ls.pattern, ' · ', ls.foot)),
    h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '2px 0 10px' } },
      ls.isochronous
        ? `Even — ${ls.intervals.length} intervals of ${ls.short}. Nothing to contrast; the ratio has no effect.`
        : `Intervals [${ls.intervals.join(' ')}] — measured ${ls.ratio.toFixed(2)}:1`),
    h(Field, { label: breathing ? 'Ratio (range)' : 'Ratio' },
      h('input', { className: 'es-control', type: 'number', min: 1, max: 6, step: 0.05, value: lsMin,
        style: { width: 74 }, 'aria-label': 'Minimum long-to-short ratio',
        onChange: e => { const v = Math.max(1, +e.target.value || 1); setLsMin(v); if (lsMax < v) setLsMax(v); } }),
      h('span', { style: { color: 'var(--es-fg-muted)', fontSize: 12 } }, '–'),
      h('input', { className: 'es-control', type: 'number', min: 1, max: 6, step: 0.05, value: lsMax,
        style: { width: 74 }, 'aria-label': 'Maximum long-to-short ratio',
        onChange: e => { const v = Math.max(lsMin, +e.target.value || 1); setLsMax(v); } })),
    h(Field, { label: 'Push / pull' },
      h('input', { className: 'es-range', type: 'range', min: 0, max: 100, value: Math.round(lsDepth * 100),
        'aria-label': 'Push and pull depth',
        onChange: e => setLsDepth(+e.target.value / 100) }),
      h('span', { className: 'ls-depth-val' }, Math.round(lsDepth * 100) + '%')),
    h('p', { className: 'note', style: { fontSize: 11, color: 'var(--es-fg-muted)', margin: '0 0 10px' } },
      breathing
        ? `Breathing between ${lsMin.toFixed(2)} and ${lsMax.toFixed(2)} — the walk stays inside the range.`
        : lsMax > lsMin
          ? 'Raise push/pull above 0 to make the ratio breathe.'
          : 'Set the second ratio higher than the first to give the walk room.'),
    h('p', { className: 'es-eyebrow', style: { margin: '4px 0 6px' } }, 'Durations'),
    h('div', { className: 'ls-bars' }, durs.map((d, i) =>
      h('div', { key: i, className: 'ls-bar' + (ls.types[i] === 'long' ? ' long' : ''),
        style: { height: (10 + (d / maxD) * 42) + 'px' },
        title: `interval ${i + 1} · ${ls.types[i]} · ${d.toFixed(2)}` }))),
    h('code', { className: 'ls-durs' }, '[' + durs.map(d => d.toFixed(2)).join(' ') + ']'));
}

function Section({ title, badge, open, children }) {
  return h('details', { className: 'es-section', open: !!open },
    h('summary', null, title, badge && h('span', { className: 'feat-badge ' + badge }, BADGE_LABEL[badge] || badge)),
    h('div', { className: 'es-section-body' }, children));
}

// (The rail's DeviceSelect retired — the shared cluster's MIDI chip owns
// device routing now, DIN-5 icon included.)
// Label association (a11y): the label renders as a SIBLING row (the flex
// layout depends on it), so the control gets a generated id + htmlFor —
// wrapping would break `.field > label`'s row styling.
function Field({ label, children }) {
  const id = useRef(null);
  if (!id.current) id.current = 'fld-' + Math.random().toString(36).slice(2, 8);
  const kid = label && React.isValidElement(children) && !children.props.id
    ? React.cloneElement(children, { id: id.current }) : children;
  return h('div', { className: 'field' }, label && h('label', { htmlFor: id.current }, label), kid);
}
function Slider({ label, value, min, max, set, fmt }) {
  const shown = fmt ? fmt(value) : value;
  const id = useRef(null);
  if (!id.current) id.current = 'sld-' + Math.random().toString(36).slice(2, 8);
  return h('div', { className: 'field' },
    h('label', { htmlFor: id.current }, label, ' ', h('span', { className: 'v' }, shown)),
    h('input', { id: id.current, type: 'range', min, max, value, onChange: e => set(+e.target.value) }));
}
function Meter({ label, frac, text }) {
  return h('div', { className: 'meter-row' },
    h('span', { className: 'lab' }, label),
    h('div', { className: 'es-bar' }, h('div', { style: { width: Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' } })),
    h('span', { className: 'val' }, text));
}

ReactDOM.createRoot(document.getElementById('root')).render(h(SerpeApp));
