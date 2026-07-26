/**
 * Named patterns — importing a rhythm vocabulary by name.
 *
 * The original Rhythm Pattern Explorer never had a named catalogue (verified
 * across its whole history: `bembe`/`maqsum` appear nowhere — see
 * docs/SERPE_RECOVERY.md). Named rhythms lived in prose: "E(7,12) # West
 * African Gahu". This turns that into data you can actually load.
 *
 * One entry per line, `Name: spec`, where spec is anything UPI already
 * understands plus a bare onset list:
 *
 *   Fume-Fume: [0,2,4,7,9]/12     onset indices, /12 = step count
 *   Bembé: 0x5BA:12               hex — note UPI's nibble-reversed convention
 *   Tresillo: 10010010            binary
 *   Gahu: E(7,12)                 any UPI expression
 *   Son Clave: 1001001000101000   # comments and blank lines are ignored
 *
 * Deliberately NOT shipping a canned catalogue of "authentic" rhythms: which
 * timeline is "the" bembé depends on tradition, region and transcription, and
 * baking one spelling into the suite would launder an editorial choice into an
 * apparent fact. The importer is the feature; the vocabulary is the user's.
 */
import { parseUPI } from "./upi.js";
import { identify } from "./decompose.js";
import { longShort } from "./longshort.js";

/** Onset-list form: `[0,2,4,7,9]` with an optional `/12` or `:12` step count. */
const ONSET_LIST = /^\[\s*([\d\s,]*)\]\s*(?:[/:]\s*(\d+))?$/;

/**
 * Turn one `Name: spec` line into a pattern.
 *
 * @param {string} line
 * @param {{defaultSteps?:number}} [opts] step count for onset lists that don't
 *   state one. Default 16. (A bare list can't imply its own length: [0,2,4] is
 *   as plausibly 8 steps as 16, so guessing from the max onset would silently
 *   invent a different rhythm.)
 * @returns {{name:string, steps:boolean[], stepCount:number, source:string}}
 * @throws {Error} with a message naming the offending line
 */
export function parseNamedPattern(line, opts = {}) {
  const { defaultSteps = 16 } = opts;
  const text = String(line).replace(/#.*$/, "").trim();
  if (!text) throw new Error("empty line");

  // Which colon separates the NAME from the spec? Specs contain colons of
  // their own ("0x5BA:12"), so this can't just be the first one.
  //  1. a colon followed by whitespace is a separator — the way people write
  //     "Name: spec", and never how a step count is attached;
  //  2. failing that, a colon whose left side isn't itself a bare spec
  //     (hex/octal/binary/decimal literal), which catches "Tresillo:10010010".
  let name = null, spec = text;
  const looksLikeSpec = (t) => /^(0x[0-9a-f]+|0o[0-7]+|0b[01]+|[do]\d+|[01]+)$/i.test(t.trim());
  let cut = text.search(/:\s/);
  if (cut < 0) {
    for (let i = text.indexOf(":"); i > 0; i = text.indexOf(":", i + 1)) {
      if (!looksLikeSpec(text.slice(0, i))) { cut = i; break; }
    }
  }
  if (cut > 0) {
    name = text.slice(0, cut).trim();
    spec = text.slice(cut + 1).trim();
  }
  if (!name) throw new Error(`no name in "${line}" — expected "Name: spec"`);
  if (!spec) throw new Error(`no pattern for "${name}"`);

  // Quoted names ("Fume-Fume": …) — strip the quotes, and a trailing comma
  // from JSON-ish paste.
  name = name.replace(/^["'`]|["'`]$/g, "").trim();
  spec = spec.replace(/,$/, "").trim();

  let steps;
  const list = ONSET_LIST.exec(spec);
  if (list) {
    const stepCount = list[2] ? Number(list[2]) : defaultSteps;
    const onsets = list[1].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (onsets.some((n) => !Number.isInteger(n) || n < 0)) {
      throw new Error(`"${name}": onset list must be non-negative integers`);
    }
    const over = onsets.filter((n) => n >= stepCount);
    if (over.length) {
      throw new Error(`"${name}": onset(s) ${over.join(", ")} fall outside ${stepCount} steps`);
    }
    steps = new Array(stepCount).fill(false);
    for (const i of onsets) steps[i] = true;
  } else {
    const parsed = parseUPI(spec);
    if (!parsed || !parsed.steps || !parsed.steps.length) {
      throw new Error(`"${name}": could not parse "${spec}"`);
    }
    steps = parsed.steps.map(Boolean);
  }
  return { name, steps, stepCount: steps.length, source: spec };
}

/**
 * Parse a whole block — the "longer text input" case. Never throws: bad lines
 * are collected with their line numbers so one typo in a pasted list doesn't
 * discard the other forty.
 *
 * @returns {{patterns:Array<ReturnType<typeof parseNamedPattern>>, errors:Array<{line:number,text:string,error:string}>}}
 */
export function parseNamedPatterns(text, opts = {}) {
  const patterns = [];
  const errors = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const stripped = raw.replace(/#.*$/, "").trim();
    if (!stripped) return;
    // Tolerate JSON-object paste: skip the braces, keep the entries.
    if (/^[{}[\],]+$/.test(stripped)) return;
    try { patterns.push(parseNamedPattern(stripped, opts)); }
    catch (e) { errors.push({ line: i + 1, text: raw.trim(), error: e.message }); }
  });
  return { patterns, errors };
}

/**
 * Analyse a named pattern into the shape the library adapter stores: the
 * recognition and durational readings computed once, at import, so the
 * database can be searched by them later (`euclidean`, `foot`, …) exactly as
 * the original RPE's database searched its own `euclidean` field.
 */
export function describeNamedPattern(entry) {
  const id = identify(entry.steps);
  const ls = longShort(entry.steps);
  const binary = entry.steps.map((s) => (s ? "1" : "0")).join("");
  return {
    name: entry.name,
    binary,
    stepCount: entry.stepCount,
    onsets: id.onsets,
    onsetCount: id.onsets.length,
    source: entry.source,
    euclidean: id.euclidean ? id.euclidean.formula : null,
    barlow: id.barlow ? id.barlow.formula : null,
    /** Shortest exact generator reading, or null when the families can't express it. */
    reading: id.best ? id.best.formula : null,
    longShort: ls.pattern,
    foot: ls.foot,
    intervals: ls.intervals,
    ratio: ls.ratio,
  };
}
