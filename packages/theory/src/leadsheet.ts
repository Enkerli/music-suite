/**
 * Leadsheet / Progression — the suite's shared progression type
 * (SUITE_AUDIT_AND_PLAN §7). A key-anchored progression that ProgGenie
 * generates, MIDIcurator annotates, bar notation expresses as text, and
 * (in @enkerli/midi) SMF carries between them.
 *
 * Every chord holds a degree (key-relative Roman) and/or an absolute
 * spelled symbol, with `source` saying which is authoritative; the views
 * convert through a KeyContext via the already-shipped degree machinery
 * (resolveDegree / assertDegree / qualityKeyForSuffix / displaySuffix).
 *
 * This module is zero-dep (theory's invariant). The SMF round-trip
 * (toSMF/fromSMF) lives in @enkerli/midi, which owns the SMF codec.
 */

import { findQualityByKey } from "./chords.js";
import { parseChordSymbol, qualityKeyForSuffix } from "./chordSymbol.js";
import type { KeyContext } from "./analysis.js";
import { resolveDegree } from "./analysis.js";
import { mod12 } from "./pitch.js";
import { parseSpelled, spelledToPc } from "./spelling.js";

// ── Data model ──────────────────────────────────────────────────────────

/** A chord as authored — key-relative degree, absolute symbol, or both. */
export interface ProgChord {
  /** Key-relative view: numeral + display suffix ("II" + "m7", "♭II" + "7"). */
  degree?: { numeral: string; suffix: string };
  /** Absolute view: spelled root + suffix, optional slash bass. */
  symbol?: { root: string; suffix: string; bass?: string };
  /** Which view is authoritative; realize() fills the other from the key. */
  source: "degree" | "absolute";
  /** Beats from bar start (default: equal division of the bar). */
  beat?: number;
  /** Duration in beats (default: bar length / chords-in-bar). */
  dur?: number;
  /** Verbatim token, for loss-free round-trip of unrecognized qualities. */
  inputText?: string;
}

/** One bar: 1..n chords, or a repeat of the previous bar. */
export interface Bar {
  chords: ProgChord[];
  /** From '%' / '-' — repeat the previous bar; chords is then empty. */
  repeat?: boolean;
}

/** A named span of bars ("A", "intro", …); MVP parse yields one unnamed. */
export interface Section {
  label?: string;
  bars: Bar[];
}

export interface Progression {
  key: KeyContext;
  meta?: { title?: string; composer?: string; timeSig?: [number, number]; bpm?: number };
  sections: Section[];
}

/** A realized chord — derived, not stored (the shape ProgGenie produces). */
export interface RealizedChord {
  /** Properly spelled chord symbol, e.g. "D♭7", "Dm7". */
  symbol: string;
  rootName: string;
  rootPc: number;
  suffix: string;
  qualityKey: string | null;
  /** Pitch classes (0–11), or [root] when the quality is unrecognized. */
  pcs: number[];
  bass?: string;
}

// ── Text interchange (bar notation) ─────────────────────────────────────

/** Roman-numeral token: optional accidentals + a numeral (degree chord). */
// Roman-numeral token: optional accidentals + numeral (either case) + the
// rest as suffix. Lowercase numerals are the jazz minor convention (iii =
// iii minor), so we capture case to apply a minor quality.
const NUMERAL_RE = /^([♭♯b#𝄪𝄫]*)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;

/** Quality markers a suffix may already start with (then lowercase adds nothing). */
const QUALITY_PREFIX_RE = /^(m(?!aj)|min|maj|Maj|M|dim|°|aug|\+|sus|ø|h)/;

/** Lowercase numeral = minor: fold a minor quality into the suffix. */
function applyMinor(suffix: string): string {
  if (suffix === "") return "m";
  if (QUALITY_PREFIX_RE.test(suffix)) return suffix; // explicit quality wins
  return "m" + suffix; // "7" → "m7", "9" → "m9", …
}
const REPEAT_TOKENS = new Set(["%", "-"]);

/** Normalize ASCII accidentals to the suite's Unicode display forms. */
function normalizeAccidentals(s: string): string {
  return s.replace(/##/g, "𝄪").replace(/bb/g, "𝄫").replace(/#/g, "♯").replace(/b/g, "♭");
}

/** Strip parenthesized extension groups: "7(∆7,9)" → "7". */
function stripParens(suffix: string): string {
  return suffix.replace(/\([^)]*\)/g, "");
}

/**
 * Parse bar notation into a Progression. `|` separates bars, whitespace
 * separates chords within a bar, `%`/`-` repeats the previous bar.
 * Roman-numeral tokens become degree chords; everything else is parsed as
 * an absolute spelled symbol. The token is preserved verbatim in inputText
 * so even unrecognized qualities round-trip.
 *
 *   parseLeadsheet("C7(∆7,9) A13#9/D | F6(♯9)/D C∆13sus4/D", key)
 */
export function parseLeadsheet(
  text: string,
  key: KeyContext = { tonic: "C", mode: "major" },
): Progression {
  const bars: Bar[] = [];
  for (const barText of text.split("|")) {
    const tokens = barText.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    if (tokens.length === 1 && REPEAT_TOKENS.has(tokens[0]!)) {
      bars.push({ chords: [], repeat: true });
      continue;
    }
    const chords = tokens.map(parseToken).filter((c): c is ProgChord => c !== null);
    if (chords.length > 0) bars.push({ chords });
  }
  return { key, sections: [{ bars }] };
}

/** Parse one chord token (degree or absolute). */
function parseToken(token: string): ProgChord | null {
  const inputText = token;
  // Split a trailing slash bass off first (works for both views).
  const slash = token.lastIndexOf("/");
  const head = slash > 0 ? token.slice(0, slash) : token;
  const bass = slash > 0 ? normalizeAccidentals(token.slice(slash + 1)) : undefined;

  const num = NUMERAL_RE.exec(head);
  if (num) {
    const accidentals = num[1] ?? "";
    const roman = num[2]!;
    const isLower = roman === roman.toLowerCase();
    const numeral = accidentals + roman.toUpperCase();
    let suffix = normalizeAccidentals(num[3] ?? "");
    if (isLower) suffix = applyMinor(suffix);
    return {
      source: "degree",
      degree: { numeral, suffix },
      ...(bass ? { symbol: { root: "", suffix: "", bass } } : {}),
      inputText,
    };
  }

  const parsed = parseChordSymbol(token);
  if (!parsed) return null;
  return {
    source: "absolute",
    symbol: {
      root: parsed.rootName,
      suffix: normalizeAccidentals(parsed.suffix),
      ...(parsed.bassName ? { bass: parsed.bassName } : {}),
    },
    inputText,
  };
}

/** Format one chord back to a token (normalized Unicode accidentals). */
function formatChord(c: ProgChord): string {
  if (c.source === "degree" && c.degree) {
    const base = c.degree.numeral + c.degree.suffix;
    const bass = c.symbol?.bass ? "/" + c.symbol.bass : "";
    return base + bass;
  }
  const s = c.symbol!;
  return normalizeAccidentals(s.root) + s.suffix + (s.bass ? "/" + normalizeAccidentals(s.bass) : "");
}

/**
 * Format a Progression back to bar notation. Round-trip contract:
 * formatLeadsheet(parseLeadsheet(t)) === t for normalized input (Unicode
 * accidentals, single spaces, " | " bar separators).
 */
export function formatLeadsheet(prog: Progression): string {
  const bars = prog.sections.flatMap((s) => s.bars);
  return bars
    .map((bar) => (bar.repeat ? "%" : bar.chords.map(formatChord).join(" ")))
    .join(" | ");
}

// ── Realization ─────────────────────────────────────────────────────────

/** qualityKey for a suffix, falling back to the paren-stripped base. */
function resolveQuality(suffix: string): string | undefined {
  return qualityKeyForSuffix(suffix) ?? qualityKeyForSuffix(stripParens(suffix));
}

/**
 * Realize one chord in a key: properly spelled symbol + pitch classes.
 * Degree chords resolve their root via resolveDegree; absolute chords use
 * their spelled root directly. Unrecognized qualities realize as the bare
 * root (audible, visible, never dropped) — matching ProgGenie's policy.
 */
export function realizeChord(chord: ProgChord, key: KeyContext): RealizedChord {
  let rootName: string;
  let suffix: string;
  if (chord.source === "degree" && chord.degree) {
    rootName = resolveDegree(chord.degree.numeral, key);
    suffix = chord.degree.suffix;
  } else {
    rootName = chord.symbol!.root;
    suffix = chord.symbol!.suffix;
  }
  const spelled = parseSpelled(rootName);
  const rootPc = spelled ? spelledToPc(spelled) : 0;
  const qualityKey = resolveQuality(suffix) ?? null;
  const quality = qualityKey ? findQualityByKey(qualityKey) : undefined;
  const pcs = (quality ? quality.pcs : [0]).map((pc) => mod12(rootPc + pc));
  const bass = chord.symbol?.bass;
  return {
    symbol: rootName + suffix + (bass ? "/" + bass : ""),
    rootName,
    rootPc,
    suffix,
    qualityKey,
    pcs,
    ...(bass ? { bass } : {}),
  };
}

/** Realize every chord in a progression (repeats expanded from prior bar). */
export function realizeLeadsheet(prog: Progression, key = prog.key): RealizedChord[][] {
  const out: RealizedChord[][] = [];
  const bars = prog.sections.flatMap((s) => s.bars);
  let prev: RealizedChord[] = [];
  for (const bar of bars) {
    if (bar.repeat) {
      out.push(prev);
      continue;
    }
    prev = bar.chords.map((c) => realizeChord(c, key));
    out.push(prev);
  }
  return out;
}
