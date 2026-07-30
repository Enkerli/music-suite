/**
 * Dataflow audit — the contract and trace formats, with validation.
 *
 * See docs/DATAFLOW_AUDIT.md. Two file kinds:
 *
 *   contract   apps/<app>/dataflow.json    what the app SAYS its channels are
 *   trace      scratch/dataflow/*.jsonl    what a run actually recorded
 *
 * Validation is strict and loud. A malformed trace that parses as "no events"
 * would report a clean bill of health, which is the exact failure this whole
 * tool exists to avoid — a check whose silence is indistinguishable from
 * success. So: unknown fields are errors, and an empty trace is an error.
 */

export const SCOPES = ["ui<->binary", "within-ui", "within-binary", "app<->app"];
export const DIRECTIONS = ["binary->ui", "ui->binary", "one-way", "bidirectional"];

const CHANNEL_KEYS = new Set([
  "id", "scope", "direction", "from", "to", "payload", "cadence",
  "try", "expect", "userVisible", "notes",
]);

/** Throws on anything malformed; returns the parsed contract. */
export function parseContract(json, where = "contract") {
  const c = typeof json === "string" ? JSON.parse(json) : json;
  const err = (m) => { throw new Error(`${where}: ${m}`); };

  if (!c || typeof c !== "object") err("not an object");
  if (typeof c.app !== "string" || !c.app) err("missing `app`");
  if (!Array.isArray(c.channels)) err("missing `channels` array");

  const seen = new Set();
  for (const [i, ch] of c.channels.entries()) {
    const at = `${where}: channels[${i}]`;
    if (typeof ch.id !== "string" || !ch.id) throw new Error(`${at}: missing \`id\``);
    if (seen.has(ch.id)) throw new Error(`${at}: duplicate id "${ch.id}"`);
    seen.add(ch.id);
    if (!SCOPES.includes(ch.scope)) throw new Error(`${at} (${ch.id}): scope must be one of ${SCOPES.join(", ")}`);
    if (!DIRECTIONS.includes(ch.direction)) throw new Error(`${at} (${ch.id}): direction must be one of ${DIRECTIONS.join(", ")}`);
    if (typeof ch.from !== "string" || typeof ch.to !== "string")
      throw new Error(`${at} (${ch.id}): \`from\` and \`to\` are required — naming both ends is most of the value`);
    // A userVisible channel without `expect` cannot generate a test row, and a
    // test sheet with blank expectations is worse than none: the tester writes
    // down whatever happened and calls it correct.
    if (ch.userVisible && (typeof ch.expect !== "string" || !ch.expect))
      throw new Error(`${at} (${ch.id}): userVisible channels need \`expect\``);
    // `try` is a concrete action a person can perform, and it cannot be derived:
    // "type E(3,8)%2|E(3,8)*3/E(3,7) and press Enter a few times" is not
    // reachable from a channel name and a direction. A generated cue like "do
    // something that changes this" is unusable by anyone who did not write the
    // code, which defeats the point of asking diverse people to test.
    if (ch.userVisible && (typeof ch.try !== "string" || !ch.try))
      throw new Error(`${at} (${ch.id}): userVisible channels need \`try\` — a concrete action, not a description`);
    for (const k of Object.keys(ch))
      if (!CHANNEL_KEYS.has(k)) throw new Error(`${at} (${ch.id}): unknown key "${k}"`);
  }
  return c;
}

const EVENT_KEYS = new Set(["t", "side", "scope", "dir", "ch", "seq", "bytes", "hash", "summary"]);

/**
 * Parse JSONL. Returns { events, errors } rather than throwing on a bad line —
 * a trace is field data and one corrupt line should not discard the rest — but
 * an EMPTY trace throws, because silence must never read as success.
 */
export function parseTrace(text, where = "trace") {
  const events = [];
  const errors = [];
  const lines = String(text).split("\n");

  for (const [n, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let e;
    try { e = JSON.parse(line); }
    catch { errors.push(`${where}:${n + 1}: not JSON`); continue; }

    const bad = [];
    if (typeof e.t !== "number") bad.push("t must be a number (ms)");
    if (e.side !== "cpp" && e.side !== "ui") bad.push('side must be "cpp" or "ui"');
    if (!SCOPES.includes(e.scope)) bad.push(`scope must be one of ${SCOPES.join(", ")}`);
    if (e.dir !== "out" && e.dir !== "in") bad.push('dir must be "out" or "in"');
    if (typeof e.ch !== "string" || !e.ch) bad.push("ch required");
    if (!Number.isInteger(e.seq) || e.seq < 0) bad.push("seq must be a non-negative integer");
    for (const k of Object.keys(e)) if (!EVENT_KEYS.has(k)) bad.push(`unknown key "${k}"`);
    if (bad.length) { errors.push(`${where}:${n + 1}: ${bad.join("; ")}`); continue; }

    events.push(e);
  }

  if (!events.length)
    throw new Error(`${where}: no valid events — refusing to report a clean audit from an empty trace`
      + (errors.length ? `\n  ${errors.slice(0, 5).join("\n  ")}` : ""));

  return { events, errors };
}

/** Stable short hash for payload comparison. Not cryptographic — just stable. */
export function payloadHash(value) {
  const s = typeof value === "string" ? value : stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Key-sorted JSON, so two equal payloads always hash the same. */
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}
