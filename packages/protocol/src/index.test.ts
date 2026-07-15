import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PROTOCOL_VERSION, MANUFACTURER_ID, SYSEX_START, SYSEX_END,
  makeMessage, validateMessage, pack7, unpack7,
  encodeMessage, decodeFrame, Reassembler,
  makeManifest, makeParam, makeCommand,
  type SuiteMessage, type ManifestBody,
} from "./index.js";

// ── pack7 / unpack7 ──────────────────────────────────────────────────────────

describe("7-in-8 packing", () => {
  const cases: Array<[string, number[]]> = [
    ["empty", []],
    ["one low byte", [0x41]],
    ["one high byte", [0xff]],
    ["exactly 7", [0, 1, 127, 128, 200, 255, 64]],
    ["eight (partial trailing group)", [10, 20, 30, 40, 50, 60, 70, 200]],
    ["utf-8 of E♭ (multibyte)", [...new TextEncoder().encode("E♭ major")]],
  ];
  for (const [name, bytes] of cases) {
    it(`round-trips ${name}`, () => {
      const packed = pack7(Uint8Array.from(bytes));
      expect([...packed].every((b) => b < 0x80)).toBe(true); // 7-bit clean
      expect([...unpack7(packed)]).toEqual(bytes);
    });
  }
  it("rejects a non-7-bit packed stream", () => {
    expect(() => unpack7(Uint8Array.from([0x80]))).toThrow();
  });
});

// ── Envelope validation ──────────────────────────────────────────────────────

describe("validateMessage", () => {
  it("accepts a well-formed scale push", () => {
    const m = makeMessage("pickpcs", "scale", { mask: 2741, root: 0, name: "C major" });
    expect(validateMessage(m)).toEqual({ ok: true, errors: [] });
  });
  it("rejects an unknown sender app", () => {
    const m = makeMessage("pickpcs", "scale", { mask: 1 });
    expect(validateMessage({ ...m, from: "daw" }).ok).toBe(false);
  });
  it("rejects a bad destination", () => {
    const m = makeMessage("pickpcs", "scale", { mask: 1 });
    expect(validateMessage({ ...m, to: "everyone" }).ok).toBe(false);
    expect(validateMessage({ ...m, to: "*" }).ok).toBe(true);
    expect(validateMessage({ ...m, to: "pitchfold" }).ok).toBe(true);
  });
  it("rejects a 13-bit scale mask", () => {
    expect(validateMessage(makeMessage("pickpcs", "scale", { mask: 4096 })).ok).toBe(false);
  });
  it("chord needs at least pcs, notes, or symbol", () => {
    expect(validateMessage(makeMessage("proggenie", "chord", {})).ok).toBe(false);
    expect(validateMessage(makeMessage("proggenie", "chord", { symbol: "Cmaj7" })).ok).toBe(true);
  });
  it("pattern bounds its steps", () => {
    expect(validateMessage(makeMessage("serpe", "pattern", { steps: 0, mask: 1 })).ok).toBe(false);
    expect(validateMessage(makeMessage("serpe", "pattern", { steps: 8, mask: 73 })).ok).toBe(true);
  });
});

// ── Control & interop plane (manifest / param / command) ─────────────────────

const serpeManifest: ManifestBody = {
  app: "serpe", v: 1,
  params: [
    { id: "density", label: "Density", unit: "ratio", min: 0, max: 1, default: 0.5, step: 0.01 },
    { id: "steps", label: "Steps", unit: "count", min: 1, max: 128, default: 16, step: 1 },
  ],
  commands: [
    { name: "next-pattern", label: "Next pattern" },
    { name: "mutate", label: "Mutate", args: [{ id: "amount", unit: "ratio", min: 0, max: 1, default: 0.2 }] },
  ],
};

describe("manifest validation", () => {
  it("accepts a well-formed manifest", () => {
    expect(validateMessage(makeManifest("serpe", serpeManifest)).ok).toBe(true);
  });
  it("rejects an unknown unit", () => {
    const bad = { ...serpeManifest, params: [{ id: "x", label: "X", unit: "furlong", min: 0, max: 1, default: 0 }] };
    expect(validateMessage(makeManifest("serpe", bad as never)).ok).toBe(false);
  });
  it("rejects a default outside [min, max]", () => {
    const bad = { ...serpeManifest, params: [{ id: "x", label: "X", unit: "ratio", min: 0, max: 1, default: 2 }] };
    expect(validateMessage(makeManifest("serpe", bad)).ok).toBe(false);
  });
  it("rejects min > max", () => {
    const bad = { ...serpeManifest, params: [{ id: "x", label: "X", unit: "ratio", min: 1, max: 0, default: 0.5 }] };
    expect(validateMessage(makeManifest("serpe", bad)).ok).toBe(false);
  });
  it("rejects duplicate param ids", () => {
    const bad = { ...serpeManifest, params: [serpeManifest.params[0]!, serpeManifest.params[0]!] };
    expect(validateMessage(makeManifest("serpe", bad)).ok).toBe(false);
  });
  it("requires values[] for an enum unit", () => {
    const bad = { ...serpeManifest, params: [{ id: "m", label: "Mode", unit: "enum", min: 0, max: 2, default: 0 }] };
    expect(validateMessage(makeManifest("serpe", bad as never)).ok).toBe(false);
  });
});

describe("param validation", () => {
  it("accepts a single set", () => {
    expect(validateMessage(makeParam("external", { id: "density", value: 0.7 }, { to: "serpe" })).ok).toBe(true);
  });
  it("accepts a report batch", () => {
    expect(validateMessage(makeParam("serpe", { mode: "report", params: [{ id: "density", value: 0.7 }] })).ok).toBe(true);
  });
  it("rejects both single and batch at once", () => {
    expect(validateMessage(makeParam("serpe", { id: "density", value: 1, params: [{ id: "steps", value: 8 }] })).ok).toBe(false);
  });
  it("rejects neither single nor batch", () => {
    expect(validateMessage(makeParam("serpe", {})).ok).toBe(false);
  });
  it("rejects a non-numeric value", () => {
    expect(validateMessage(makeParam("serpe", { id: "density", value: "loud" as never })).ok).toBe(false);
  });
  it("rejects an unknown mode", () => {
    expect(validateMessage(makeMessage("serpe", "param", { mode: "toggle", id: "x", value: 1 })).ok).toBe(false);
  });
});

describe("command validation", () => {
  it("accepts a command with named args", () => {
    expect(validateMessage(makeCommand("external", { name: "mutate", args: { amount: 0.3 } }, { to: "serpe" })).ok).toBe(true);
  });
  it("accepts a bare command", () => {
    expect(validateMessage(makeCommand("external", { name: "next-pattern" }, { to: "serpe" })).ok).toBe(true);
  });
  it("rejects an empty command name", () => {
    expect(validateMessage(makeCommand("external", { name: "" })).ok).toBe(false);
  });
  it("rejects non-object args", () => {
    expect(validateMessage(makeMessage("external", "command", { name: "x", args: [1, 2] })).ok).toBe(false);
  });
});

// ── Convention pins (leftmost = LSB — the suite-wide bit order) ─────────────

describe("bit-order convention pins", () => {
  it("C major scale mask is 2741 (0xAB5): pcs {0,2,4,5,7,9,11}, pc i = bit i", () => {
    const pcs = [0, 2, 4, 5, 7, 9, 11];
    const mask = pcs.reduce((m, pc) => m | (1 << pc), 0);
    expect(mask).toBe(2741);
    expect(validateMessage(makeMessage("pickpcs", "scale", { mask })).ok).toBe(true);
  });
  it("tresillo over 8 steps is mask 73: onsets {0,3,6}, onset i = bit i", () => {
    const onsets = [0, 3, 6];
    const mask = onsets.reduce((m, i) => m | (1 << i), 0);
    expect(mask).toBe(73);
    expect(validateMessage(makeMessage("serpe", "pattern", { steps: 8, mask })).ok).toBe(true);
  });
});

// ── Framing, chunking, reassembly ────────────────────────────────────────────

function msg(over: Partial<SuiteMessage> = {}): SuiteMessage {
  return {
    ...makeMessage("pickpcs", "scale", { mask: 2741, root: 3, name: "E♭ major" },
      { to: "pitchfold", id: "test-msg-0001", sentAt: "2026-07-05T12:00:00Z" }),
    ...over,
  };
}

describe("encode / decode / reassemble", () => {
  it("frames are complete, tagged, 7-bit-clean SysEx", () => {
    const frames = encodeMessage(msg(), { msgId: 42 });
    expect(frames).toHaveLength(1);
    const f = frames[0]!;
    expect(f[0]).toBe(SYSEX_START);
    expect(f[1]).toBe(MANUFACTURER_ID);
    expect([f[2], f[3]]).toEqual([0x45, 0x4b]); // "EK"
    expect(f[4]).toBe(PROTOCOL_VERSION);
    expect(f[f.length - 1]).toBe(SYSEX_END);
    expect([...f.slice(1, -1)].every((b) => b < 0x80)).toBe(true);
  });

  it("single-frame round-trip preserves the message exactly (incl. ♭)", () => {
    const m = msg();
    const out = new Reassembler().push(encodeMessage(m, { msgId: 7 })[0]!);
    expect(out).toEqual(m);
    expect((out!.body as { name: string }).name).toBe("E♭ major");
  });

  it("chunks large messages and reassembles them out of order", () => {
    const big = msg({ body: { mask: 1, name: "x".repeat(2000) } });
    const frames = encodeMessage(big, { chunkBytes: 300, msgId: 9 });
    expect(frames.length).toBeGreaterThan(5);
    const r = new Reassembler();
    const shuffled = [...frames].reverse();
    let result: SuiteMessage | null = null;
    for (const f of shuffled) result = r.push(f) ?? result;
    expect(result).toEqual(big);
  });

  it("reassembles two interleaved messages independently", () => {
    const a = msg({ id: "test-msg-000A", body: { mask: 5, name: "A".repeat(900) } });
    const b = msg({ id: "test-msg-000B", body: { mask: 9, name: "B".repeat(900) } });
    const fa = encodeMessage(a, { chunkBytes: 300, msgId: 100 });
    const fb = encodeMessage(b, { chunkBytes: 300, msgId: 200 });
    const r = new Reassembler();
    const got: SuiteMessage[] = [];
    const order = fa.flatMap((f, i) => (fb[i] ? [f, fb[i]!] : [f]));
    for (const f of order) { const m = r.push(f); if (m) got.push(m); }
    expect(got.map((m) => m.id).sort()).toEqual(["test-msg-000A", "test-msg-000B"]);
  });

  it("an incomplete message yields nothing and is evicted when stale", () => {
    const frames = encodeMessage(msg(), { chunkBytes: 40, msgId: 5 });
    const r = new Reassembler(1000);
    for (const f of frames.slice(0, -1)) expect(r.push(f, 0)).toBeNull();
    // …the final chunk arrives too late: earlier parts were evicted.
    expect(r.push(frames[frames.length - 1]!, 5000)).toBeNull();
  });

  it("ignores foreign SysEx safely", () => {
    const foreign = Uint8Array.from([0xf0, 0x43, 0x10, 0x4c, 0x00, 0xf7]); // Yamaha-ish
    expect(decodeFrame(foreign)).toBeNull();
    expect(new Reassembler().push(foreign)).toBeNull();
  });

  it("refuses to encode an invalid message", () => {
    expect(() => encodeMessage({ ...msg(), from: "daw" as never })).toThrow(/invalid suite/);
  });
});

// ── Committed vectors — the cross-language contract (like theory's rhythm) ──

describe("vector drift guard", () => {
  const vectors = JSON.parse(readFileSync(
    fileURLToPath(new URL("../vectors/protocol.json", import.meta.url)), "utf8",
  )) as Array<{ name: string; msgId: number; chunkBytes?: number;
    message: SuiteMessage; frames: string[] }>;

  it("has vectors", () => expect(vectors.length).toBeGreaterThanOrEqual(4));

  for (const v of JSON.parse(readFileSync(
    fileURLToPath(new URL("../vectors/protocol.json", import.meta.url)), "utf8"))) {
    it(`reproduces "${v.name}" byte-for-byte`, () => {
      const frames = encodeMessage(v.message, { msgId: v.msgId, chunkBytes: v.chunkBytes });
      const hex = frames.map((f) => [...f].map((b) => b.toString(16).padStart(2, "0")).join(""));
      expect(hex).toEqual(v.frames);
      // and the committed frames decode back to the committed message
      const r = new Reassembler();
      let out: SuiteMessage | null = null;
      for (const fh of v.frames) {
        const bytes = Uint8Array.from(fh.match(/../g)!.map((h) => parseInt(h, 16)));
        out = r.push(bytes) ?? out;
      }
      expect(out).toEqual(v.message);
    });
  }
});
