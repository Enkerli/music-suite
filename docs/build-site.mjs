#!/usr/bin/env node
/**
 * build-site — regenerate the site from the single source file `docs/site.md`.
 *
 * Reads docs/site.md (the one place all site copy lives) and writes:
 *   - docs/index.html            (the frontpage: hero, app cards, docs, note)
 *   - docs/content/<slug>.md      (each documentation page body)
 *
 * The HTML *structure* lives here in the template; the *words* live in
 * site.md. Edit prose there, run `npm run build-site`, commit docs/.
 *
 * site.md is a sequence of blocks, each introduced by an HTML-comment marker
 * `<!-- kind [id] [key=value …] -->`. Everything until the next marker is that
 * block's body (plain Markdown). Markers: meta, nav, hero, apps, card, docs,
 * doclink, note, footer, page.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "site.md");

const KINDS = "meta|nav|hero|apps|card|docs|doclink|note|footer|page";
const MARKER = new RegExp(`^<!--\\s+(${KINDS})\\b([^>]*?)-->\\s*$`);

// ── Parse site.md into a flat list of blocks ──
function parse(text) {
  const blocks = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const m = line.match(MARKER);
    if (m) {
      cur = { kind: m[1], attrs: parseAttrs(m[2]), body: [] };
      blocks.push(cur);
    } else if (cur) {
      cur.body.push(line);
    }
  }
  for (const b of blocks) b.text = b.body.join("\n").trim();
  return blocks;
}

// "the-story link=apps/x/ app=exquisite" → { id, link, app }
function parseAttrs(spec) {
  const out = {};
  for (const tok of spec.trim().split(/\s+/).filter(Boolean)) {
    const eq = tok.indexOf("=");
    if (eq === -1) out.id = tok;
    else out[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  return out;
}

// ── Tiny inline Markdown → HTML (escape, then code / link / bold / italic) ──
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// first non-empty line + the rest, for "heading / sub" style blocks
function headSub(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return { head: lines[0] ?? "", sub: lines.slice(1).join(" ") };
}

function parseKeyed(text) {
  const o = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) (o[m[1]] ??= []).push(m[2]);
  }
  return o; // values are arrays (a key may repeat, e.g. link / cta)
}

// ── Build ──
const blocks = parse(readFileSync(SRC, "utf8"));
const first = (k) => blocks.find((b) => b.kind === k);
const all = (k) => blocks.filter((b) => b.kind === k);

const meta = (() => { const k = parseKeyed(first("meta").text); return { title: k.title[0], description: k.description[0] }; })();

const nav = (() => {
  const k = parseKeyed(first("nav").text);
  const links = (k.link ?? []).map((s) => { const [label, href] = s.split("->").map((x) => x.trim()); return { label, href }; });
  return { brand: k.brand[0], links };
})();

const hero = (() => {
  const b = first("hero");
  const k = parseKeyed(b.text);
  const ctas = (k.cta ?? []).map((s) => {
    const primary = /\bprimary\s*$/.test(s);
    const m = s.replace(/\s*primary\s*$/, "").match(/\[([^\]]+)\]\(([^)]+)\)/);
    return { label: m[1], href: m[2], primary };
  });
  // lede = the prose lines (everything that isn't a known key:)
  const lede = b.text.split("\n").filter((l) => l.trim() && !/^(eyebrow|heading|cta):/.test(l)).join(" ");
  return { eyebrow: k.eyebrow[0], heading: k.heading[0], ctas, lede };
})();

const apps = headSub(first("apps").text);
const docs = headSub(first("docs").text);

const cards = all("card").map((b) => {
  const lines = b.text.split("\n").filter((l) => l.trim() !== "");
  return { id: b.attrs.id, app: b.attrs.app ?? b.attrs.id, link: b.attrs.link, docs: b.attrs.docs, name: lines[0], blurb: lines.slice(1).join(" ") };
});

const doclinks = all("doclink").map((b) => {
  const lines = b.text.split("\n").filter((l) => l.trim() !== "");
  return { page: b.attrs.page ?? b.attrs.id, label: lines[0], blurb: lines.slice(1).join(" ") };
});

const note = first("note").text;
const footer = first("footer").text;
const pages = all("page").map((b) => ({ slug: b.attrs.id, body: b.text }));

// ── Render index.html ──
const cardHtml = (c) => {
  const docsChip = c.docs ? `<a class="chip" href="doc.html?p=${c.docs}">Docs</a>` : "";
  return `    <article class="card">
      <div class="shot"><img src="assets/screenshots/${c.id}.png" alt="${esc(c.name)}" onload="this.classList.add('ok')"><span class="ph">screenshot → assets/screenshots/${c.id}.png</span></div>
      <div class="card-body">
        <div class="card-head"><img src="assets/icons/${c.id}.svg" alt=""><h3>${esc(c.name)}</h3></div>
        <p>${inline(c.blurb)}</p>
        <div class="card-links"><a class="chip open" data-app="${c.app}" href="${c.link}">Open app ↗</a>${docsChip}</div>
      </div>
    </article>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="stylesheet" href="style.css">
<!-- GENERATED FROM site.md — do not edit this file directly.
     Edit docs/site.md and run \`npm run build-site\`. -->
</head>
<body>

<div class="topbar"><div class="wrap">
  <a class="brand" href="index.html">${esc(nav.brand).replace(/ /g, "&nbsp;")}</a>
  <nav class="topnav">
${nav.links.map((l) => `    <a href="${l.href}">${esc(l.label)}</a>`).join("\n")}
  </nav>
</div></div>

<header class="hero"><div class="wrap">
  <p class="eyebrow">${esc(hero.eyebrow)}</p>
  <h1>${inline(hero.heading)}</h1>
  <p class="lede">${inline(hero.lede)}</p>
  <div class="cta">
${hero.ctas.map((c) => `    <a class="btn${c.primary ? " primary" : ""}" href="${c.href}">${esc(c.label)}</a>`).join("\n")}
  </div>
</div></header>

<main>

<section id="apps"><div class="wrap">
  <h2>${esc(apps.head)}</h2>
  <p class="sub">${inline(apps.sub)}</p>
  <div class="apps">

${cards.map(cardHtml).join("\n\n")}

  </div>
</div></section>

<section><div class="wrap">
  <h2>${esc(docs.head)}</h2>
  <p class="sub">${inline(docs.sub)}</p>
  <div class="docs">
${doclinks.map((d) => `    <a class="doc" href="doc.html?p=${d.page}"><b>${esc(d.label)}</b><span>${esc(d.blurb)}</span></a>`).join("\n")}
  </div>
</div></section>

<section><div class="wrap">
  <p class="note">${inline(note)}</p>
</div></section>

</main>

<footer><div class="wrap">
  ${inline(footer)}
</div></footer>

</body>
</html>
`;

writeFileSync(join(HERE, "index.html"), html);
console.log("✓ docs/index.html");
for (const p of pages) {
  writeFileSync(join(HERE, "content", `${p.slug}.md`), p.body.trim() + "\n");
  console.log(`✓ docs/content/${p.slug}.md`);
}
console.log(`\nDone — ${cards.length} cards, ${pages.length} doc pages. Commit docs/ to publish.`);
