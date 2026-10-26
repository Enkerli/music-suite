// Twirl's Surge XT patches (apps/twirl/surge/): well-formed .fxp files, and
// exactly what make_patches.py writes from fitted.json (so nobody edits a
// patch by hand, and a change to the generator comes with its patches).
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const PATCHES = join(HERE, "patches");
const names = readdirSync(PATCHES).filter((f) => f.endsWith(".fxp")).sort();

describe("Twirl · Surge XT patches", () => {
  it("has one for each of Paper's voices and drums", () => {
    expect(names).toEqual(["Bell", "Blip", "Hat", "Kick", "Pluck", "Shaker", "Snare"].map((n) => `Twirl Paper ${n}.fxp`));
  });

  it.each(names)("%s is a Surge patch: FXP header, Surge's chunk, its XML", (name) => {
    const b = readFileSync(join(PATCHES, name));
    expect(b.toString("latin1", 0, 4)).toBe("CcnK");
    expect(b.toString("latin1", 8, 12)).toBe("FPCh");
    expect(b.toString("latin1", 16, 20)).toBe("cjs3");
    expect(b.readInt32BE(56)).toBe(b.length - 60);                    // the chunk's size
    expect(b.toString("latin1", 60, 64)).toBe("sub3");
    const xmlLen = b.readUInt32LE(64);
    for (let i = 0; i < 6; i++) expect(b.readUInt32LE(68 + 4 * i)).toBe(0);   // no wavetables
    expect(92 + xmlLen).toBe(b.length);
    const xml = b.toString("utf8", 92);
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml).toContain(`<meta name="${name.replace(".fxp", "")}" category="Twirl"`);
    expect(xml.trimEnd().endsWith("</patch>")).toBe(true);
    // the envelopes analog and one-shot: straight lines in dB, no sustain
    expect(xml).toMatch(/<a_env1_mode type="0" value="1" \/>/);
    expect(xml).toMatch(/<a_env1_sustain type="2" value="0\.0+" \/>/);
  });

  it("are exactly what make_patches.py writes", () => {
    let python = null;
    for (const p of ["python3", "python"]) { try { execFileSync(p, ["--version"]); python = p; break; } catch (_) { /* next */ } }
    if (!python) { if (process.env.CI) throw new Error("no Python"); return; }
    const out = mkdtempSync(join(tmpdir(), "twirl-surge-"));
    execFileSync(python, [join(HERE, "make_patches.py"), out]);
    for (const n of names) expect(readFileSync(join(out, n)).equals(readFileSync(join(PATCHES, n))), n).toBe(true);
  });
});
