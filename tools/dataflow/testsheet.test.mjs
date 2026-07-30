/**
 * The generated sheet has to be usable by someone who has never seen the code.
 * These tests pin the properties that make that true, because they are easy to
 * regress by "tidying" the generator.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeSheet } from "./testsheet.mjs";
import { parseContract } from "./schema.mjs";

const SUITE = join(dirname(fileURLToPath(import.meta.url)), "../..");
const serpe = parseContract(readFileSync(join(SUITE, "apps/serpe/dataflow.json"), "utf8"));
const sheet = makeSheet(serpe, { date: "2026-07-30" });

describe("test sheet", () => {
  it("lists every user-visible channel and no internal ones", () => {
    const visible = serpe.channels.filter((c) => c.userVisible);
    for (const c of visible) expect(sheet).toContain(c.try);
    // within-binary channels have no business on a tester's sheet
    for (const c of serpe.channels.filter((c) => !c.userVisible))
      expect(sheet).not.toContain(c.expect);
  });

  it("never shows a channel id to the tester", () => {
    // "polyState" means nothing to someone reporting that a lane looks frozen.
    const table = sheet.slice(sheet.indexOf("| # |"), sheet.indexOf("## Anything else"));
    for (const c of serpe.channels) expect(table).not.toContain(c.id);
  });

  it("asks for the build tag, so a report is attributable", () => {
    expect(sheet).toMatch(/build tag/i);
    expect(sheet).toContain("Build: ");
  });

  it("gives permission to stop early and to disagree with Expected", () => {
    expect(sheet).toMatch(/skip anything/i);
    expect(sheet).toMatch(/stop whenever/i);
    expect(sheet).toMatch(/Expected\* itself looks wrong|Expected itself looks wrong/);
  });

  it("leaves room for what the list did not ask about", () => {
    expect(sheet).toContain("## Anything else");
  });

  it("carries the cases that have broken before", () => {
    // The poly chain and the transform pair are the two that cost the most time.
    expect(sheet).toContain("E(3,8)|E(3,8)*3/E(3,7)");
    expect(sheet).toContain("E(7,16)>16/E(1,17)>17");
    expect(sheet).toMatch(/MIDI notes instead of Enter/);
  });
});
