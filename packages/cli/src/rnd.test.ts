import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runRndPure, scanCapture, describeStatus } from "./rnd.js";
import { encodeSeed, fromHex, toHex } from "@enkerli/rnd";

const flags = (...names: string[]) => new Set(names);

/** A one-track SMF carrying the given complete SysEx frames. */
function smfWith(frames: number[][]): Uint8Array {
  const track: number[] = [];
  for (const f of frames) {
    const body = f[0] === 0xf0 ? f.slice(1) : f;
    track.push(0x00, 0xf0, body.length, ...body);
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  return Uint8Array.from([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >> 24) & 0xff, (track.length >> 16) & 0xff,
    (track.length >> 8) & 0xff, track.length & 0xff,
    ...track,
  ]);
}

describe("msuite rnd — pure subcommands", () => {
  it("builds a seed frame", () => {
    expect(runRndPure("seed", ["0xaa442ce7"], flags())).toEqual({
      lines: ["F0 6F 62 78 10 67 59 10 52 0A F7"], code: 0,
    });
  });

  it("builds the status request", () => {
    expect(runRndPure("read", [], flags())?.lines).toEqual(["F0 6F 62 78 11 00 F7"]);
  });

  it("rejects a value that is not a seed, with a non-zero code", () => {
    const r = runRndPure("seed", ["nope"], flags());
    expect(r?.code).toBe(1);
  });

  it("decodes, and says whose frame it is when it is not ours", () => {
    expect(runRndPure("decode", ["F0 6F 62 78 21 02 7D 00 02 11 F7"], flags())).toEqual({
      lines: ["globals: mode 2, 125 BPM, root D, prometheus"], code: 0,
    });

    const foreign = runRndPure("decode", ["F0 7E 7F 08 01 F7"], flags());
    expect(foreign?.code).toBe(1);
    expect(foreign?.lines[0]).toContain("universal non-real-time");

    // Our tag but broken is a different answer from somebody else's frame.
    const damaged = runRndPure("decode", ["F0 6F 62 78 10 67 F7"], flags());
    expect(damaged?.code).toBe(1);
    expect(damaged?.lines[0]).toContain("does not parse");
  });

  it("returns null for a subcommand it does not own", () => {
    expect(runRndPure("watch", [], flags())).toBeNull();
    expect(runRndPure("send", [], flags())).toBeNull();
  });
});

describe("msuite rnd scan", () => {
  const capture = smfWith([
    fromHex("F0 6F 62 78 10 67 59 10 52 0A F7"),
    fromHex("F0 6F 62 78 20 F7"),
    fromHex("F0 6F 62 78 21 02 7D 00 02 11 F7"),
    fromHex("F0 6F 62 78 22 00 00 01 46 4D 00 F7"),
    fromHex("F0 7F 00 04 03 00 40 F7"),
  ]);

  it("decodes every frame and folds the dump into a status", () => {
    const { rows, status } = scanCapture(capture);

    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.note)).toEqual([
      "seed 0xaa442ce7",
      "dump begin",
      "globals: mode 2, 125 BPM, root D, prometheus",
      'track 0 engine "FM" (0, 1)',
      "universal real-time SysEx",
    ]);

    expect(status.seed).toBe(0xaa442ce7);
    expect(status.engines).toEqual([{ index: 0, name: "FM" }]);
  });

  it("labels the root as a sample, since the device's root moves", () => {
    const { status } = scanCapture(capture);
    expect(describeStatus(status).join("\n")).toContain("root      D (when captured)");
  });

  it("reads a file from disk through the command surface", () => {
    const dir = mkdtempSync(join(tmpdir(), "rnd-scan-"));
    const path = join(dir, "capture.mid");
    writeFileSync(path, capture);

    const r = runRndPure("scan", [path], flags());
    expect(r?.code).toBe(0);
    expect(r?.lines.join("\n")).toContain("seed 0xaa442ce7");

    const asJson = runRndPure("scan", [path], flags("json"));
    const parsed = JSON.parse(asJson!.lines[0]!);
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.status.seed).toBe(0xaa442ce7);
  });

  it("says so rather than throwing when there is no SysEx", () => {
    const r = runRndPure("scan", [], flags());
    expect(r?.code).toBe(1);
  });
});

describe("round trip", () => {
  it("a seed built by the CLI scans back out of a capture as the same seed", () => {
    for (const seed of [0, 1, 0xaa442ce7, 0x0fedcba9, 0xffffffff]) {
      const { status } = scanCapture(smfWith([encodeSeed(seed)]));
      expect(status.seed, toHex(encodeSeed(seed))).toBe(seed);
    }
  });
});
