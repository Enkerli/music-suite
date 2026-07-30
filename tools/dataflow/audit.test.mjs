/**
 * Verdict logic, pinned against synthetic traces.
 *
 * Synthetic on purpose: the probes (stages 3–4 of docs/DATAFLOW_AUDIT.md) do not
 * exist yet, so there are no real traces to read. What these tests establish is
 * that the ANALYSER is right — that a dropped event is reported as dropped, and
 * more importantly that an unexercised channel is never reported as working.
 *
 * They say nothing about any app. That boundary is stated in the design doc and
 * repeated here because the previous tool's failing was not that it was static,
 * it was that its output read like proof.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { audit, formatReport } from "./audit.mjs";
import { parseContract, parseTrace, payloadHash, stableStringify } from "./schema.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITE = join(HERE, "../..");

const contract = (channels) => parseContract({ app: "test", channels });
const ch = (id, over = {}) => ({
  id, scope: "ui<->binary", direction: "binary->ui",
  from: "cpp", to: "js", ...over,
});
/** A user-visible channel needs both halves of the test row. */
const visible = (id, over = {}) => ch(id, { userVisible: true, try: "do the thing", expect: "the thing happens", ...over });
const ev = (over) => ({
  t: 1000, side: "cpp", scope: "ui<->binary", dir: "out", ch: "x", seq: 0, ...over,
});
/** A clean delivered pair. */
const pair = (id, seq, hash = "aaaa") => [
  ev({ ch: id, seq, hash, dir: "out", side: "cpp" }),
  ev({ ch: id, seq, hash, dir: "in", side: "ui", t: 1001 }),
];

describe("verdicts", () => {
  it("reports nothing when every sent event arrives intact", () => {
    const r = audit({ contract: contract([ch("x")]), events: [...pair("x", 0), ...pair("x", 1)] });
    expect(r.findings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("proves DROPPED from both sides — the polyState case", () => {
    const events = [
      ...pair("x", 0),
      ev({ ch: "x", seq: 1, dir: "out", hash: "bbbb", summary: "lane1=10010010" }),  // never arrives
      ...pair("x", 2),
    ];
    const r = audit({ contract: contract([ch("x")]), events });
    const f = r.findings.find((x) => x.verdict === "DROPPED");
    expect(f).toBeTruthy();
    expect(f.detail).toContain("1 of 3");
    expect(f.seqs).toEqual([1]);
    // The lost payload is named, so the report says WHAT went missing.
    expect(f.firstSummary).toBe("lane1=10010010");
    expect(r.ok).toBe(false);
  });

  it("proves CORRUPTED when the same seq arrives with a different payload", () => {
    const events = [
      ev({ ch: "x", seq: 0, dir: "out", hash: "sent" }),
      ev({ ch: "x", seq: 0, dir: "in", side: "ui", hash: "different" }),
    ];
    const r = audit({ contract: contract([ch("x")]), events });
    expect(r.findings.map((f) => f.verdict)).toContain("CORRUPTED");
    expect(r.ok).toBe(false);
  });

  it("flags REORDERED even when nothing is lost", () => {
    const events = [
      ev({ ch: "x", seq: 0, dir: "out", hash: "a" }), ev({ ch: "x", seq: 1, dir: "out", hash: "b" }),
      ev({ ch: "x", seq: 1, dir: "in", side: "ui", hash: "b", t: 1002 }),
      ev({ ch: "x", seq: 0, dir: "in", side: "ui", hash: "a", t: 1003 }),
    ];
    const r = audit({ contract: contract([ch("x")]), events });
    expect(r.findings.map((f) => f.verdict)).toContain("REORDERED");
    expect(r.ok).toBe(false);
  });

  it("will not claim delivery when only one end is traced", () => {
    // The trap: a sender-only trace looks identical whether the receiver is
    // missing or merely untraced. Say so instead of guessing.
    const r = audit({ contract: contract([ch("x")]), events: [ev({ ch: "x", seq: 0, dir: "out" })] });
    const f = r.findings.find((x) => x.verdict === "ONE_SIDED");
    expect(f).toBeTruthy();
    expect(f.detail).toContain("cannot be proved");
    expect(r.ok).toBe(true);   // not proved broken — and not proved working either
  });

  it("keeps NEVER_EXERCISED distinct from working, and does not fail on it", () => {
    const r = audit({ contract: contract([ch("x"), ch("quiet")]), events: [...pair("x", 0)] });
    const f = r.findings.find((v) => v.verdict === "NEVER_EXERCISED");
    expect(f.channel).toBe("quiet");
    expect(f.detail).toContain("proves nothing about it");
    expect(r.ok).toBe(true);
  });

  it("reports UNDECLARED channels without failing the run", () => {
    const r = audit({ contract: contract([ch("x")]), events: [...pair("x", 0), ...pair("surprise", 0)] });
    expect(r.findings.find((f) => f.verdict === "UNDECLARED").channel).toBe("surprise");
    expect(r.ok).toBe(true);
  });

  it("renders a report that names the verdict and what it means", () => {
    const events = [ev({ ch: "x", seq: 0, dir: "out", hash: "a", summary: "s" })];
    const md = formatReport(audit({ contract: contract([ch("x"), ch("q")]), events }));
    expect(md).toContain("# Dataflow audit — test");
    expect(md).toContain("ONE_SIDED");
    expect(md).toContain("NEVER_EXERCISED");
    expect(md).toContain("not that it works");
  });
});

describe("schema", () => {
  it("refuses an empty trace rather than reporting a clean audit", () => {
    expect(() => parseTrace("")).toThrow(/refusing to report a clean audit/);
    expect(() => parseTrace("\n# just a comment\n")).toThrow(/refusing/);
  });

  it("keeps good lines and reports bad ones", () => {
    const good = JSON.stringify(ev({ ch: "x", seq: 0 }));
    const { events, errors } = parseTrace(`${good}\nnot json\n${good}`);
    expect(events).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  it("rejects unknown keys, so a typo is not silently ignored", () => {
    const { errors } = parseTrace(JSON.stringify({ ...ev({ ch: "x", seq: 0 }), chanel: "typo" }) + "\n" + JSON.stringify(ev({ ch: "x", seq: 1 })));
    expect(errors[0]).toMatch(/unknown key "chanel"/);
  });

  it("requires expect on a userVisible channel", () => {
    expect(() => contract([ch("x", { userVisible: true })])).toThrow(/need `expect`/);
  });

  it("requires a concrete `try` on a userVisible channel", () => {
    // Without it the sheet says "do something that changes this", which nobody
    // outside the codebase can act on — and an unusable sheet is why protocols
    // get abandoned.
    expect(() => contract([ch("x", { userVisible: true, expect: "e" })]))
      .toThrow(/need `try`/);
    expect(() => contract([visible("x")])).not.toThrow();
  });

  it("requires both ends to be named", () => {
    expect(() => parseContract({ app: "a", channels: [{ id: "x", scope: "ui<->binary", direction: "binary->ui" }] }))
      .toThrow(/naming both ends/);
  });

  it("hashes payloads stably regardless of key order", () => {
    expect(payloadHash({ a: 1, b: [2, 3] })).toBe(payloadHash({ b: [2, 3], a: 1 }));
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe("the Serpe contract", () => {
  const c = parseContract(readFileSync(join(SUITE, "apps/serpe/dataflow.json"), "utf8"), "serpe");

  it("is valid and covers both bridge directions plus within-binary flows", () => {
    expect(c.app).toBe("serpe");
    const scopes = new Set(c.channels.map((x) => x.scope));
    expect(scopes.has("ui<->binary")).toBe(true);
    expect(scopes.has("within-binary")).toBe(true);
    const dirs = new Set(c.channels.map((x) => x.direction));
    expect(dirs.has("binary->ui")).toBe(true);
    expect(dirs.has("ui->binary")).toBe(true);
  });

  it("declares polyState, the channel whose absence started this", () => {
    const p = c.channels.find((x) => x.id === "polyState");
    expect(p.userVisible).toBe(true);
    expect(p.expect).toMatch(/lane/i);
    expect(p.notes).toMatch(/no juceOn subscription/);
  });

  it("matches the bridge subscriptions that actually exist", () => {
    // Cross-check the contract against reality, so the contract cannot quietly
    // describe an app that no longer exists. Only binary->ui channels: those are
    // the ones a juceOn must exist for.
    const bridge = readFileSync(join(SUITE, "apps/serpe/juce-bridge.js"), "utf8");
    const missing = c.channels
      .filter((x) => x.scope === "ui<->binary" && x.direction === "binary->ui")
      .map((x) => x.id)
      .filter((id) => !new RegExp(`juceOn\\s*\\(\\s*['"]${id}['"]`).test(bridge));
    expect(missing).toEqual([]);
  });
});
