import { useEffect, useRef, useState } from 'react';
import { allStyleNames, importStyleFromJson } from '../lib/gloriarp-clip';
import type { GrooveClipRequest } from '../lib/gloriarp-clip';
import { bridge, IN_PLUGIN, b64ToBytes } from '../lib/juce-bridge';

interface GrooveGeneratorProps {
  onGenerate: (req: GrooveClipRequest) => void;
  /** Leadsheet text of the currently selected clip, for one-tap reuse. */
  selectedLeadsheet?: string;
  /** Learn the selected clip as a style under the given name; returns the
   *  saved name on success, throws with a human-readable reason otherwise. */
  onLearnStyle?: (name: string) => string;
  /** Whether a clip is selected (enables the learn action). */
  hasSelectedClip?: boolean;
}

/**
 * The GloriArp panel: a prog goes in, an accompaniment comes out — as a
 * regular clip, so the plugin's host-synced playback (and the iPad share
 * sheet) apply to it like any other. Sits beside the progression generator.
 *
 * "Learn" (docs/GLORIARP_NEXT.md slice C): the selected clip becomes a
 * style — curated capture through extractPhrase, persisted locally, offered
 * in the same dropdown as the bundled styles.
 */
export function GrooveGenerator({ onGenerate, selectedLeadsheet, onLearnStyle, hasSelectedClip }: GrooveGeneratorProps) {
  const [expanded, setExpanded] = useState(false);
  const [progression, setProgression] = useState('Dm7 | G7 | Cmaj7 | A7');
  const [styleNames, setStyleNames] = useState<string[]>(() => allStyleNames());
  const [style, setStyle] = useState('walking-bass');
  const [rhythm, setRhythm] = useState('');
  const [seed, setSeed] = useState(42);
  const [bpm, setBpm] = useState(120);
  const [gate, setGate] = useState('');
  const [dynamics, setDynamics] = useState(0);
  const [rests, setRests] = useState(0);
  const [anticipation, setAnticipation] = useState(0);
  const [variety, setVariety] = useState(0);
  const [pocket, setPocket] = useState(0);
  const [inflect, setInflect] = useState(0);
  const [pass, setPass] = useState(0);
  const [learnName, setLearnName] = useState('');
  const [learnMsg, setLearnMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importJsonText = (text: string, filename: string) => {
    const name = filename.replace(/\.json$/i, '');
    try {
      const kind = importStyleFromJson(text, name);
      setStyleNames(allStyleNames());
      setStyle(name);
      setImportMsg(`⬆ imported "${name}" — a ${kind === 'model' ? 'style MODEL' : 'source phrase'}`);
    } catch (err) {
      setImportMsg(`✗ import "${filename}": ${err instanceof Error ? err.message : err}`);
    }
  };

  // Plugin: the native picker answers bridge.openFile('*.json') with a
  // fileOpened event ({ name, b64 }). Only .json is ours — .mid imports are
  // handled by MidiCurator's own fileOpened listener. Hooks must sit above
  // the collapsed-state early return (hooks order is per-render).
  const importJsonRef = useRef(importJsonText);
  importJsonRef.current = importJsonText;
  useEffect(() => {
    if (!IN_PLUGIN) return;
    return bridge.on('fileOpened', (data) => {
      const { name, b64 } = (data ?? {}) as { name?: string; b64?: string };
      if (!name || !b64 || !/\.json$/i.test(name)) return;
      importJsonRef.current(new TextDecoder().decode(b64ToBytes(b64)), name);
    });
  }, []);

  if (!expanded) {
    return (
      <button className="mc-btn--gen-toggle" onClick={() => setExpanded(true)}>
        + GloriArp groove
      </button>
    );
  }

  const feelNum = (label: string, value: number, set: (v: number) => void) => (
    <label className="mc-groove-gen__feel">
      {label}
      <input
        type="number" min={0} max={1} step={0.1} value={value}
        onChange={e => set(Math.min(1, Math.max(0, Number(e.target.value) || 0)))}
        className="mc-groove-gen__num"
      />
    </label>
  );

  const learn = () => {
    if (!onLearnStyle) return;
    const name = learnName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!name) { setLearnMsg('give the style a name first'); return; }
    try {
      const saved = onLearnStyle(name);
      setStyleNames(allStyleNames());
      setStyle(saved);
      setLearnName('');
      setLearnMsg(`☆ learned "${saved}" — it's in the style list now`);
    } catch (err) {
      setLearnMsg(err instanceof Error ? err.message : 'could not learn from this clip');
    }
  };

  /** Import a phrase.json or style-model.json (msuite style learn / accompany
   *  --phrase-out, a workspace export, another MIDIcurator's export…) — the
   *  same contracts every GloriArp surface reads and writes, so this closes
   *  the loop: capture here, learn on the CLI from a whole corpus, bring the
   *  model back, or vice versa. */
  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => importJsonText(String(reader.result), file.name);
    reader.readAsText(file);
  };

  return (
    <div className="mc-progression-gen mc-groove-gen">
      <div className="mc-progression-gen__row">
        <input
          type="text"
          value={progression}
          onChange={e => setProgression(e.target.value)}
          placeholder="Dm7 | G7 | Cmaj7 | A7"
          aria-label="Progression (bar notation)"
          className="mc-groove-gen__text"
        />
      </div>
      {selectedLeadsheet && selectedLeadsheet.trim() && selectedLeadsheet !== progression && (
        <div className="mc-progression-gen__row">
          <button
            className="mc-groove-gen__from-clip"
            onClick={() => setProgression(selectedLeadsheet)}
            title="Use the selected clip's leadsheet as the progression"
          >
            ⤷ from selected clip
          </button>
        </div>
      )}
      <div className="mc-progression-gen__row">
        <select
          value={style}
          onChange={e => setStyle(e.target.value)}
          aria-label="Style"
          className="mc-progression-gen__select"
        >
          {styleNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={gate}
          onChange={e => setGate(e.target.value)}
          aria-label="Gate"
          className="mc-progression-gen__select"
        >
          <option value="">gate: default</option>
          <option value="staccato">staccato</option>
          <option value="tenuto">tenuto</option>
          <option value="legato">legato</option>
          <option value="mixed">mixed</option>
        </select>
      </div>
      <div className="mc-progression-gen__row">
        <input
          type="text"
          value={rhythm}
          onChange={e => setRhythm(e.target.value)}
          placeholder="rhythm UPI, e.g. E(3,8) — optional"
          aria-label="Rhythm (UPI, optional)"
          className="mc-groove-gen__text"
        />
      </div>
      <div className="mc-progression-gen__row">
        <label className="mc-groove-gen__feel">
          seed
          <input
            type="number" min={0} step={1} value={seed}
            onChange={e => setSeed(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="mc-groove-gen__num"
          />
        </label>
        <label className="mc-groove-gen__feel">
          bpm
          <input
            type="number" min={20} max={300} step={1} value={bpm}
            onChange={e => setBpm(Math.min(300, Math.max(20, Math.round(Number(e.target.value) || 120))))}
            className="mc-groove-gen__num"
          />
        </label>
        <label className="mc-groove-gen__feel" title="Loop-pass to render (with variety/pocket, each pass is a take — the cheap variant axis)">
          take
          <input
            type="number" min={0} step={1} value={pass}
            onChange={e => setPass(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="mc-groove-gen__num"
          />
        </label>
      </div>
      <div className="mc-progression-gen__row">
        {feelNum('dyn', dynamics, setDynamics)}
        {feelNum('rests', rests, setRests)}
        {feelNum('push', anticipation, setAnticipation)}
      </div>
      <div className="mc-progression-gen__row">
        {feelNum('vary', variety, setVariety)}
        {feelNum('pocket', pocket, setPocket)}
        {feelNum('inflect', inflect, setInflect)}
      </div>
      <div className="mc-progression-gen__row mc-progression-gen__actions">
        <button
          className="mc-btn--generate"
          onClick={() => onGenerate({
            progression,
            style,
            seed,
            bpm,
            ...(rhythm.trim() ? { rhythm: rhythm.trim() } : {}),
            ...(gate ? { gate } : {}),
            ...(dynamics ? { dynamics } : {}),
            ...(rests ? { rests } : {}),
            ...(anticipation ? { anticipation } : {}),
            ...(variety ? { variety } : {}),
            ...(pocket ? { pocket } : {}),
            ...(inflect ? { inflect } : {}),
            // A nonzero take only differs when something re-rolls per pass.
            ...(pass ? { pass, morph: 1 } : {}),
          })}
        >
          Generate
        </button>
        <button className="mc-btn--gen-cancel" onClick={() => setExpanded(false)}>
          Cancel
        </button>
      </div>
      <div className="mc-progression-gen__row">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) importFile(file);
            e.target.value = ''; // allow re-importing the same filename later
          }}
        />
        <button
          className="mc-groove-gen__from-clip"
          title="Import a phrase.json or style-model.json (msuite style learn, a workspace export…)"
          onClick={() => {
            // WKWebView has no working <input type=file> — go through the
            // native document picker in the plugin (TESTING.md trap list).
            if (IN_PLUGIN) bridge.openFile('*.json');
            else fileInputRef.current?.click();
          }}
        >
          ⬆ import .json
        </button>
      </div>
      {importMsg && <div className="mc-progression-gen__row mc-groove-gen__msg">{importMsg}</div>}
      {onLearnStyle && (
        <div className="mc-progression-gen__row">
          <input
            type="text"
            value={learnName}
            onChange={e => setLearnName(e.target.value)}
            placeholder="new style name…"
            aria-label="New style name"
            className="mc-groove-gen__text"
          />
          <button
            className="mc-groove-gen__from-clip"
            disabled={!hasSelectedClip}
            title={hasSelectedClip
              ? 'Capture the selected clip as a GloriArp style (it needs a chord — leadsheet or detected)'
              : 'Select a clip first'}
            onClick={learn}
          >
            ☆ learn clip as style
          </button>
        </div>
      )}
      {learnMsg && <div className="mc-progression-gen__row mc-groove-gen__msg">{learnMsg}</div>}
    </div>
  );
}
