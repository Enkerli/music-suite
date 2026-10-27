// A termbase as TBX-Basic (ISO 30042, the 2008 "martif" form: what Weblate,
// OmegaT and the Translate Toolkit read), and back. One entry a concept:
//
//   { id, subject, definition, note,
//     terms: { en: [{ term, status, note }], fr: [...] },
//     match: { en: "regex", fr: "regex" } }
//
// status is TBX-Basic's administrativeStatus without its suffix: "preferred"
// (the term to use), "admitted" (an acceptable other), "deprecated" (not to
// use). The first preferred term of a language is the one to use. `match`
// (the forms to find a term by in running text, for the concordance: regex
// sources, any case unless one starts "(?c)") has no
// TBX-Basic home: it rides in a note starting "match:", so the file stays
// valid TBX-Basic and other tools just show it. Only what this module writes
// is read back: it is not a general TBX parser.

const STATUSES = ["preferred", "admitted", "deprecated"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** @param {object[]} entries @param {{ title: string, lang?: string }} o */
export function writeTbx(entries, { title, lang = "en" }) {
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE martif SYSTEM "TBXBasiccoreStructV02.dtd">',
    `<martif type="TBX-Basic" xml:lang="${lang}">`,
    "  <martifHeader>",
    `    <fileDesc><sourceDesc><p>${esc(title)}</p></sourceDesc></fileDesc>`,
    '    <encodingDesc><p type="XCSURI">TBXBasicXCSV02.xcs</p></encodingDesc>',
    "  </martifHeader>",
    "  <text>",
    "    <body>",
  ];
  for (const e of entries) {
    out.push(`      <termEntry id="${esc(e.id)}">`);
    if (e.subject) out.push(`        <descrip type="subjectField">${esc(e.subject)}</descrip>`);
    if (e.note) out.push(`        <note>${esc(e.note)}</note>`);
    for (const [l, re] of Object.entries(e.match || {})) out.push(`        <note>match:${l}:${esc(re)}</note>`);
    for (const [l, terms] of Object.entries(e.terms)) {
      out.push(`        <langSet xml:lang="${esc(l)}">`);
      if (l === lang && e.definition) out.push(`          <descrip type="definition">${esc(e.definition)}</descrip>`);
      for (const t of terms) {
        out.push(`          <tig>`, `            <term>${esc(t.term)}</term>`);
        if (t.status) out.push(`            <termNote type="administrativeStatus">${t.status}Term-admn-sts</termNote>`);
        if (t.note) out.push(`            <note>${esc(t.note)}</note>`);
        out.push(`          </tig>`);
      }
      out.push("        </langSet>");
    }
    out.push("      </termEntry>");
  }
  out.push("    </body>", "  </text>", "</martif>", "");
  return out.join("\n");
}

/** @param {string} xml @returns {object[]} */
export function readTbx(xml) {
  const entries = [];
  for (const m of xml.matchAll(/<termEntry id="([^"]*)">([\s\S]*?)<\/termEntry>/g)) {
    const body = m[2], e = { id: unesc(m[1]), terms: {}, match: {} };
    const own = body.replace(/<langSet[\s\S]*?<\/langSet>/g, "");
    const subject = /<descrip type="subjectField">([\s\S]*?)<\/descrip>/.exec(own);
    if (subject) e.subject = unesc(subject[1]);
    for (const n of own.matchAll(/<note>([\s\S]*?)<\/note>/g)) {
      const t = unesc(n[1]), mm = /^match:([\w-]+):([\s\S]*)$/.exec(t);
      if (mm) e.match[mm[1]] = mm[2]; else e.note = t;
    }
    for (const ls of body.matchAll(/<langSet xml:lang="([^"]*)">([\s\S]*?)<\/langSet>/g)) {
      const def = /<descrip type="definition">([\s\S]*?)<\/descrip>/.exec(ls[2]);
      if (def) e.definition = unesc(def[1]);
      e.terms[ls[1]] = [...ls[2].matchAll(/<tig>([\s\S]*?)<\/tig>/g)].map((t) => {
        const term = unesc(/<term>([\s\S]*?)<\/term>/.exec(t[1])[1]);
        const st = /<termNote type="administrativeStatus">(\w+?)Term-admn-sts<\/termNote>/.exec(t[1]);
        const note = /<note>([\s\S]*?)<\/note>/.exec(t[1]);
        return { term, ...(st && STATUSES.includes(st[1]) ? { status: st[1] } : {}), ...(note ? { note: unesc(note[1]) } : {}) };
      });
    }
    entries.push(e);
  }
  return entries;
}

/** The term to use in a language: its first preferred one, or its first. */
export const termIn = (e, lang) => (e.terms[lang] || []).find((t) => t.status === "preferred")?.term ?? e.terms[lang]?.[0]?.term;
