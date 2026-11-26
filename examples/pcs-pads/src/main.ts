/**
 * PCS Pads — an eight-pad prototype of pitch-class-set selection.
 *
 * It stands in for an Orba, a Lightpad or a Control Block: eight pads around
 * one centre button. Everything musical comes from @enkerli/theory's
 * pcsSelect.ts, the same functions (and vectors) a device port will use. This
 * file is only the interaction around them, so the question it answers is
 * "how does this feel on eight pads?", not "is the theory right?".
 *
 * Interaction model (as a device would have it):
 *   · Hold the centre → the pads show the six modes; tap one to switch.
 *   · Tap the centre  → the current mode's secondary action (flip page,
 *                       backspace, store, next neighbour…).
 *   · Every change is PROPOSED: applied now, or cued for the next beat /
 *     bar / loop (pcsSelect `cue` / `crossBoundary`). Proposals build on the
 *     cued set when there is one, so you can line up the next set silently
 *     while the current one keeps playing.
 *
 * Keyboard: 1–8 = pads (in Octal mode, 0–7 type the digits), C or Space =
 * centre (hold for modes), Esc = cancel cue, Enter = start/stop transport.
 */

import {
  cancelCue, crossBoundary, cue, cueState, distinctTranspositions, EMPTY_OCTAL_ENTRY,
  intervalEntryTap, maskCardinality, maskHas, maskToIntervals, maskToOctal, maskToPcs,
  modeBrightness, octalEntryBackspace, octalEntryTap, parallelModes, parallelModeStep,
  parsimoniousNeighbours, relativeMode, riemann, rotateMask, transposeState, transpositionPeriod,
  triadOf, twoPagePads, twoPagePc, twoPageToggle,
  type Boundary, type CueState, type IntervalEntry, type OctalEntry, type Page, type PcsState,
  type Quantum, type RiemannOp,
} from "../../../packages/theory/src/pcsSelect.ts";
import { encodeMessage, makeMessage } from "../../../packages/protocol/src/index.ts";

// ─── Names (context-free PCS display: chromatic, declared policy) ───────

const PC_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const pcName = (pc: number) => PC_NAMES[((pc % 12) + 12) % 12]!;

const m = (pcs: number[]) => pcs.reduce((a, pc) => a | (1 << pc), 0);

/** Interval masks rooted on 0, for naming. Order = preference when ambiguous. */
const NAMED: Array<[string, number]> = [
  ["Ionian", m([0, 2, 4, 5, 7, 9, 11])], ["Dorian", m([0, 2, 3, 5, 7, 9, 10])],
  ["Phrygian", m([0, 1, 3, 5, 7, 8, 10])], ["Lydian", m([0, 2, 4, 6, 7, 9, 11])],
  ["Mixolydian", m([0, 2, 4, 5, 7, 9, 10])], ["Aeolian", m([0, 2, 3, 5, 7, 8, 10])],
  ["Locrian", m([0, 1, 3, 5, 6, 8, 10])], ["harmonic minor", m([0, 2, 3, 5, 7, 8, 11])],
  ["melodic minor", m([0, 2, 3, 5, 7, 9, 11])], ["Lydian dominant", m([0, 2, 4, 6, 7, 9, 10])],
  ["altered", m([0, 1, 3, 4, 6, 8, 10])], ["Phrygian dominant", m([0, 1, 4, 5, 7, 8, 10])],
  ["major pentatonic", m([0, 2, 4, 7, 9])], ["minor pentatonic", m([0, 3, 5, 7, 10])],
  ["blues", m([0, 3, 5, 6, 7, 10])], ["whole tone", m([0, 2, 4, 6, 8, 10])],
  ["octatonic (half-whole)", m([0, 1, 3, 4, 6, 7, 9, 10])],
  ["octatonic (whole-half)", m([0, 2, 3, 5, 6, 8, 9, 11])],
  ["augmented scale", m([0, 3, 4, 7, 8, 11])], ["major triad", m([0, 4, 7])],
  ["minor triad", m([0, 3, 7])], ["diminished triad", m([0, 3, 6])],
  ["augmented triad", m([0, 4, 8])], ["diminished seventh", m([0, 3, 6, 9])],
  ["chromatic", 0xfff],
];

function nameOf(s: PcsState): string {
  if (s.mask === 0) return "empty set";
  const rel = rotateMask(s.mask, -s.root);
  const hit = NAMED.find(([, mask]) => mask === rel);
  if (hit && maskHas(s.mask, s.root)) return `${pcName(s.root)} ${hit[0]}`;
  for (const pc of maskToPcs(s.mask)) {
    const h = NAMED.find(([, mask]) => mask === rotateMask(s.mask, -pc));
    if (h) return `${pcName(pc)} ${h[0]}`;
  }
  return `${maskCardinality(s.mask)}-note set`;
}

// ─── State ──────────────────────────────────────────────────────────────

type Mode = "play" | "octal" | "pages" | "intervals" | "moves" | "favourites";
const MODES: Array<{ id: Mode; label: string }> = [
  { id: "play", label: "Play" }, { id: "octal", label: "Octal" }, { id: "pages", label: "Two-page" },
  { id: "intervals", label: "Intervals" }, { id: "moves", label: "Moves" }, { id: "favourites", label: "Favourites" },
];

const DEFAULT_FAVOURITES: PcsState[] = [
  { mask: m([0, 2, 4, 5, 7, 9, 11]), root: 0 },
  { mask: m([0, 2, 4, 5, 7, 9, 11]), root: 2 },
  { mask: m([0, 2, 4, 5, 7, 9, 11]), root: 9 },
  { mask: m([0, 2, 3, 5, 7, 8, 11]), root: 0 },
  { mask: m([0, 2, 3, 5, 7, 9, 11]), root: 0 },
  { mask: m([0, 2, 4, 7, 9]), root: 0 },
  { mask: m([0, 2, 4, 6, 8, 10]), root: 0 },
  { mask: m([0, 1, 3, 4, 6, 7, 9, 10]), root: 0 },
];

const store = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch { /* private mode */ } },
};

function loadFavourites(): PcsState[] {
  try {
    const raw = JSON.parse(store.get("pcs-pads.favourites") ?? "null");
    if (Array.isArray(raw) && raw.length === 8 && raw.every((s) => Number.isInteger(s?.mask) && Number.isInteger(s?.root))) return raw;
  } catch { /* fall through */ }
  return DEFAULT_FAVOURITES.map((s) => ({ ...s }));
}

const app = {
  cs: cueState({ mask: m([0, 2, 4, 5, 7, 9, 11]), root: 0 }) as CueState,
  quantum: "bar" as Quantum,
  mode: "octal" as Mode,
  page: 0 as Page,
  octal: EMPTY_OCTAL_ENTRY as OctalEntry,
  intervals: { root: 0, steps: [] } as IntervalEntry,
  favourites: loadFavourites(),
  storing: false,
  neighbourIndex: 0,
  holding: false,
  holdUsed: false,
  holdStart: 0,
  playing: false,
  bpm: 100,
  beat: -1, // beats since start; loop = 16 beats (4 bars of 4/4)
  message: "",
};

/** The set a new proposal builds on: the cued one if any, else the current. */
const draft = (): PcsState => app.cs.next ?? app.cs.current;

/** Keep the root when it survives a change; else the lowest member (or 0). */
function withRoot(mask: number, root: number): PcsState {
  if (mask === 0 || maskHas(mask, root)) return { mask, root };
  return { mask, root: maskToPcs(mask)[0]! };
}

function propose(next: PcsState, why: string) {
  const before = app.cs.current;
  app.cs = cue(app.cs, next, app.quantum);
  if (app.quantum === "now") {
    announce(`${why}: ${nameOf(next)}`);
    onApplied(before);
  } else {
    announce(`${why}: ${nameOf(next)} cued for the next ${app.quantum}`);
  }
  render();
}

function onApplied(before: PcsState) {
  const now = app.cs.current;
  if (now.mask !== before.mask || now.root !== before.root) {
    sendScale(now);
    if (ui.preview.checked) arpeggiate(now);
  }
}

// ─── Pads per mode ──────────────────────────────────────────────────────

interface PadView { label: string; sub?: string; lit?: boolean; hint?: boolean; disabled?: boolean }

const MOVES: Array<{ label: string; run: (s: PcsState) => PcsState | null }> = [
  { label: "Lighter", run: (s) => parallelModeStep(s, 1) },
  { label: "Darker", run: (s) => parallelModeStep(s, -1) },
  { label: "Relative", run: (s) => relativeMode(s, 1) },
  { label: "+5th", run: (s) => transposeState(s, 7) },
  { label: "−5th", run: (s) => transposeState(s, -7) },
  { label: "P", run: (s) => riemann(s.mask, "P") },
  { label: "L", run: (s) => riemann(s.mask, "L") },
  { label: "R", run: (s) => riemann(s.mask, "R") },
];

function degreeNote(s: PcsState, i: number): number | null {
  const steps = maskToIntervals(s.mask, s.root);
  if (!steps || steps.length === 0) return null;
  const rel = [0];
  for (const st of steps.slice(0, -1)) rel.push(rel[rel.length - 1]! + st);
  const octave = Math.floor(i / rel.length);
  return 60 + s.root + rel[i % rel.length]! + 12 * octave;
}

function padViews(): PadView[] {
  const d = draft();
  if (app.holding) return Array.from({ length: 8 }, (_, i) =>
    MODES[i] ? { label: MODES[i]!.label, lit: MODES[i]!.id === app.mode } : { label: "", disabled: true });
  switch (app.mode) {
    case "play": {
      const s = app.cs.current;
      return Array.from({ length: 8 }, (_, i) => {
        const n = degreeNote(s, i);
        return n === null ? { label: "—", disabled: true } : { label: pcName(n), sub: `${i + 1}` };
      });
    }
    case "octal": {
      const digitsOf = maskToOctal(d.mask);
      const next = app.octal.digits.length;
      return Array.from({ length: 8 }, (_, i) => ({
        label: String(i),
        sub: `${(i & 1) ? "●" : "○"}${(i & 2) ? "●" : "○"}${(i & 4) ? "●" : "○"}`,
        // Ghost hint: the digit that would keep the current set at this position.
        hint: Number(digitsOf[next]) === i,
      }));
    }
    case "pages":
      return twoPagePads(d.mask, app.page).map((lit, i) => {
        const pc = twoPagePc(app.page, i);
        return pc === null ? { label: "", disabled: true } : { label: pcName(pc), lit: !!lit };
      });
    case "intervals": {
      const used = app.intervals.steps.reduce((a, b) => a + b, 0);
      return Array.from({ length: 8 }, (_, i) => ({ label: `+${i + 1}`, disabled: used + i + 1 > 12 }));
    }
    case "moves": {
      const triad = triadOf(d.mask) !== null;
      return MOVES.map((mv, i) => {
        const out = mv.run(d);
        const same = !out || (out.mask === d.mask && out.root === d.root);
        return { label: mv.label, sub: out && !same ? nameOf(out) : (i >= 5 && !triad ? "triads only" : "—"), disabled: same };
      });
    }
    case "favourites":
      return app.favourites.map((f, i) => ({
        label: `${i + 1}`, sub: nameOf(f),
        lit: f.mask === app.cs.current.mask && f.root === app.cs.current.root,
      }));
  }
}

function tapPad(i: number) {
  if (app.holding) {
    const mode = MODES[i];
    if (mode) { app.mode = mode.id; app.holdUsed = true; resetEntries(); announce(`${mode.label} mode`); render(); }
    return;
  }
  const d = draft();
  switch (app.mode) {
    case "play": {
      const n = degreeNote(app.cs.current, i);
      if (n !== null) { note(n); flashPad(i); }
      return;
    }
    case "octal": {
      const r = octalEntryTap(app.octal, i);
      app.octal = r.entry;
      if (r.mask !== null) propose(withRoot(r.mask, d.root), `Octal ${maskToOctal(r.mask)}`);
      else render();
      return;
    }
    case "pages": {
      const mask = twoPageToggle(d.mask, app.page, i);
      if (mask !== d.mask) propose(withRoot(mask, d.root), `${maskHas(mask, twoPagePc(app.page, i)!) ? "Added" : "Removed"} ${pcName(twoPagePc(app.page, i)!)}`);
      return;
    }
    case "intervals": {
      if (app.intervals.steps.length === 0) app.intervals = { root: d.root, steps: [] };
      const r = intervalEntryTap(app.intervals, i);
      app.intervals = r.entry;
      if (r.refused) announce(`+${i + 1} would pass the octave`);
      if (r.mask !== null) propose({ mask: r.mask, root: r.entry.root }, "Intervals");
      else render();
      return;
    }
    case "moves": {
      const out = MOVES[i]!.run(d);
      if (out && (out.mask !== d.mask || out.root !== d.root)) propose(out, MOVES[i]!.label);
      return;
    }
    case "favourites": {
      if (app.storing) {
        app.favourites[i] = { ...app.cs.current };
        store.set("pcs-pads.favourites", JSON.stringify(app.favourites));
        app.storing = false;
        announce(`Stored ${nameOf(app.cs.current)} in slot ${i + 1}`);
        render();
      } else {
        propose({ ...app.favourites[i]! }, `Favourite ${i + 1}`);
      }
      return;
    }
  }
}

/** Short tap on the centre: the mode's secondary action. */
function centreTap() {
  switch (app.mode) {
    case "pages": app.page = app.page === 0 ? 1 : 0; announce(`Page ${app.page + 1}: ${app.page === 0 ? "C to G" : "A♭ to B"}`); break;
    case "octal": app.octal = octalEntryBackspace(app.octal); announce("Backspace"); break;
    case "intervals": app.intervals = { root: draft().root, steps: [] }; announce("Interval entry cleared"); break;
    case "favourites": app.storing = !app.storing; announce(app.storing ? "Tap a pad to store the current set" : "Store cancelled"); break;
    case "moves": {
      const ns = parsimoniousNeighbours(draft().mask);
      if (ns.length) {
        const n = ns[app.neighbourIndex++ % ns.length]!;
        propose(withRoot(n.mask, draft().root), `Neighbour ${pcName(n.from)}→${pcName(n.to)}`);
        return;
      }
      break;
    }
    case "play": arpeggiate(app.cs.current); break;
  }
  render();
}

const CENTRE_HINT: Record<Mode, string> = {
  play: "arpeggio", octal: "⌫", pages: "page", intervals: "clear", moves: "neighbour", favourites: "store",
};

function resetEntries() {
  app.octal = EMPTY_OCTAL_ENTRY;
  app.intervals = { root: draft().root, steps: [] };
  app.storing = false;
}

// ─── Transport ──────────────────────────────────────────────────────────

let timer: number | undefined;

function tick() {
  app.beat++;
  const b: Boundary = app.beat % 16 === 0 ? "loop" : app.beat % 4 === 0 ? "bar" : "beat";
  const before = app.cs.current;
  const r = crossBoundary(app.cs, b);
  app.cs = r.state;
  if (ui.click.checked) click(b !== "beat");
  if (r.changed) { announce(`Now: ${nameOf(app.cs.current)}`); onApplied(before); }
  render();
}

function setPlaying(on: boolean) {
  app.playing = on;
  clearInterval(timer);
  if (on) { app.beat = -1; tick(); timer = window.setInterval(tick, 60000 / app.bpm); }
  render();
}

// ─── Sound (Web Audio, lazily started on first gesture) ─────────────────

let ctx: AudioContext | null = null;
const audio = () => (ctx ??= new AudioContext());

function note(midi: number, when = 0, dur = 0.35) {
  sendNote(midi, dur);
  const a = audio();
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function arpeggiate(s: PcsState) {
  const n = maskCardinality(s.mask);
  for (let i = 0; i <= n; i++) {
    const midi = degreeNote(s, i);
    if (midi !== null) note(midi, i * 0.09, 0.25);
  }
}

function click(accent: boolean) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = accent ? 1760 : 1320;
  g.gain.setValueAtTime(0.08, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.04);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.05);
}

// ─── MIDI out (optional) ────────────────────────────────────────────────

let midiOut: MIDIOutput | null = null;
let midiAccess: MIDIAccess | null = null;

async function initMidi() {
  if (!("requestMIDIAccess" in navigator)) { ui.midiStatus.textContent = "Web MIDI not available in this browser."; return; }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: true });
  } catch {
    try { midiAccess = await navigator.requestMIDIAccess(); ui.midiStatus.textContent = "No SysEx permission: notes only."; }
    catch { ui.midiStatus.textContent = "MIDI access refused."; return; }
  }
  const fill = () => {
    const keep = ui.midiPort.value;
    ui.midiPort.replaceChildren(new Option("None", ""));
    for (const out of midiAccess!.outputs.values()) ui.midiPort.add(new Option(out.name ?? out.id, out.id));
    ui.midiPort.value = [...ui.midiPort.options].some((o) => o.value === keep) ? keep : "";
  };
  fill();
  midiAccess.onstatechange = fill;
  ui.midiPort.disabled = false;
}

function sendNote(midi: number, dur: number) {
  if (!midiOut || !ui.sendNotes.checked) return;
  midiOut.send([0x90, midi, 100]);
  midiOut.send([0x80, midi, 0], performance.now() + dur * 1000);
}

/** The suite's own `scale` message (@enkerli/protocol, SysEx 0x7D). */
function sendScale(s: PcsState) {
  if (!midiOut || !ui.sendScale.checked) return;
  try {
    const msg = makeMessage("external", "scale", { mask: s.mask, root: s.root, name: nameOf(s) });
    for (const frame of encodeMessage(msg)) midiOut.send(frame);
  } catch (e) {
    ui.midiStatus.textContent = `Could not send the scale: ${(e as Error).message}`;
  }
}

// ─── View ───────────────────────────────────────────────────────────────

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  ring: $("ring"), pads: $("pads"), centre: $<HTMLButtonElement>("centre"),
  modeChips: $("mode-chips"), name: $("name"), facts: $("facts"), next: $("next"),
  cancel: $<HTMLButtonElement>("cancel"), entry: $("entry"), live: $("live"),
  play: $<HTMLButtonElement>("play"), bpm: $<HTMLInputElement>("bpm"), beats: $("beats"),
  quantum: $("quantum"), ladder: $("ladder"), neighbours: $("neighbours"),
  preview: $<HTMLInputElement>("preview"), click: $<HTMLInputElement>("click"),
  midiPort: $<HTMLSelectElement>("midi-port"), midiStatus: $("midi-status"), midiEnable: $<HTMLButtonElement>("midi-enable"),
  sendNotes: $<HTMLInputElement>("send-notes"), sendScale: $<HTMLInputElement>("send-scale"),
};

function announce(text: string) { app.message = text; ui.live.textContent = text; }

const padButtons: HTMLButtonElement[] = [];

function buildPads() {
  for (let i = 0; i < 8; i++) {
    const b = document.createElement("button");
    b.className = "pad";
    b.type = "button";
    // Clockwise from the top, like a device with pads around a centre.
    const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
    b.style.setProperty("--x", `${50 + 38 * Math.cos(angle)}%`);
    b.style.setProperty("--y", `${50 + 38 * Math.sin(angle)}%`);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); tapPad(i); });
    b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); tapPad(i); } });
    padButtons.push(b);
    ui.pads.append(b);
  }
}

function flashPad(i: number) {
  const b = padButtons[i]!;
  b.classList.add("flash");
  setTimeout(() => b.classList.remove("flash"), 140);
}

function centreDown() {
  if (app.holding) return;
  app.holding = true; app.holdUsed = false; app.holdStart = performance.now();
  holdTimer = window.setTimeout(render, 250); // show modes once it is clearly a hold
}
let holdTimer: number | undefined;
function centreUp() {
  if (!app.holding) return;
  clearTimeout(holdTimer);
  const short = performance.now() - app.holdStart < 250;
  app.holding = false;
  if (short && !app.holdUsed) centreTap(); else render();
}

function ringSvg(): string {
  const cur = app.cs.current;
  const nxt = app.cs.next;
  const d = draft();
  const R = 42;
  let out = `<svg viewBox="0 0 100 100" role="img" aria-label="Pitch-class ring: ${maskToPcs(cur.mask).map(pcName).join(", ") || "empty"}">`;
  out += `<circle cx="50" cy="50" r="${R}" class="ring-track"/>`;
  // Polygon of the current set, for its shape.
  const pts = (mask: number) => maskToPcs(mask).map((pc) => {
    const a = (pc / 12) * 2 * Math.PI - Math.PI / 2;
    return `${50 + R * Math.cos(a)},${50 + R * Math.sin(a)}`;
  }).join(" ");
  if (maskCardinality(cur.mask) > 1) out += `<polygon points="${pts(cur.mask)}" class="ring-shape"/>`;
  if (nxt && maskCardinality(nxt.mask) > 1) out += `<polygon points="${pts(nxt.mask)}" class="ring-shape next"/>`;
  for (let pc = 0; pc < 12; pc++) {
    const a = (pc / 12) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + R * Math.cos(a), y = 50 + R * Math.sin(a);
    const inCur = maskHas(cur.mask, pc), inNext = nxt ? maskHas(nxt.mask, pc) : false;
    const cls = ["node", inCur ? "on" : "", inNext ? "cued" : "", pc === cur.root && inCur ? "root" : ""].join(" ");
    out += `<g class="${cls}" data-pc="${pc}" tabindex="0" role="button" aria-pressed="${maskHas(d.mask, pc)}" aria-label="${pcName(pc)}${inCur ? ", in set" : ""}${inNext ? ", in cued set" : ""}">` +
      `<circle cx="${x}" cy="${y}" r="5.6"/>` +
      `<text x="${x}" y="${y}" dy="0.35em">${pcName(pc)}</text></g>`;
  }
  return out + "</svg>";
}

function render() {
  const cur = app.cs.current;
  const nxt = app.cs.next;
  ui.ring.innerHTML = ringSvg();

  ui.name.textContent = nameOf(cur);
  const steps = maskToIntervals(cur.mask, cur.root);
  const facts: Array<[string, string]> = [
    ["Notes", maskToPcs(cur.mask).map(pcName).join(" ") || "—"],
    ["Mask", `${cur.mask}`],
    ["Octal taps", maskToOctal(cur.mask).split("").join(" ")],
    ["Steps", steps ? steps.join(" ") : "root not in set"],
    ["Cardinality", `${maskCardinality(cur.mask)}`],
    ["Transpositions", `${transpositionPeriod(cur.mask)}`],
    ["Brightness", maskHas(cur.mask, cur.root) ? `${modeBrightness(cur.mask, cur.root)}` : "—"],
  ];
  ui.facts.innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");

  ui.next.textContent = nxt ? `${nameOf(nxt)} · at the next ${app.cs.at}` : "nothing cued";
  ui.cancel.disabled = !nxt;

  // Entry progress line for the stateful modes.
  ui.entry.textContent =
    app.holding ? "Choose a mode" :
    app.mode === "octal" ? `Octal: ${[0, 1, 2, 3].map((k) => app.octal.digits[k] ?? "_").join(" ")}` :
    app.mode === "intervals" ? `Steps from ${pcName(app.intervals.steps.length ? app.intervals.root : draft().root)}: ${app.intervals.steps.join(" + ") || "…"} (${12 - app.intervals.steps.reduce((a, b) => a + b, 0)} left)` :
    app.mode === "pages" ? `Page ${app.page + 1} of 2 · ${app.page === 0 ? "C to G" : "A♭ to B"}` :
    app.mode === "favourites" ? (app.storing ? "Storing: tap a slot" : "Tap to recall") :
    app.mode === "moves" ? "Moves build on the cued set, if any" :
    "Pads play the current set's degrees";

  padViews().forEach((v, i) => {
    const b = padButtons[i]!;
    b.innerHTML = `<span class="pad-label">${v.label}</span>${v.sub ? `<span class="pad-sub">${v.sub}</span>` : ""}`;
    b.classList.toggle("lit", !!v.lit);
    b.classList.toggle("hint", !!v.hint);
    b.disabled = !!v.disabled && !app.holding;
    b.setAttribute("aria-label", `Pad ${i + 1}: ${v.label}${v.sub ? `, ${v.sub}` : ""}${v.lit ? ", lit" : ""}`);
  });
  ui.centre.classList.toggle("held", app.holding);
  ui.centre.innerHTML = `<span class="pad-label">${app.holding ? "modes" : MODES.find((x) => x.id === app.mode)!.label}</span><span class="pad-sub">tap: ${CENTRE_HINT[app.mode]} · hold: modes</span>`;

  ui.modeChips.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === app.mode)));
  ui.quantum.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.q === app.quantum)));

  ui.play.textContent = app.playing ? "Stop" : "Start";
  ui.play.setAttribute("aria-pressed", String(app.playing));
  const inLoop = app.beat < 0 ? -1 : app.beat % 16;
  ui.beats.innerHTML = Array.from({ length: 16 }, (_, k) =>
    `<span class="beat${k % 4 === 0 ? " downbeat" : ""}${k === inLoop ? " now" : ""}"></span>`).join("");

  // Light-to-dark ladder of the draft's parallel modes.
  const d = draft();
  const modes = parallelModes(d);
  ui.ladder.innerHTML = modes.length
    ? modes.map((mask) => {
        const s = { mask, root: d.root };
        return `<li><button type="button" data-mask="${mask}" aria-pressed="${mask === d.mask}">${nameOf(s)} <span class="muted">${modeBrightness(mask, d.root)}</span></button></li>`;
      }).join("")
    : `<li class="muted">The root is not in the set.</li>`;

  const ns = parsimoniousNeighbours(d.mask);
  ui.neighbours.innerHTML = ns.map((n) =>
    `<li><button type="button" data-mask="${n.mask}">${pcName(n.from)}→${pcName(n.to)} <span class="muted">${nameOf(withRoot(n.mask, d.root))}</span></button></li>`).join("");

  const period = transpositionPeriod(d.mask);
  if (period < 12 && period > 1) {
    ui.neighbours.insertAdjacentHTML("afterbegin",
      `<li class="muted">Limited transposition: ${period} distinct (${distinctTranspositions(d.mask).length} masks)</li>`);
  }
}

// ─── Wiring ─────────────────────────────────────────────────────────────

function wire() {
  buildPads();
  ui.centre.addEventListener("pointerdown", (e) => { e.preventDefault(); centreDown(); });
  ui.centre.addEventListener("pointerup", centreUp);
  ui.centre.addEventListener("pointerleave", () => { if (app.holding) centreUp(); });
  ui.centre.addEventListener("click", (e) => { if (e.detail === 0) centreTap(); }); // keyboard activation

  for (const mo of MODES) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.mode = mo.id; b.textContent = mo.label;
    b.addEventListener("click", () => { app.mode = mo.id; resetEntries(); announce(`${mo.label} mode`); render(); });
    ui.modeChips.append(b);
  }
  for (const q of ["now", "beat", "bar", "loop"] as Quantum[]) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.q = q; b.textContent = q === "now" ? "Now" : `Next ${q}`;
    b.addEventListener("click", () => { app.quantum = q; render(); });
    ui.quantum.append(b);
  }

  ui.ring.addEventListener("click", (e) => {
    const g = (e.target as Element).closest("[data-pc]");
    if (!g) return;
    const pc = Number(g.getAttribute("data-pc"));
    const d = draft();
    if (e.altKey || e.shiftKey) { if (maskHas(d.mask, pc)) propose({ mask: d.mask, root: pc }, `Root ${pcName(pc)}`); return; }
    const mask = d.mask ^ (1 << pc);
    propose(withRoot(mask, d.root), `${maskHas(mask, pc) ? "Added" : "Removed"} ${pcName(pc)}`);
  });
  ui.ring.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); e.stopPropagation();
    (e.target as Element).dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: e.shiftKey, altKey: e.altKey }));
  });
  ui.ladder.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-mask]");
    if (b) propose({ mask: Number(b.dataset.mask), root: draft().root }, "Mode");
  });
  ui.neighbours.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-mask]");
    if (b) propose(withRoot(Number(b.dataset.mask), draft().root), "Neighbour");
  });
  ui.cancel.addEventListener("click", () => { app.cs = cancelCue(app.cs); announce("Cue cancelled"); render(); });
  ui.play.addEventListener("click", () => setPlaying(!app.playing));
  ui.bpm.addEventListener("change", () => {
    app.bpm = Math.min(240, Math.max(40, Number(ui.bpm.value) || 100));
    ui.bpm.value = String(app.bpm);
    if (app.playing) { clearInterval(timer); timer = window.setInterval(tick, 60000 / app.bpm); }
  });
  ui.midiEnable.addEventListener("click", () => { ui.midiEnable.disabled = true; void initMidi(); });
  ui.midiPort.addEventListener("change", () => {
    midiOut = midiAccess?.outputs.get(ui.midiPort.value) ?? null;
    ui.midiStatus.textContent = midiOut ? `Sending to ${midiOut.name}.` : "";
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("input, select, textarea")) return;
    // In Octal mode the digit keys ARE the digits (type "5625" for C Ionian);
    // elsewhere 1–8 are the pads, numbered as printed on a device.
    const octalKeys = app.mode === "octal" && !app.holding;
    if (octalKeys && e.key >= "0" && e.key <= "7" && !e.repeat) { tapPad(Number(e.key)); flashPad(Number(e.key)); }
    else if (!octalKeys && e.key >= "1" && e.key <= "8" && !e.repeat) { tapPad(Number(e.key) - 1); flashPad(Number(e.key) - 1); }
    else if ((e.key === "c" || e.key === "C") && !e.repeat) { centreDown(); }
    else if (e.key === " " && !e.repeat && !t.closest("button, [role=button]")) { e.preventDefault(); centreDown(); }
    else if (e.key === "Escape") { app.cs = cancelCue(app.cs); app.storing = false; announce("Cue cancelled"); render(); }
    else if (e.key === "Enter" && t === document.body) setPlaying(!app.playing);
  });
  document.addEventListener("keyup", (e) => {
    if ((e.key === " " || e.key === "c" || e.key === "C") && app.holding) { e.preventDefault(); centreUp(); }
  });

  render();
}

wire();

// Exposed for the smoke test and for poking at in the console.
(window as unknown as { pcsPads: unknown }).pcsPads = { app, tapPad, centreTap, propose, tick, nameOf };
export type { RiemannOp };
