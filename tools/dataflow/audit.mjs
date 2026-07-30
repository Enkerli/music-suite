#!/usr/bin/env node
/**
 * Dataflow audit — contract × trace → verdicts.
 *
 * See docs/DATAFLOW_AUDIT.md. Every verdict is either PROVED by the trace or
 * reported as not-observed. Nothing is inferred from a name, which is the whole
 * difference from tools/bridge-audit.mjs.
 *
 * Usage:
 *   node tools/dataflow/audit.mjs --contract apps/serpe/dataflow.json \
 *                                 --trace scratch/dataflow/serpe-*.jsonl [--json] [--md <out>]
 *
 * Exit: 0 = nothing proved broken; 1 = at least one DROPPED/CORRUPTED/REORDERED.
 *       UNDECLARED and NEVER_EXERCISED do not fail — they are bookkeeping, and a
 *       gate that fails on bookkeeping gets switched off.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseContract, parseTrace } from "./schema.mjs";

/** One channel's story, assembled from both sides of the trace. */
function perChannel(events) {
  const by = new Map();
  for (const e of events) {
    if (!by.has(e.ch)) by.set(e.ch, { ch: e.ch, out: [], in: [], scopes: new Set() });
    const c = by.get(e.ch);
    c.scopes.add(e.scope);
    (e.dir === "out" ? c.out : c.in).push(e);
  }
  return by;
}

export function audit({ contract, events, traceErrors = [] }) {
  const declared = new Map(contract.channels.map((c) => [c.id, c]));
  const seen = perChannel(events);
  const findings = [];
  const add = (verdict, ch, detail, extra = {}) =>
    findings.push({ verdict, channel: ch, detail, ...extra });

  for (const [ch, c] of seen) {
    const decl = declared.get(ch);
    if (!decl) {
      add("UNDECLARED", ch,
        `observed ${c.out.length + c.in.length} event(s) on a channel the contract does not mention`
        + ` — either document it or remove it`);
    }

    // Only a channel traced on BOTH sides can prove delivery. Say so rather than
    // guessing: one-sided tracing is exactly how a missing subscription looks
    // identical to a quiet channel.
    if (!c.out.length || !c.in.length) {
      add("ONE_SIDED", ch,
        c.out.length
          ? `sender traced (${c.out.length} out), receiver not traced — delivery cannot be proved either way`
          : `receiver traced (${c.in.length} in), sender not traced — cannot tell what should have arrived`);
      continue;
    }

    const inBySeq = new Map();
    for (const e of c.in) {
      if (!inBySeq.has(e.seq)) inBySeq.set(e.seq, []);
      inBySeq.get(e.seq).push(e);
    }

    const dropped = [];
    const corrupted = [];
    for (const e of c.out) {
      const arrivals = inBySeq.get(e.seq);
      if (!arrivals) { dropped.push(e); continue; }
      if (e.hash && arrivals.every((a) => a.hash && a.hash !== e.hash))
        corrupted.push({ seq: e.seq, sent: e.hash, got: arrivals[0].hash });
    }

    if (dropped.length) {
      const pct = Math.round((dropped.length / c.out.length) * 100);
      add("DROPPED", ch,
        `${dropped.length} of ${c.out.length} sent event(s) never arrived (${pct}%)`,
        { seqs: dropped.slice(0, 8).map((e) => e.seq),
          firstSummary: dropped[0].summary ?? null });
    }
    if (corrupted.length) {
      add("CORRUPTED", ch,
        `${corrupted.length} event(s) arrived with a different payload than was sent`,
        { examples: corrupted.slice(0, 4) });
    }

    // Ordering, judged on arrivals only. A receiver seeing 5 then 4 is a real
    // problem even when nothing is lost — a stale payload can overwrite a fresh
    // one, which is precisely how the scene transform race looked on screen.
    const arrivedSeqs = c.in.map((e) => e.seq);
    const outOfOrder = arrivedSeqs.filter((s, i) => i > 0 && s < arrivedSeqs[i - 1]).length;
    if (outOfOrder) add("REORDERED", ch, `${outOfOrder} arrival(s) out of sequence`);
  }

  // Declared but absent. NOT a failure — but it must be visibly distinct from
  // "verified working", because treating silence as success is how polyState
  // stayed broken.
  for (const [id, c] of declared) {
    if (!seen.has(id))
      add("NEVER_EXERCISED", id,
        `declared (${c.scope}, ${c.direction}) and absent from this trace`
        + ` — this session proves nothing about it either way`);
  }

  const proven = findings.filter((f) => ["DROPPED", "CORRUPTED", "REORDERED"].includes(f.verdict));
  return {
    app: contract.app,
    counts: {
      events: events.length,
      channelsObserved: seen.size,
      channelsDeclared: declared.size,
      traceErrors: traceErrors.length,
    },
    findings,
    ok: proven.length === 0,
  };
}

export function formatReport(r) {
  const L = [];
  L.push(`# Dataflow audit — ${r.app}`, "");
  L.push(`${r.counts.events} events · ${r.counts.channelsObserved} channels observed`
    + ` · ${r.counts.channelsDeclared} declared`
    + (r.counts.traceErrors ? ` · ${r.counts.traceErrors} malformed trace line(s)` : ""), "");

  const order = ["DROPPED", "CORRUPTED", "REORDERED", "ONE_SIDED", "UNDECLARED", "NEVER_EXERCISED"];
  const blurb = {
    DROPPED: "Sent and never arrived. Proved from both sides of the trace.",
    CORRUPTED: "Arrived with a different payload than was sent.",
    REORDERED: "Arrived out of sequence — a stale payload can overwrite a fresh one.",
    ONE_SIDED: "Only one end is traced, so delivery cannot be proved either way. Add the missing probe.",
    UNDECLARED: "Observed but not in the contract. Document it or remove it.",
    NEVER_EXERCISED: "Declared but absent. This session says nothing about it — not that it works.",
  };

  for (const v of order) {
    const fs = r.findings.filter((f) => f.verdict === v);
    if (!fs.length) continue;
    L.push(`## ${v} (${fs.length})`, "", `*${blurb[v]}*`, "");
    for (const f of fs) {
      L.push(`- **${f.channel}** — ${f.detail}`);
      if (f.seqs?.length) L.push(`  - missing seq: ${f.seqs.join(", ")}${f.seqs.length === 8 ? " …" : ""}`);
      if (f.firstSummary) L.push(`  - first lost payload: \`${f.firstSummary}\``);
      if (f.examples) for (const e of f.examples) L.push(`  - seq ${e.seq}: sent \`${e.sent}\`, got \`${e.got}\``);
    }
    L.push("");
  }

  if (!r.findings.length) L.push("No findings. Every declared channel was exercised and every sent event arrived intact.", "");
  L.push(r.ok
    ? "**Verdict: nothing proved broken.**"
    : "**Verdict: something IS broken — see DROPPED/CORRUPTED/REORDERED above.**");
  return L.join("\n");
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const contractPath = arg("contract");
  const tracePath = arg("trace");
  if (!contractPath || !tracePath) {
    console.error("usage: audit.mjs --contract <file.json> --trace <file.jsonl> [--json] [--md <out>]");
    process.exit(2);
  }
  const contract = parseContract(readFileSync(contractPath, "utf8"), contractPath);
  const { events, errors } = parseTrace(readFileSync(tracePath, "utf8"), tracePath);
  const r = audit({ contract, events, traceErrors: errors });

  if (process.argv.includes("--json")) console.log(JSON.stringify(r, null, 2));
  else console.log(formatReport(r));
  const md = arg("md");
  if (md) { writeFileSync(md, formatReport(r)); console.error(`wrote ${md}`); }
  process.exit(r.ok ? 0 : 1);
}
