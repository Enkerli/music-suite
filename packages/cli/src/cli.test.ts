/**
 * Subprocess tests for cli.ts's own argv parsing — the level a shipped bug
 * actually lived at: `--loop` was never registered in the boolean-flag list,
 * so it swallowed the next token as its "value", and errored outright when
 * it was the last flag before a pipe (exactly how `accompany --play --loop`
 * is written in every doc example). A unit test on a library function
 * wouldn't reproduce this — it's specifically an argv-parsing bug, so this
 * spawns the real built binary the way a user's shell does.
 */
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(
  args: string[],
  killAfterMs: number,
  { killOnFirstOutput = false } = {},
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args]);
    let stdout = "", stderr = "";
    // A fixed pre-kill delay is a hardware assumption: on a slow machine
    // (Linux miniPC, 2026-07-19) 400 ms wasn't enough for the CLI to emit a
    // line OR register its SIGINT handler, so both --loop tests flaked.
    // killOnFirstOutput waits for the first stdout chunk — by then the loop
    // is provably running — then sends SIGINT shortly after; killAfterMs
    // becomes the outer safety net.
    let killed = false;
    const kill = () => { if (!killed) { killed = true; child.kill("SIGINT"); } };
    const timer = setTimeout(kill, killAfterMs);
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
      if (killOnFirstOutput) setTimeout(kill, 60);
    });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
  });
}

describe("cli argv parsing (subprocess — the real user-facing path)", () => {
  it("--loop as a bare trailing flag doesn't swallow the next token or error", async () => {
    // Regression: --loop was missing from the boolean-flag list, so the
    // parser tried to consume argv[++i] as its value; with nothing after it
    // (the exact shape of every documented example), that threw "--loop
    // needs a value" before a single note was ever written.
    const r = await run(
      ["accompany", "--progression", "Dm7", "--seed", "1", "--bpm", "6000", "--play", "--loop"],
      8000,
      { killOnFirstOutput: true },
    );
    expect(r.stderr).not.toMatch(/needs a value/);
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  }, 20000);

  it("SIGINT during --loop stops gracefully (clean exit, not a signal kill)", async () => {
    const r = await run(
      ["accompany", "--progression", "Dm7", "--seed", "1", "--bpm", "6000", "--play", "--loop"],
      8000,
      { killOnFirstOutput: true },
    );
    expect(r.code).toBe(0);
    expect(r.signal).toBeNull();
  }, 20000);

  it("every flag actually checked with .flags.has(...) is registered as boolean", async () => {
    // A flag read with .has() but not in the boolean list silently becomes
    // value-swallowing (this bug's exact shape) instead of a hard parse
    // error, so it can't be caught by TypeScript — only by exercising argv.
    // Cheap generalization: every one of them, alone with nothing after it,
    // must not produce "needs a value".
    const flags = ["help", "notes", "stream", "validate", "explain", "play", "bars-only", "loop"];
    for (const f of flags) {
      const r = await run(["accompany", `--${f}`], 200);
      expect(r.stderr, f).not.toMatch(/needs a value/);
    }
  }, 15000);
});

describe("--midi-out (subprocess, captured to a file)", () => {
  it("accompany --play --midi-out writes a real MIDI byte stream, breath first, silence last", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readFileSync } = await import("node:fs");
    const out = join(mkdtempSync(join(tmpdir(), "midiout-e2e-")), "cap.raw");
    const r = await run(
      ["accompany", "--progression", "Dm7", "--seed", "1", "--bpm", "2000", "--play", "--midi-out", out],
      5000,
    );
    expect(r.code).toBe(0);
    const bytes = readFileSync(out);
    expect(bytes.length).toBeGreaterThan(0);
    // Breath (CC2) precedes the first note-on — Vane's wind-model contract.
    expect([bytes[0], bytes[1]]).toEqual([0xb0, 0x02]);
    expect(bytes[3]! & 0xf0).toBe(0x90);
    // The stream ends silent: CC123 All Notes Off is the final message.
    expect([...bytes.slice(-3)].map((b) => b & 0xff)).toEqual([0xb0, 123, 0]);
    // Every note-on has a matching note-off (no hanging notes on the synth).
    let on = 0, off = 0;
    for (let i = 0; i < bytes.length; i += 3) {
      const s = bytes[i]! & 0xf0;
      if (s === 0x90 && bytes[i + 2]! > 0) on++;
      if (s === 0x80) off++;
    }
    expect(on).toBeGreaterThan(0);
    expect(off).toBe(on);
  }, 10000);
});
