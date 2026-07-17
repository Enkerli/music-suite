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

function run(args: string[], killAfterMs: number): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args]);
    let stdout = "", stderr = "";
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString(); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
    const timer = setTimeout(() => child.kill("SIGINT"), killAfterMs);
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
      400,
    );
    expect(r.stderr).not.toMatch(/needs a value/);
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
  }, 5000);

  it("SIGINT during --loop stops gracefully (clean exit, not a signal kill)", async () => {
    const r = await run(
      ["accompany", "--progression", "Dm7", "--seed", "1", "--bpm", "6000", "--play", "--loop"],
      400,
    );
    expect(r.code).toBe(0);
    expect(r.signal).toBeNull();
  }, 5000);

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
