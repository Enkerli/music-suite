/**
 * The bridge audit, as a test — so a half-wired event fails a run instead of
 * waiting to be noticed as a feature that quietly does nothing.
 *
 * Baseline, not zero. There are known drops today (below) and blocking every
 * run on pre-existing debt would just get the test skipped. What this catches
 * is a NEW one, which is the case that actually costs an evening.
 *
 * Skips entirely when the plugin repos are not checked out beside music-suite,
 * which is the normal state of a plain clone. Set $BRIDGE_SIBLINGS to point at
 * wherever they live, or leave it and accept the skip.
 *
 * CI no longer accepts the skip. The `bridge` job in .github/workflows/tests.yml
 * clones all seven (public, Source trees only) into the sibling layout and then
 * asserts that none was reported as skipped — because these three tests PASS
 * while a repo is missing, auditing nothing and looking green. That was the
 * state of this file from the day it was written until 2026-08-05: the guard
 * against half-wired events was itself wired at only one end.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIBLINGS = resolve(HERE, "../..");
const haveSiblings = existsSync(join(SIBLINGS, "rhythm_pattern_explorer"));

/**
 * Known drops as of 2026-07-30, each verified by hand. Recorded rather than
 * fixed because they live in other repos; fixing one means deleting its line.
 *
 *   MIDIcurator  state    Checked 2026-07-30 and it is real, on BOTH halves.
 *                        The C++ has a complete UI-state round trip — an
 *                        `enkerliState` listener calling storeUiState(), and
 *                        emit("state", loadUiState()) to restore — and the UI
 *                        participates in neither: it never sends enkerliState
 *                        and never subscribes to state. It persists through
 *                        localStorage (10 sites) and IndexedDB (lib/db.ts)
 *                        instead, and IndexedDB is documented in this project
 *                        as unreliable under the juce:// scheme, which is
 *                        plausibly why the C++ channel was built. Wiring it is
 *                        not a one-liner: the UI's state is spread across ten
 *                        localStorage call sites with no single object to send,
 *                        so this is a consolidation, not a connection.
 *   ~~runtime~~          RESOLVED 2026-07-30: MIDIcurator and Workspace both
 *                        pushed a RuntimeInfo snapshot every ~2s that nothing
 *                        received and neither UI had anywhere to show. The C++
 *                        half had been copied from the same template as
 *                        Progression Studio, which does subscribe. Alex chose
 *                        to stop emitting rather than build two diagnostics
 *                        panels; RuntimeInfo is untouched if one is ever
 *                        wanted (midicurator-plugin, workspace-plugin).
 */
const KNOWN = {
  MIDIcurator: ["state"],
  // DrawnQurve setDirection — RESOLVED 2026-07-30, and the resolution is the
  // more interesting result. The audit was right that nothing listened; my
  // first reading of what that MEANT was wrong. Direction was never broken:
  // the line after sendDirection() sent the same choice as the
  // `playbackDirection` APVTS parameter, which the C++ handles generically in
  // setParamActual and reads in processBlock. So this was a redundant second
  // channel, not a dead one. Fixed by deleting the emit rather than by adding
  // a C++ listener — two paths for one setting is how they drift apart.
  //
  // Lesson for reading this tool's output: a drop means "nothing receives this
  // NAME". Whether the FEATURE is broken depends on what else carries it. Check
  // before believing, as with any grep-based finding.
};

describe.skipIf(!haveSiblings)("WebView bridge wiring", () => {
  const report = () => {
    let out;
    try {
      out = execFileSync("node", [join(HERE, "bridge-audit.mjs"), "--json"], { encoding: "utf8" });
    } catch (e) {
      out = e.stdout; // exits 1 when drops exist, which is the normal case here
    }
    return JSON.parse(out);
  };

  it("has no bridge event wired at only one end, beyond the known list", () => {
    const { results } = report();
    const unexpected = [];
    for (const r of results) {
      if (r.skipped) continue;
      const known = KNOWN[r.name] ?? [];
      for (const ev of [...r.droppedToJs, ...r.droppedToCpp]) {
        if (!known.includes(ev)) unexpected.push(`${r.name}: ${ev}`);
      }
    }
    // A failure here means an event is emitted at one end and received at
    // neither — it will compile, ship, and do nothing. Wire it, or add it to
    // KNOWN above with a note saying why it is acceptable.
    expect(unexpected).toEqual([]);
  });

  it("still finds the drops we know about, so the audit itself has not gone blind", () => {
    // A tool that silently stops detecting is worse than no tool. If a KNOWN
    // entry disappears, either it was fixed (delete the line) or the audit's
    // patterns stopped matching that repo's style.
    const { results } = report();
    for (const [name, evs] of Object.entries(KNOWN)) {
      const r = results.find((x) => x.name === name);
      if (!r || r.skipped) continue;
      const found = [...r.droppedToJs, ...r.droppedToCpp];
      for (const ev of evs) expect(found, `${name}: ${ev} no longer detected`).toContain(ev);
    }
  });

  it("reads both bridge styles, so no plugin is silently unscanned", () => {
    const { results } = report();
    for (const r of results) {
      if (r.skipped) continue;
      // Zero on either side means the regexes missed this repo's idiom — which
      // is exactly how Vane looked 26-events-broken and MIDIcurator looked to
      // emit nothing at all, before the audit learned their styles.
      expect(r.counts.cppEmits + r.counts.cppListens, `${r.name}: no C++ bridge calls found`).toBeGreaterThan(0);
      expect(r.counts.jsSubs + r.counts.jsEmits, `${r.name}: no JS bridge calls found`).toBeGreaterThan(0);
    }
  });
});
