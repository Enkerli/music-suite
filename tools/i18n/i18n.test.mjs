import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { writeTbx, readTbx, termIn } from "./tbx.mjs";
import { concord, formsRe } from "./concord.mjs";

const entry = {
  id: "loop", subject: "Twirl · on the sheet", definition: "a stroke that keeps replaying", note: "usual",
  terms: { en: [{ term: "loop", status: "preferred" }], fr: [{ term: "boucle", status: "preferred", note: "draft · usual" }, { term: "cycle & co", status: "admitted" }] },
  match: { en: "loops?", fr: "boucles?" },
};

describe("i18n kit · TBX-Basic", () => {
  it("writes TBX-Basic and reads back what it wrote", () => {
    const xml = writeTbx([entry], { title: "Test <terms>" });
    expect(xml).toContain('<martif type="TBX-Basic" xml:lang="en">');
    expect(xml).toContain("<termNote type=\"administrativeStatus\">admittedTerm-admn-sts</termNote>");
    expect(xml).toContain("cycle &amp; co");
    expect(readTbx(xml)).toEqual([entry]);
    expect(termIn(entry, "fr")).toBe("boucle");
  });

  it("Twirl's termbase reads, every term has French, every match pattern compiles", () => {
    const entries = readTbx(readFileSync(new URL("../../apps/twirl/i18n/terms.tbx", import.meta.url), "utf8"));
    expect(entries.length).toBeGreaterThan(50);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    for (const e of entries) {
      expect(termIn(e, "fr"), e.id).toBeTruthy();
      for (const re of Object.values(e.match)) expect(() => formsRe(re), `${e.id}: ${re}`).not.toThrow();
    }
  });
});

describe("i18n kit · concordance", () => {
  it("finds a term's strings, whole words only, and whether the translation uses it", () => {
    const table = {
      "Loop 3": "Boucle 3",
      "{0} loop{1}": "{0} {0|boucle|boucles}",          // a plural's choices count
      "Loops together": "Ensemble",                        // strays
      "Looping back": "Retour",                            // not the word
    };
    const [r] = concord([entry], table);
    expect(r.hits.map((h) => [h.source, h.ok])).toEqual([["Loop 3", true], ["{0} loop{1}", true], ["Loops together", false]]);
  });

  it("(?c) makes a pattern match its case only: a name, not the everyday word", () => {
    expect(formsRe("(?c)Time").test("each time")).toBe(false);
    expect(formsRe("(?c)Time").test("Time › Tempo")).toBe(true);
    expect(formsRe("évolu\\w*").test("Évolution désactivée")).toBe(true);
  });
});
