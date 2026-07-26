/**
 * Serpe — UPI engine. Parses the Universal Pattern Input notation and
 * provides the generators + transforms. Framework-agnostic, no DOM.
 *
 * A pattern is { steps:Uint8Array(n) of 0/1, accents:Uint8Array(n) of 0/1 }.
 * All numeric notation is LEFTMOST = LSB (first step = bit 0, so step k has
 * value 2^k; 0x1:4 = 1000, tresillo 10010010 = 0x94), per CONVENTIONS.md.
 */

/* ── number theory ─────────────────────────────────────────────────── */
export function primeFactors(n) {
  const f = [];
  let d = 2, m = n;
  while (m > 1) {
    while (m % d === 0) { f.push(d); m /= d; }
    d++;
    if (d * d > m && m > 1) { f.push(m); break; }
  }
  return f;
}

import { euclideanRhythm, barlowTransform as barlowCore, barlowIndispensabilityTable } from './rhythm.js';

/* ── generators ────────────────────────────────────────────────────── */

/** Euclidean rhythm (canonical Bjorklund, rotated so the first onset is at 0). */
export function euclid(k, n) { return euclideanRhythm(k, n); }

/** Regular k-gon mapped onto n steps, rotated by offset steps. */
export function polygon(k, offset, n) {
  const steps = new Array(n).fill(0);
  if (k <= 0) return steps;
  for (let i = 0; i < k; i++) {
    const pos = Math.round((i * n) / k) % n;
    steps[(pos + offset) % n] = 1;
  }
  return steps;
}

/** Random onsets with a bell-curve bias toward `density` (0..1). */
export function randomPattern(k, n) {
  const idx = [...Array(n).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const steps = new Array(n).fill(0);
  for (let i = 0; i < Math.min(k, n); i++) steps[idx[i]] = 1;
  return steps;
}

export function rotate(steps, by) {
  const n = steps.length;
  if (n === 0) return steps.slice();
  const r = ((by % n) + n) % n;
  return steps.map((_, i) => steps[(i - r + n) % n]);
}

export function invert(steps) {
  // reflect about step 0 (retrograde of the cycle)
  const n = steps.length;
  return steps.map((_, i) => steps[(n - i) % n]);
}

export function complement(steps) {
  return steps.map((s) => (s ? 0 : 1));
}

/* ── shorthand names + pattern combination (engine parity) ─────────────── */
const SHORTHAND = {
  tri: "P(3,0)", pent: "P(5,0)", hex: "P(6,0)", hept: "P(7,0)", oct: "P(8,0)",
  tresillo: "E(3,8)", cinquillo: "E(5,8)",
};

function gcd2(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
function lcm2(a, b) { return (a / gcd2(a, b)) * b; }

// Split on TOP-LEVEL '+' / '-' (operators between whole patterns); '-' inside a
// pattern (P(3,-1), E(3,8,-2)) is protected by paren depth. Returns [{op,pat}].
function splitTopLevel(s) {
  const terms = []; let depth = 0, cur = "", op = "+";
  for (const c of s) {
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (depth === 0 && (c === "+" || c === "-") && cur.trim()) {
      terms.push({ op, pat: cur.trim() }); cur = ""; op = c;
    } else cur += c;
  }
  if (cur.trim()) terms.push({ op, pat: cur.trim() });
  return terms;
}

/* ── Morse (matches the C++ parseMorse) ─────────────────────────────────
 * letters → morse (concatenated, no inter-letter space), then . = onset,
 * - = onset + a trailing rest (long), space = rest. */
const MORSE = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.",
  h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.",
  o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-",
  v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
};
function morseToSteps(text, shortLen = 1, longLen = 2) {
  let p = String(text).toLowerCase().trim();
  if (p === "sos") p = "...---...";
  else if (p === "cq") p = "-.-.--.-";
  else if (/[a-z]/.test(p)) p = [...p].map((ch) => (MORSE[ch] !== undefined ? MORSE[ch] : ch)).join("");
  const steps = [];
  // Each symbol is an INTERVAL: an onset followed by (len-1) rests. The
  // defaults (short 1, long 2) are what a bare morse string has always meant
  // here; `D:s,l` overrides them, which is how additive/aksak meters are
  // written — "D:2,3 ...-" is short-short-short-long = 2+2+2+3 = 9.
  const emit = (len) => { steps.push(1); for (let i = 1; i < len; i++) steps.push(0); };
  for (const c of p) {
    if (c === ".") emit(shortLen);
    else if (c === "-") emit(longLen);
    else if (c === " ") steps.push(0);
  }
  return steps;
}

/* ── Additive / aksak meters ───────────────────────────────────────────────
 * `A(2,2,2,3)` — a bar built from beat GROUPS, one onset starting each group.
 * The Balkan 9/8 counted "short short short long" is A(2,2,2,3); its rotations
 * (A(2,2,3,2), A(3,2,2,2)) are different rhythms and are written as such.
 * More general than the two-value morse form, which can only say short/long. */
export function additiveToSteps(groups) {
  const steps = [];
  for (const g of groups) {
    const len = Math.max(1, Math.round(Number(g) || 0));
    steps.push(1);
    for (let i = 1; i < len; i++) steps.push(0);
  }
  return steps;
}

/* ── Lascabettes angular quantization (matches C++ QuantizationEngine) ───
 * Re-grid a pattern to `newStepCount` by mapping each onset's ANGLE; clockwise
 * by default, counter-clockwise inverts the angle. Collisions merge. */
export function quantizeSteps(steps, newStepCount, clockwise = true) {
  const orig = steps.length;
  if (orig === 0 || newStepCount < 1) return steps.slice();
  if (orig === newStepCount) return steps.slice();
  const TWO_PI = Math.PI * 2;
  const norm = (a) => { a %= TWO_PI; return a < 0 ? a + TWO_PI : a; };
  const positions = new Set();
  for (let i = 0; i < orig; i++) {
    if (!steps[i]) continue;
    let angle = (i / orig) * TWO_PI;
    if (!clockwise) angle = TWO_PI - angle;
    angle = norm(angle);
    let pos = Math.round((angle / TWO_PI) * newStepCount);
    if (pos >= newStepCount) pos = 0;
    pos = Math.max(0, Math.min(pos, newStepCount - 1));
    positions.add(pos);
  }
  const out = new Array(newStepCount).fill(0);
  for (const p of positions) out[p] = 1;
  return out;
}

// LCM-expand both, then union ('+', OR) or difference ('-', AND-NOT) — matches
// the C++ PatternUtils::combinePatterns.
function combineSteps(a, b, isAdd) {
  const L = lcm2(a.length || 1, b.length || 1);
  const out = new Array(L);
  for (let i = 0; i < L; i++) {
    const av = a[i % a.length], bv = b[i % b.length];
    out[i] = isAdd ? (av || bv ? 1 : 0) : (av && !bv ? 1 : 0);
  }
  return out;
}

/* ── numeric notation (leftmost = LSB) ─────────────────────────────────
 * Strict left-to-right: the first step is bit 0, so step k has value 2^k.
 * 0x1:4 = 1000, 0x8:4 = 0001, tresillo 10010010 = 0x94. Matches the C++
 * engine and @enkerli/theory. */
// BigInt-safe: JS `>>` is 32-bit, which silently mangles patterns longer than
// ~31 steps (e.g. progressive lengthening grows past that). `value` is a BigInt.
function bitsFromValue(value, width) {
  const steps = new Array(width).fill(0);
  let v = typeof value === "bigint" ? value : BigInt(value);
  for (let i = 0; i < width; i++) {
    steps[i] = (v & 1n) === 1n ? 1 : 0;
    v >>= 1n;
  }
  return steps;
}

/* ── parser ────────────────────────────────────────────────────────── */
/**
 * Parse one UPI token into a pattern. Supports the headline grammar:
 *   E(k,n) / E(k,n,rot)      Euclidean
 *   P(k,off) / P(k,off,n)    polygon
 *   R(k,n)                   random
 *   B(k,n) / W(k,n)          Barlow / Wolrab (anti-Barlow) of length n
 *   D(k,n)                   Dilcue (anti-Euclidean)
 *   0x94 / b10010010 / 10010010 / o111 / d73   numeric (leftmost = LSB)
 *   [0,3,6]:8                onset array with optional :N step count
 *   tresillo / cinquillo / tri / pent / hex / hept / oct   shorthand names
 *   SOS / CQ / M:-.- / .-..    Morse (. = short, - = long, space = rest;
 *                              short = 1 step and long = 2 by default)
 *   D:2,3 ...-                 …with CUSTOM long/short lengths — this is how
 *                              additive/aksak meters are written: short-short-
 *                              short-long = 2+2+2+3 = the Balkan 9/8
 *   A(2,2,2,3)                 the same bar as explicit beat GROUPS; more
 *                              general (any group sizes, not just two values)
 *   <pattern> LS(3)            long/short: a long lasts 3× a short (static)
 *   <pattern> LS(1.4..1.8)     …a RANGE — the contrast breathes within it
 *   <pattern> LS(1.4..1.8,70%) …with an explicit push/pull depth
 *   <expr>+<expr> / <expr>-<expr>   combination: union / difference (LCM;
 *                            all-polygon '+' projects onto lcm of polygon sizes)
 *   {10010}<expr>            accent layer wrapping any of the above
 * Returns { steps, accents, label, ok, error }.
 */
/* Long/short suffix — `LS(ratio)`, `LS(min..max)`, `LS(min..max, depth)`.
 * Stripped FIRST, like the accent prefix, so its contents can never reach the
 * combination parser (which splits on top-level '+'/'-'); `..` is the range
 * separator for the same reason — a '-' inside would be ambiguous.
 * A range given without an explicit depth implies FULL depth: otherwise
 * `LS(1.4..1.8)` would silently do nothing, which is the exact trap the UI
 * warns about. */
// `\d+(\.\d+)?` not `[\d.]+`: the latter is greedy across the ".." range
// separator and swallows "1.4..1.8" whole.
const NUM = "\\d+(?:\\.\\d+)?";
const LS_SUFFIX = new RegExp(
  `\\s*LS\\(\\s*(${NUM})\\s*(?:\\.\\.\\s*(${NUM})\\s*)?(?:,\\s*(${NUM}%?)\\s*)?\\)\\s*$`, "i");

export function parseLongShortSuffix(text) {
  const m = LS_SUFFIX.exec(String(text || ""));
  if (!m) return { rest: String(text || "").trim(), longShort: null };
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  let depth;
  if (m[3] !== undefined) {
    depth = m[3].endsWith("%") ? Number(m[3].slice(0, -1)) / 100 : Number(m[3]);
  } else {
    depth = max > min ? 1 : 0;   // a range with no depth means "use the range"
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(depth)) {
    return { rest: String(text).trim(), longShort: null };
  }
  return {
    rest: text.slice(0, m.index).trim(),
    longShort: { min: Math.max(1, min), max: Math.max(Math.max(1, min), max),
                 depth: Math.max(0, Math.min(1, depth)) },
  };
}

export function parseUPI(input, ctx = { n: 16 }) {
  let src = String(input || "").trim();
  let accents = null;

  // Durational (long/short) suffix — removed before anything else parses.
  const lsSplit = parseLongShortSuffix(src);
  const longShortSpec = lsSplit.longShort;
  src = lsSplit.rest;

  // accent prefix {…}
  const accM = src.match(/^\{([^}]*)\}\s*(.*)$/);
  if (accM) {
    src = accM[2].trim();
    accents = accM[1].replace(/[^01]/g, "").split("").map(Number);
  }

  const out = (steps, label) => {
    const n = steps.length;
    let acc = new Array(n).fill(0);
    // Accents cycle over ONSETS, not steps: the k-th onset gets accents[k % len].
    // (Across playback cycles the onset counter keeps going, so accents precess —
    // that persistence is handled by the C++ engine; this shows the first cycle.)
    if (accents && accents.length) {
      let onset = 0;
      for (let i = 0; i < n; i++)
        if (steps[i]) { acc[i] = accents[onset % accents.length] ? 1 : 0; onset++; }
    }
    // accentPattern is the raw {…} layer; the UI re-applies it with a live offset
    // so the displayed accents precess across cycles in step with playback.
    return { steps: steps.map(Number), accents: acc, accentPattern: accents,
             longShort: longShortSpec, label, ok: true };
  };

  try {
    let m;

    // Quantization: <expr>;N (clockwise) / <expr>;-N (counter-clockwise). The
    // base parses recursively (so E(3,8);12, tresillo;12, P(3,0)+P(5,0);16 work).
    const semi = src.indexOf(";");
    if (semi > 0) {
      const mq = src.slice(semi + 1).trim().match(/^(-?)(\d+)$/);
      if (mq) {
        const base = parseUPI(src.slice(0, semi).trim(), ctx);
        if (!base.ok) return base;
        return out(quantizeSteps(base.steps, +mq[2], mq[1] !== "-"),
                   `${base.label};${mq[1]}${mq[2]}`);
      }
    }

    // Shorthand names (resolve, then fall through to the P()/E() matchers so any
    // {accent} prefix is re-applied by out()).
    const sh = SHORTHAND[src.toLowerCase()];
    if (sh) src = sh;

    // Additive / aksak: A(2,2,2,3) — beat groups, one onset each.
    m = src.match(/^A\(\s*([\d\s,]+?)\s*\)$/i);
    if (m) {
      const groups = m[1].split(",").map((g) => g.trim()).filter(Boolean).map(Number);
      if (groups.length && groups.every((g) => Number.isFinite(g) && g >= 1)) {
        return out(additiveToSteps(groups), `A(${groups.join(",")})`);
      }
    }

    // Morse — checked BEFORE combination because Morse uses '-'. Only pure
    // dot/dash strings, an `M:` prefix, or a bare letter word qualify (real
    // combinations carry parens/digits, so they fall through to the combiner).
    // `D:s,l` in front sets what a short and a long are worth (the original
    // Rhythm Pattern Explorer's "Custom Durations"), which is what turns the
    // dot/dash form into an additive-meter notation.
    {
      let body = src, shortLen = 1, longLen = 2;
      const dm = body.match(/^D:\s*(\d+)\s*,\s*(\d+)\s*(.*)$/i);
      if (dm) { shortLen = Math.max(1, +dm[1]); longLen = Math.max(1, +dm[2]); body = dm[3].trim(); }
      let morseSrc = null;
      if (/^M:/i.test(body)) morseSrc = body.slice(2);
      else if (/^[.\-\s]+$/.test(body) && /[.\-]/.test(body)) morseSrc = body;
      else if (/^[a-z]+$/i.test(body)) morseSrc = body;
      if (morseSrc !== null) {
        const steps = morseToSteps(morseSrc, shortLen, longLen);
        if (steps.length) return out(steps, dm ? `D:${shortLen},${longLen} ${body}` : `♪ ${src}`);
      }
    }

    // Pattern combination: top-level '+' / '-' between whole patterns. Skip if a
    // term is purely numeric (that's a progressive offset like E(3,8)+2, handled
    // by the Progressive controls, not a combination).
    if (/[+-]/.test(src)) {
      const terms = splitTopLevel(src);
      if (terms.length >= 2 && terms.every((t) => !/^\d+$/.test(t.pat))) {
        const label = terms.map((t, i) => (i ? t.op : "") + t.pat).join("");
        // Polygon-LCM projection when every term is a polygon joined with '+'
        // (so P(3,0)+P(5,0) lands on lcm(3,5)=15, like the C++ engine).
        const polyRe = /^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i;
        if (terms.every((t) => t.op === "+" && polyRe.test(t.pat))) {
          const sizes = terms.map((t) => { const mm = t.pat.match(polyRe); return +mm[1] * (mm[3] ? +mm[3] : 1); });
          const L = sizes.reduce((a, b) => lcm2(a, b));
          const steps = new Array(L).fill(0);
          for (const t of terms) {
            const mm = t.pat.match(polyRe);
            const p = polygon(+mm[1], (((+mm[2]) % L) + L) % L, L);
            for (let i = 0; i < L; i++) if (p[i]) steps[i] = 1;
          }
          return out(steps, label);
        }
        const first = parseUPI(terms[0].pat, ctx);
        if (!first.ok) return first;
        let steps = first.steps.slice();
        for (let i = 1; i < terms.length; i++) {
          const r = parseUPI(terms[i].pat, ctx);
          if (!r.ok) return r;
          steps = combineSteps(steps, r.steps, terms[i].op === "+");
        }
        return out(steps, label);
      }
    }

    if ((m = src.match(/^E\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?\)$/i))) {
      const k = +m[1], n = +m[2], rot = m[3] ? +m[3] : 0;
      return out(euclideanRhythm(k, n, rot), `E(${k},${n}${rot ? "," + rot : ""})`);
    }
    if ((m = src.match(/^P\(\s*(\d+)\s*,\s*(-?\d+)\s*(?:,\s*(\d+)\s*)?\)$/i))) {
      const k = +m[1], off = +m[2], n = m[3] ? +m[3] : ctx.n;
      return out(polygon(k, ((off % n) + n) % n, n), `P(${k},${off}${m[3] ? "," + n : ""})`);
    }
    if ((m = src.match(/^R\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i))) {
      const k = +m[1], n = +m[2];
      return out(randomPattern(k, n), `R(${k},${n})`);
    }
    if ((m = src.match(/^([BWD])\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i))) {
      const tag = m[1].toUpperCase(), k = +m[2], n = +m[3];
      // D = Dilcue (anti-Euclidean): complement of E(n−k, n) — matches the C++.
      if (tag === "D") return out(complement(euclideanRhythm(n - k, n)), `D(${k},${n})`);
      // B / W = Barlow / Wolrab: start on the downbeat and concentrate to k onsets
      // by (anti-)indispensability — exactly the plugin's generateBarlowTransformation.
      const base = new Array(n).fill(0); base[0] = 1;
      return out(barlowCore(base, k, { wolrabMode: tag === "W" }), `${tag}(${k},${n})`);
    }
    if ((m = src.match(/^0x([0-9a-f]+)(?::(\d+))?$/i))) {
      // Hex digits are little-endian (first step's nibble leftmost): reverse
      // before parsing, so 0x94 = tresillo, 0x1 = step 0. BigInt — long patterns.
      const v = BigInt("0x" + [...m[1]].reverse().join(""));
      const width = m[2] ? +m[2] : m[1].length * 4;
      return out(bitsFromValue(v, width), `0x${m[1].toUpperCase()}`);
    }
    if ((m = src.match(/^o([0-7]+)(?::(\d+))?$/i))) {
      const v = BigInt("0o" + [...m[1]].reverse().join(""));  // little-endian digits
      const width = m[2] ? +m[2] : m[1].length * 3;
      return out(bitsFromValue(v, width), `o${m[1]}`);
    }
    if ((m = src.match(/^d(\d+)(?::(\d+))?$/i))) {
      const v = BigInt(m[1]);
      const width = m[2] ? +m[2] : Math.max(1, v.toString(2).length);
      return out(bitsFromValue(v, width), `d${m[1]}`);
    }
    if ((m = src.match(/^\[([\d,\s]*)\](?::(\d+))?$/))) {
      const idx = m[1].split(",").map((s) => s.trim()).filter((s) => s !== "").map(Number);
      const n = m[2] ? +m[2] : (idx.length ? Math.max(...idx) + 1 : ctx.n);
      const steps = new Array(n).fill(0);
      idx.forEach((i) => { if (i >= 0 && i < n) steps[i] = 1; });
      return out(steps, `[${idx.join(",")}]:${n}`);
    }
    if ((m = src.match(/^b?([01]+)$/i)) && /[01]/.test(src)) {
      const bits = m[1].split("").map(Number);
      return out(bits, bits.join(""));
    }
  } catch (e) {
    return { steps: euclid(5, ctx.n), accents: new Array(ctx.n).fill(0), label: "E(5,16)", ok: false, error: String(e) };
  }
  return { steps: euclid(5, ctx.n), accents: new Array(ctx.n).fill(0), label: "", ok: false, error: "Unrecognised pattern" };
}

/* ── Barlow indispensability (canonical — for the analysis display) ─── */
/** Per-step indispensability (0..1, 1 = downbeat) — Clarence Barlow's method. */
export function indispensabilityWeights(n) { return barlowIndispensabilityTable(n); }

/* ── Barlow-family transforms (canonical) ───────────────────────────── */
/** Add/remove onsets to reach targetK by Barlow indispensability; anti = Wolrab. */
export function barlowTransform(steps, targetK, anti = false) {
  return barlowCore(steps, targetK, { wolrabMode: anti });
}

export function onsetCount(steps) { return steps.reduce((a, s) => a + s, 0); }
