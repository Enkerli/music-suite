#!/usr/bin/env node
/**
 * Doc audit — check the claims in the docs that a machine can check.
 *
 * Written after four errors turned up in one file in ten minutes, by checking
 * rather than reading: BUILD.md said six webapps (eleven), six plugin repos
 * (seven), and "all six vendor enkerli-juce" twenty lines above its own
 * statement that two of them don't.
 *
 * WHAT IT CHECKS — only things with a definite answer:
 *
 *   link      a relative markdown link or backticked path that does not exist
 *   command   an `msuite <cmd>` the CLI does not implement
 *   flag      a `suite-build --flag` the script does not accept
 *   count     a spelled-out count next to a list whose length disagrees
 *
 * WHAT IT DOES NOT CHECK. Whether prose is TRUE. "The engine is authoritative"
 * is a claim about behaviour that only a trace or a test can settle, and
 * pretending otherwise is how a doc audit becomes theatre. This finds rot, not
 * lies.
 *
 * Usage: node tools/doc-audit.mjs [--json]
 * Exit:  0 always — this is a report, not a gate. Docs rot faster than they can
 *        be fixed, and a failing build over a stale link gets the check deleted.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Sibling plugin checkouts. Build docs quote paths as seen from inside one of
 * these (`cmake/write-build-tag.cmake`), which is right there and unresolvable
 * from the monorepo — 100+ phantom findings on the first run.
 */
const SIBLINGS = (() => {
  const parent = resolve(SUITE, "..");
  if (!existsSync(parent)) return [];
  return readdirSync(parent)
    .map((e) => join(parent, e))
    .filter((p) => { try { return statSync(p).isDirectory() && existsSync(join(p, "CMakeLists.txt")); } catch { return false; } });
})();

/** Absent by design: generated, gitignored, produced by a run, or a template. */
const IGNORED = [
  /apps\.local\.json$/, /^scratch\//, /\bdist\//, /\bbuild\//,
  /webui\/bundle\.js$/, /\.local\.(ts|jsx?)$/,
  // Filename templates, not files: `testing-results/YYYY-MM-DD-session-name.md`.
  /YYYY|MM-DD|<[\w-]+>|\{[\w-]+\}|\bNAME\b/,
];

/** Nearest ancestor that looks like an app or package root. */
function ownerRoot(dir) {
  let d = dir;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(d, "package.json"))) return d;
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    if (["node_modules", "dist", "build", "scratch", ".git"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
};

/** Words we spell out, so "six webapps (a, b, c)" can be checked. */
const NUMBERS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

function knownMsuiteCommands() {
  // The CLI's own dispatch is the authority — a hardcoded list here would rot
  // exactly like the docs this tool is auditing.
  const src = join(SUITE, "packages/cli/src/cli.ts");
  if (!existsSync(src)) return null;
  const text = readFileSync(src, "utf8");
  const cmds = new Set();
  for (const m of text.matchAll(/^\s*case\s+"([a-z][\w-]*)":/gm)) cmds.add(m[1]);
  return cmds.size ? cmds : null;
}

function knownSuiteBuildFlags() {
  for (const rel of ["../enkerli-juce/tools/suite-build", "../../enkerli-juce/tools/suite-build"]) {
    const p = resolve(SUITE, rel);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    const flags = new Set();
    for (const m of text.matchAll(/--([a-z][a-z-]*)\)/g)) flags.add(m[1]);
    for (const m of text.matchAll(/"--([a-z][a-z-]*)"/g)) flags.add(m[1]);
    // -h|--help) and friends: alternation in a case pattern.
    for (const m of text.matchAll(/-[a-z]\|--([a-z][a-z-]*)/g)) flags.add(m[1]);
    flags.add("help");   // every script here answers it, however it is spelled
    if (flags.size) return flags;
  }
  return null;
}

export function auditDocs() {
  const files = walk(SUITE).sort();
  const findings = [];
  const add = (kind, file, line, detail) =>
    findings.push({ kind, file: relative(SUITE, file), line, detail });

  const msuite = knownMsuiteCommands();
  const sbFlags = knownSuiteBuildFlags();

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    const dir = dirname(file);
    let fenced = false;

    lines.forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      const n = i + 1;

      // ── relative markdown links to files in-repo
      for (const m of line.matchAll(/\[[^\]]*\]\((?!https?:|#|mailto:)([^)\s#]+)/g)) {
        const ref = m[1];
        // `doc.html?p=user-guide` is a site route, not a file on disk.
        if (ref.includes("?")) continue;
        if (!existsSync(resolve(dir, ref))) add("link", file, n, `link target missing: ${ref}`);
      }

      // ── backticked paths that look like repo files (have a slash and an ext)
      // A doc that RECORDS history correctly names files that no longer exist:
      // CODE_CENSUS lists the 6,256 lines it had deleted, and flagging those as
      // rot would punish the doc for being accurate. Skip lines that are
      // explicitly talking about something in the past.
      const historical = /~~|\b(deleted|removed|no longer|used to|was|were|until|formerly|gone)\b/i.test(line);
      if (!fenced && !historical) for (const m of line.matchAll(/`([\w./-]+\.(?:md|mjs|js|jsx|ts|tsx|json|cmake|sh|cpp|h))`/g)) {
        const ref = m[1];
        if (ref.startsWith("http") || !ref.includes("/")) continue;
        // System headers are not repo files. <gtk/gtk.h> et al.
        if (/^(gtk|glib|webkit\d*|jsc|libsoup|juce_[\w]+)\//.test(ref)) continue;
        // Generated or gitignored by design — absent is correct, not rot.
        if (IGNORED.some((rx) => rx.test(ref))) continue;
        // Resolve against the monorepo, the doc's own dir, AND each sibling
        // plugin repo: most build docs quote paths as seen from a plugin repo
        // (`cmake/write-build-tag.cmake`, `WebUI/build.mjs`), which is correct
        // there and meaningless here.
        // ...and against the app that owns the doc: MIDIcurator's design notes
        // say `src/lib/spelling.ts`, meaning apps/MIDIcurator/src/lib/spelling.ts.
        // That was ~90 of the first run's findings.
        // A leading slash in these docs means "from the app root", not the
        // filesystem root — `/src/components/ChordBar.tsx`.
        const rel = ref.replace(/^\/+/, "");
        const owner = ownerRoot(dir);
        const hit = existsSync(resolve(SUITE, rel)) || existsSync(resolve(dir, rel))
          || (owner && existsSync(resolve(owner, rel)))
          || SIBLINGS.some((sib) => existsSync(resolve(sib, rel)));
        if (!hit) add("path", file, n, `no such file: ${ref}`);
      }

      if (fenced) return;   // commands inside fences are examples, checked below

      // ── msuite commands
      if (msuite) {
        for (const m of line.matchAll(/`msuite ([a-z][\w-]*)/g)) {
          const cmd = m[1];
          if (!msuite.has(cmd) && !["--version", "help"].includes(cmd))
            add("command", file, n, `msuite has no "${cmd}" command`);
        }
      }

      // ── suite-build flags
      if (sbFlags) {
        for (const m of line.matchAll(/suite-build[^`\n]*?--([a-z][a-z-]+)/g)) {
          if (!sbFlags.has(m[1])) add("flag", file, n, `suite-build has no --${m[1]} flag`);
        }
      }

      // ── spelled-out counts next to a parenthesised or dashed list
      const cm = line.match(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b\s+([A-Za-z][\w-]*(?:\s+\w+)?)\s*[(—-]\s*([^)]{10,})/i);
      if (cm) {
        const want = NUMBERS[cm[1].toLowerCase()];
        const items = cm[3].split(/,| and /).map((x) => x.trim()).filter((x) => x.length > 1);
        // Only flag a clear disagreement on a list that really looks enumerated.
        if (items.length >= 3 && Math.abs(items.length - want) >= 1 && items.length <= 20)
          add("count", file, n, `says "${cm[1]} ${cm[2].trim()}" but the list beside it has ${items.length}`);
      }
    });
  }
  return { files: files.length, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = auditDocs();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

  console.log(`Doc audit — ${r.files} markdown files\n`);
  const byKind = {};
  for (const f of r.findings) (byKind[f.kind] ??= []).push(f);
  const blurb = {
    link: "Markdown links whose target does not exist.",
    path: "Backticked file paths that do not resolve.",
    command: "CLI commands the docs describe and the CLI does not have.",
    flag: "suite-build flags the script does not accept.",
    count: "A spelled-out count that disagrees with the list next to it.",
  };
  for (const kind of ["link", "path", "command", "flag", "count"]) {
    const fs = byKind[kind];
    if (!fs?.length) continue;
    console.log(`## ${kind} (${fs.length})\n\n${blurb[kind]}\n`);
    for (const f of fs) console.log(`  ${f.file}:${f.line}  ${f.detail}`);
    console.log("");
  }
  console.log(r.findings.length
    ? `${r.findings.length} checkable claim(s) are wrong. Prose is NOT checked here — this finds rot, not lies.`
    : "No checkable claim is wrong. (Prose is not checked — this finds rot, not lies.)");
}
