#!/usr/bin/env node
// A termbase against a translation table: for each term, every string that
// uses it (in the source language), and whether its translation uses the
// term's target forms. Terms come first, most-used first: settle the ones
// that keep coming back, and the strings follow.
//
//   node tools/i18n/concord.mjs <terms.tbx> <table.json> [--from en] [--to fr] [--json]
//
// table.json: { "source string": "translation" } (Twirl's apps/twirl/i18n/fr.json).
// Without --json: a summary, a line a term (strings using it, translations off).
import { readFileSync } from "node:fs";
import { readTbx, termIn } from "./tbx.mjs";

/** A term's forms as a regex for running text: whole words, any letters (é…), any
 *  case unless the pattern starts "(?c)" (a name, as "Time", not every "time"). */
export function formsRe(src) {
  const cased = src.startsWith("(?c)");
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${cased ? src.slice(4) : src})(?![\\p{L}\\p{N}])`, cased ? "gu" : "giu");
}
/** Words only: no markup, no placeholders, but a plural's choices kept ({n|one|many}). */
const plain = (s) => s.replace(/<[^>]+>/g, " ").replace(/\{[^{}|]*\|([^{}]*)\}/g, (_, c) => ` ${c.replace(/\|/g, " ")} `)
  .replace(/\{[^}]*\}/g, " ").replace(/&nbsp;|&#160;/g, " ");

/** @returns {{ id, term, target, entry, hits: { source, target, ok }[] }[]} */
export function concord(entries, table, { from = "en", to = "fr" } = {}) {
  const rows = Object.entries(table);
  return entries.map((entry) => {
    const re = formsRe(entry.match?.[from] || escapeRe(termIn(entry, from)));
    const tre = formsRe(entry.match?.[to] || escapeRe(termIn(entry, to) || "\u0000"));
    const hits = [];
    for (const [source, target] of rows) {
      re.lastIndex = 0;
      if (!re.test(plain(source))) continue;
      tre.lastIndex = 0;
      hits.push({ source, target, ok: tre.test(plain(String(target))) });
    }
    return { id: entry.id, term: termIn(entry, from), target: termIn(entry, to), entry, hits };
  }).sort((a, b) => b.hits.length - a.hits.length);
}
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (import.meta.url === `file://${process.argv[1]}`) {
  const [tbx, tablePath] = process.argv.slice(2, 4);
  const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const res = concord(readTbx(readFileSync(tbx, "utf8")), JSON.parse(readFileSync(tablePath, "utf8")), { from: opt("from", "en"), to: opt("to", "fr") });
  if (process.argv.includes("--json")) console.log(JSON.stringify(res.map(({ entry, ...r }) => r), null, 1));
  else for (const r of res) {
    const off = r.hits.filter((h) => !h.ok).length;
    console.log(`${String(r.hits.length).padStart(4)}  ${off ? String(off).padStart(3) + " off" : "      "}  ${r.term} → ${r.target}`);
  }
}
