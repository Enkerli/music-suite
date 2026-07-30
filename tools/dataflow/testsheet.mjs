#!/usr/bin/env node
/**
 * User-testing sheet, generated from an app's dataflow contract.
 *
 * See docs/DATAFLOW_AUDIT.md. Deliberately NOT a protocol — those get abandoned
 * halfway, or worse, completed carelessly. This is a short flexible sheet with
 * expectations written down BEFORE anyone tests, which is the only part that
 * makes "observed" worth reading.
 *
 * Why generated: the expectation and the code come from one source, so a sheet
 * cannot quietly describe last month's behaviour. And a channel that is
 * userVisible without an `expect` fails schema validation, so the sheet cannot
 * silently omit a user-facing flow.
 *
 * Usage:
 *   node tools/dataflow/testsheet.mjs apps/serpe/dataflow.json [--out <file.md>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseContract } from "./schema.mjs";

const PREAMBLE = `
**How to use this.** Work down the list, skip anything that does not apply, and
stop whenever you have had enough — a partly filled sheet is genuinely useful and
a rushed complete one is not.

Write in *Observed* whatever you actually saw, in your own words. "Weird flicker
bottom left" is a better bug report than a tick in a box: two of the bugs found on
2026-07-29 were located by exactly that kind of description — "brief glimpses of
the other scenes" pointed at a race, and "it stuck to the first scene" pointed at
the display reading from the wrong source. Neither would have survived a
pass/fail checkbox.

If *Expected* itself looks wrong to you, say so in *Notes*. The expectation is a
claim about how this should behave, and it can be the thing that is mistaken.

There is a small build tag in the bottom-right corner of every plugin window.
Please copy it into *Build* below — a report against an unknown build costs more
time than it saves.
`.trim();

export function makeSheet(contract, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const rows = contract.channels.filter((c) => c.userVisible && c.expect);
  const L = [];

  L.push(`# ${contract.app} — things to try`, "");
  L.push(`Generated ${date} from \`apps/${contract.app}/dataflow.json\`. ${rows.length} things to try.`, "");
  L.push(`Build: ______________________    Tester: ______________    Date: __________`, "");
  L.push(PREAMBLE, "");
  L.push("| # | Try this | Expected | Observed | Notes |");
  L.push("|---|---|---|---|---|");

  rows.forEach((c, i) => {
    // No channel id in tester-facing text: nobody outside the codebase should
    // need to know what a "polyState" is to report that a lane looks frozen.
    L.push(`| ${i + 1} | ${c.try} | ${c.expect} | | |`);
  });

  L.push("", "## Anything else", "");
  L.push("Room for whatever the list did not ask about — surprises here are usually the most valuable part.", "");
  L.push("| What you did | What happened |", "|---|---|", "| | |", "| | |", "| | |", "");
  return L.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) { console.error("usage: testsheet.mjs <dataflow.json> [--out <file.md>]"); process.exit(2); }
  const sheet = makeSheet(parseContract(readFileSync(path, "utf8"), path));
  const i = process.argv.indexOf("--out");
  if (i > 0 && process.argv[i + 1]) { writeFileSync(process.argv[i + 1], sheet); console.error(`wrote ${process.argv[i + 1]}`); }
  else console.log(sheet);
}
