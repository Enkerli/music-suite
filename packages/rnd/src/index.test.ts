import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  applyMessage,
  decodeSysex,
  describeForeignSysex,
  emptyStatus,
  encodeSeed,
  encodeUnlockAndDump,
  formatSeed,
  fromHex,
  hasManufacturerTag,
  packSeed,
  parseSeed,
  rootNoteNumber,
  scaleCcValue,
  scaleIndexForCc,
  summarize,
  sysexFromSmf,
  toHex,
  unpackSeed,
  NUM_SCALES,
} from "./index.js";

const vectors = JSON.parse(
  readFileSync(fileURLToPath(new URL("../vectors/frames.json", import.meta.url)), "utf8"),
);

describe("seeds", () => {
  it("packs and unpacks the shared vectors", () => {
    for (const v of vectors.seeds) {
      expect(packSeed(v.value), formatSeed(v.value)).toEqual(v.septets);
      expect(unpackSeed(v.septets)).toBe(v.value);
      expect(formatSeed(v.value)).toBe(v.text);
    }
  });

  it("never emits a byte with the high bit set", () => {
    for (const seed of [0xffffffff, 0xaaaaaaaa, 0x55555555]) {
      for (const b of packSeed(seed)) expect(b & 0x80).toBe(0);
    }
  });

  it("round-trips text", () => {
    expect(parseSeed("0xaa442ce7")).toBe(0xaa442ce7);
    expect(parseSeed("0xAA442CE7")).toBe(0xaa442ce7);
    expect(parseSeed("  0xaa442ce7 ")).toBe(0xaa442ce7);
    expect(parseSeed("aa442ce7")).toBe(0xaa442ce7);

    // Digits-only is decimal, so a tempo-looking number means itself.
    expect(parseSeed("125")).toBe(125);
    expect(parseSeed("0x125")).toBe(0x125);

    expect(parseSeed("")).toBeNull();
    expect(parseSeed("   ")).toBeNull();
    expect(parseSeed("0xdeadbeeff")).toBeNull();
    expect(parseSeed("4294967296")).toBeNull();
    expect(parseSeed("nope!")).toBeNull();

    expect(parseSeed(formatSeed(0xffffffff))).toBe(0xffffffff);
  });
});

describe("decoding the captured frames", () => {
  it("matches the shared vectors byte for byte", () => {
    for (const v of vectors.captured) {
      const decoded = decodeSysex(fromHex(v.hex));
      expect(decoded, v.hex).not.toBeNull();
      expect(decoded).toMatchObject(v.decoded);
      expect(summarize(decoded!)).toBe(v.summary);
    }
  });

  it("accepts frames with or without the F0/F7 wrapper", () => {
    const full = fromHex(vectors.captured[0].hex);
    for (const variant of [full, full.slice(1), full.slice(0, -1), full.slice(1, -1)]) {
      expect(decodeSysex(variant)).toMatchObject({ kind: "seed" });
    }
  });
});

describe("rejecting what is not ours", () => {
  it("returns null for every rejected vector", () => {
    for (const v of vectors.rejected) {
      expect(decodeSysex(fromHex(v.hex)), v.why).toBeNull();
    }
  });

  it("tells foreign SysEx apart from our own damaged frames", () => {
    // The distinction the probe got wrong once: a host that delivers another
    // vendor's frame intact has proved it passes SysEx.
    for (const v of vectors.foreign) {
      const bytes = fromHex(v.hex);
      expect(hasManufacturerTag(bytes), v.source).toBe(false);
      expect(describeForeignSysex(bytes)).toBe(v.label);
      expect(decodeSysex(bytes)).toBeNull();
    }

    for (const v of vectors.damagedButOurs) {
      const bytes = fromHex(v.hex);
      expect(hasManufacturerTag(bytes), v.why).toBe(true);
      expect(describeForeignSysex(bytes)).toBeNull();
      expect(decodeSysex(bytes)).toBeNull();
    }
  });
});

describe("encoding", () => {
  it("produces the exact bytes the device sends", () => {
    for (const v of vectors.encoded) {
      const bytes = v.what === "seed" ? encodeSeed(v.seed) : encodeUnlockAndDump();
      expect(toHex(bytes)).toBe(v.hex);
    }
  });

  it("round-trips anything it builds", () => {
    for (const seed of [0, 1, 0xaa442ce7, 0xffffffff]) {
      expect(decodeSysex(encodeSeed(seed))).toMatchObject({ kind: "seed", seed });
    }
  });
});

describe("control layer", () => {
  it("uses the device's CC9 band midpoints", () => {
    expect(vectors.scaleCc.midpoints).toHaveLength(NUM_SCALES);

    for (let i = 0; i < NUM_SCALES; i++) {
      expect(scaleCcValue(i)).toBe(vectors.scaleCc.midpoints[i]);
      expect(scaleCcValue(i)).toBe(Math.floor(3.2 + 6.4 * i));
      // A band's midpoint must select that band back.
      expect(scaleIndexForCc(scaleCcValue(i))).toBe(i);
    }

    expect(scaleIndexForCc(0)).toBe(0);
    expect(scaleIndexForCc(127)).toBe(NUM_SCALES - 1);
  });

  it("maps roots onto channel-1 notes", () => {
    expect(rootNoteNumber(0)).toBe(60);
    expect(rootNoteNumber(2)).toBe(62);
    expect(rootNoteNumber(11)).toBe(71);
    expect(rootNoteNumber(12)).toBe(60);
    expect(rootNoteNumber(-1)).toBe(71);
  });
});

describe("status accumulation", () => {
  it("folds a whole dump together", () => {
    let status = emptyStatus();

    for (const v of vectors.captured.slice(0, 4)) {
      const decoded = decodeSysex(fromHex(v.hex));
      if (decoded) status = applyMessage(status, decoded);
    }

    expect(status.seed).toBe(0xaa442ce7);
    expect(status.tempoBpm).toBe(125);
    expect(status.root).toBe(2);
    expect(status.scaleIndex).toBe(17);
    expect(status.engines).toEqual([{ index: 0, name: "FM" }]);
  });

  it("sorts engines and replaces rather than duplicating", () => {
    let status = emptyStatus();

    for (const index of [2, 0, 1, 1]) {
      status = applyMessage(status, {
        kind: "trackEngine",
        trackIndex: index,
        unknownA: 0,
        unknownB: 0,
        engineName: index === 1 ? "Z" : `E${index}`,
      });
    }

    expect(status.engines.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(status.engines[1]?.name).toBe("Z");
  });

  it("clears engines on a new seed, keeping globals the device has not contradicted", () => {
    let status = emptyStatus();
    status = applyMessage(status, { kind: "globals", patchMode: 2, tempoBpm: 125, root: 2, scaleIndex: 17 });
    status = applyMessage(status, {
      kind: "trackEngine", trackIndex: 0, unknownA: 0, unknownB: 1, engineName: "FM",
    });
    status = applyMessage(status, { kind: "seed", seed: 0x1234 });

    expect(status.seed).toBe(0x1234);
    expect(status.engines).toEqual([]);
    expect(status.tempoBpm).toBe(125);
  });
});

describe("reading a hardware capture", () => {
  it("pulls the dump out of a Standard MIDI File", () => {
    // A minimal SMF carrying the four captured frames, built here rather than
    // shipped as a binary: the point is the extraction, not the file.
    const track: number[] = [];
    for (const v of vectors.captured.slice(0, 4)) {
      const body = fromHex(v.hex).slice(1); // SMF stores the body after F0
      track.push(0x00, 0xf0, body.length, ...body);
    }
    track.push(0x00, 0xff, 0x2f, 0x00);

    const header = [
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0,
      0x4d, 0x54, 0x72, 0x6b,
      (track.length >> 24) & 0xff, (track.length >> 16) & 0xff,
      (track.length >> 8) & 0xff, track.length & 0xff,
    ];

    const frames = sysexFromSmf(Uint8Array.from([...header, ...track]));
    expect(frames).toHaveLength(4);

    const decoded = frames.map((f) => decodeSysex(f.bytes));
    expect(decoded.every(Boolean)).toBe(true);
    expect(decoded.map((m) => m!.kind)).toEqual(["seed", "dumpBegin", "globals", "trackEngine"]);
  });
});
