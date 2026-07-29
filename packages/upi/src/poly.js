/**
 * Poly UPI — parallel lanes (docs/SERPE_POLY.md, notation DECIDED
 * 2026-07-18): `/` separates lanes, `name=` labels one, `@` carries the
 * per-lane micro-timing offset — the Keil number, participatory
 * discrepancies in the saved text:
 *
 *   kick=E(4,16) / snare=E(2,4)@+12ms / hat={10}E(8,16)@-1/64
 *
 * Two offset units: `@±N[ms]` = absolute milliseconds (clamped ±50 — how
 * discrepancies are measured); `@±num/den` = a note-value fraction of a
 * whole note, tempo-synced (clamped ±1/8). The splitter consumes each `@`
 * token ATOMICALLY, so a fraction's slash never reads as a lane break.
 *
 * Each lane is a complete UPI expression (accents, quantization, `+`/`-`
 * combination all legal per lane). A single lane with no `/` parses exactly
 * as parseUPI does — zero breaking change; this module sits BESIDE the
 * mono grammar, not inside it. Sound routing (note/channel/mute) stays out
 * of the notation on principle: the notation says WHEN, the instrument rack
 * says WHAT.
 */
import { parseUPI, rotate } from "./upi.js";
import { bellCurveRandomSteps } from "./rhythm.js";

const MAX_MS = 50;
const MAX_FRAC = 1 / 8;

/** An `@` offset token: `@+12ms`, `@-6`, `@+1/32`. */
const OFFSET_RE = /^@([+-]?)(\d+)(?:(ms)|\/(\d+))?$/;

/**
 * Split poly notation into lane strings on TOP-LEVEL `/`, respecting
 * paren/bracket/brace depth and consuming `@…` offset tokens atomically
 * (so `@+1/32` never splits). Exported for tests.
 */
export function splitLanes(src) {
  const lanes = [];
  let cur = "", depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "@" && depth === 0) {
      // Consume the whole offset token: sign, digits, then `ms` or `/den`.
      let j = i + 1;
      if (src[j] === "+" || src[j] === "-") j++;
      while (j < src.length && /\d/.test(src[j])) j++;
      if (src.slice(j, j + 2) === "ms") j += 2;
      else if (src[j] === "/" && /\d/.test(src[j + 1] ?? "")) {
        j++;
        while (j < src.length && /\d/.test(src[j])) j++;
      }
      cur += src.slice(i, j);
      i = j - 1;
      continue;
    }
    if (c === "/" && depth === 0) { lanes.push(cur); cur = ""; continue; }
    cur += c;
  }
  lanes.push(cur);
  return lanes.map((s) => s.trim()).filter((s) => s !== "");
}

/** Parse one lane's `@` suffix. Returns { rest, offset, error? }. */
function parseOffset(laneSrc) {
  const at = laneSrc.lastIndexOf("@");
  if (at === -1) return { rest: laneSrc, offset: null };
  const token = laneSrc.slice(at);
  const m = OFFSET_RE.exec(token);
  if (!m) return { rest: laneSrc, offset: null, error: `bad offset "${token}" — try @+12ms or @-1/32` };
  const sign = m[1] === "-" ? -1 : 1;
  const n = Number(m[2]);
  if (m[4] !== undefined) {
    const den = Number(m[4]);
    if (den === 0) return { rest: laneSrc, offset: null, error: `bad offset "${token}" — zero denominator` };
    if (n / den > MAX_FRAC) return { rest: laneSrc, offset: null, error: `offset ${token} beyond ±1/8 — that's a different rhythm, not a feel` };
    return { rest: laneSrc.slice(0, at).trim(), offset: { kind: "frac", num: sign * n, den } };
  }
  if (n > MAX_MS) return { rest: laneSrc, offset: null, error: `offset ${token} beyond ±${MAX_MS}ms — that's a different rhythm, not a feel` };
  return { rest: laneSrc.slice(0, at).trim(), offset: { kind: "ms", ms: sign * n } };
}

function gcd2(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
const lcm2 = (a, b) => (a / gcd2(a, b)) * b;

/**
 * Parse poly notation → { ok, lanes, lcm, error? }. Each lane:
 * { label, steps, accents, accentPattern, offset, source, ok, error? }.
 * A failed lane fails the whole parse (never half a groove on the wire).
 */
export function parsePolyUPI(input, ctx = { n: 16 }) {
  const lanesSrc = splitLanes(String(input || "").trim());
  if (!lanesSrc.length) return { ok: false, lanes: [], lcm: 0, error: "empty poly pattern" };
  const lanes = [];
  for (let i = 0; i < lanesSrc.length; i++) {
    let src = lanesSrc[i];
    // Optional `name=` label (letters/digits/_/-, before the expression).
    let label = `lane${i + 1}`;
    const lm = /^([A-Za-z][\w-]*)\s*=\s*(.+)$/.exec(src);
    if (lm) { label = lm[1]; src = lm[2]; }
    const { rest, offset, error: offErr } = parseOffset(src);
    if (offErr) return { ok: false, lanes: [], lcm: 0, error: `${label}: ${offErr}` };
    // Per-lane progressive offset, `body%N` (docs/SERPE_POLY.md 2.5: `/` binds
    // loosest, so `%N` belongs to the LANE). Stripped here rather than taught
    // to parseUPI, which stays a pure single-pattern parser.
    const laneBody = rest;
    let progressive = null;
    let body = rest;
    const pm = /^(.*[^\s])\s*%\s*(-?\d+)$/.exec(rest);
    if (pm) {
      progressive = { kind: "offset", step: +pm[2] };
      body = pm[1].trim();
    } else {
      // `body*N` — this lane GROWS by N steps per trigger. Only when '%' did
      // not already claim a suffix: a lane carries one or the other.
      const lm = /^(.*[^\s])\s*\*\s*(\d+)$/.exec(rest);
      if (lm) {
        progressive = { kind: "lengthen", step: +lm[2] };
        body = lm[1].trim();
      }
    }
    const parsed = parseUPI(body, ctx);
    if (!parsed.ok) return { ok: false, lanes: [], lcm: 0, error: `${label}: ${parsed.error ?? `unparsed "${body}"`}` };
    lanes.push({
      label,
      steps: parsed.steps,
      // null unless this lane carries `%N`. The lane's pattern at trigger n is
      // polyLaneAt(lane, n) — state derived from the trigger index, the same
      // approach progressive.js takes, so nothing here has to be stateful.
      progressive,
      accents: parsed.accents,
      accentPattern: parsed.accentPattern,
      // Per-lane feel: a lane may carry its own PD(…)/LS(…), which is the
      // point of poly — one lane pushes while another stays straight.
      microtiming: parsed.microtiming ?? null,
      longShort: parsed.longShort ?? null,
      offset,
      // Keeps the `%N`, so a re-parse can tell E(3,8)%2 from E(3,8) — the
      // plugin uses exactly that comparison to decide restart vs advance.
      source: laneBody,
      parsedLabel: parsed.label,
    });
  }
  const lcm = lanes.reduce((l, lane) => lcm2(l, lane.steps.length || 1), 1);
  return { ok: true, lanes, lcm };
}

/** One lane back to text: label, its own (normalized) UPI, its offset. */
function formatLane(lane) {
  const name = /^lane\d+$/.test(lane.label) ? "" : `${lane.label}=`;
  const off = lane.offset == null ? ""
    : lane.offset.kind === "ms" ? `@${lane.offset.ms >= 0 ? "+" : ""}${lane.offset.ms}ms`
    : `@${lane.offset.num >= 0 ? "+" : ""}${lane.offset.num}/${lane.offset.den}`;
  const prog = !lane.progressive ? ""
    : lane.progressive.kind === "lengthen" ? `*${lane.progressive.step}`
    : `%${lane.progressive.step}`;
  return `${name}${lane.parsedLabel ?? lane.source}${prog}${off}`;
}

/**
 * A lane's pattern at trigger `n` (1-based). Lanes without `%N` never change,
 * so this is the identity for them; a lane with `%N` is rotated by step*n —
 * trigger 1 already shows one step, which is what `%N` means in a mono
 * pattern too. Pure: the same n always gives the same pattern.
 *
 * SIGN: this module's `rotate(p, +k)` equals the C++ PatternUtils
 * `rotatePattern(p, -k)` — the two helpers were written with opposite
 * conventions, verified 2026-07-28 against serpe_poly_precedence. The engine
 * is authoritative, so the offset goes in POSITIVE here. progressive.js's
 * header flagged this direction as unverified because a parser probe could
 * not reach PatternEngine; a poly lane can, which is how it got settled.
 */
export function polyLaneAt(lane, n, opts = {}) {
  if (!lane?.progressive) return lane?.steps ?? [];
  const idx = Math.max(1, Math.floor(n));
  const { step, kind } = lane.progressive;
  if (kind === "lengthen") {
    // Grows by `step` per trigger, base kept as a prefix — trigger 1 is
    // already base+step, matching the engine. The appended steps are random
    // by design, so this is reproducible only for a given RNG (as
    // progressive.js's lengthening is).
    const { random = Math.random } = opts;
    let out = lane.steps.slice();
    for (let i = 0; i < idx; i++) out = out.concat(bellCurveRandomSteps(step, random));
    return out;
  }
  return rotate(lane.steps, step * idx);
}

/** Stable round-trip: parsePolyUPI(formatPolyUPI(p)) is p, normalized. */
export function formatPolyUPI(poly) {
  return poly.lanes.map(formatLane).join(" / ");
}

/** A lane's offset in ticks at a given resolution (frac) — ms stays ms. */
export function offsetTicks(offset, ticksPerBeat, beatsPerWhole = 4) {
  if (!offset || offset.kind !== "frac") return 0;
  return Math.round(ticksPerBeat * beatsPerWhole * (offset.num / offset.den));
}
