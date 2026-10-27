# tools/i18n: translating the suite's apps with standard formats

Started with Twirl's French (2026-10-27). The idea is to use what translators
already use, with open tools and public sources, instead of a custom format.

**The order of work.** First settle the terms that keep coming back. Then
answer the broad questions (register, verbs or nouns, which English words
stay). Then go through the strings by screen, with options where they're
unsure. Strings follow their terms, so each term is decided once.

**Formats**

| What | Format | Here |
|---|---|---|
| Terms | TBX-Basic (ISO 30042, the "martif" form) | `apps/<app>/i18n/terms.tbx` |
| Strings | for now the app's own table (`apps/twirl/i18n/fr.json`, keyed by the English); XLIFF next | |
| Memory of approved strings | TMX, next | |

Weblate, OmegaT and the Translate Toolkit all read TBX-Basic. Each entry is
one concept: the English term, the French one to use (`preferred`), and
acceptable others (`admitted`). It also carries a definition (what the term
is in the app), a note, and the forms to find the term by in running text.
Those forms sit in a note starting `match:`, so the file stays valid
TBX-Basic.

**Tools**

- `tbx.mjs`: writes and reads TBX-Basic. It's not a general parser: it reads
  back what it wrote.
- `concord.mjs`: checks a termbase against a translation table. For each
  term, it lists every string that uses it and whether the translation uses
  the term's French. Terms come most-used first.

      node tools/i18n/concord.mjs apps/twirl/i18n/terms.tbx apps/twirl/i18n/fr.json [--json]

  Patterns are regex sources, matched as whole words. They ignore case,
  except a pattern starting `(?c)`: use it for a name ("Time" the section,
  not every "time").

**Public sources for Québec French:**
- [Termium Plus](https://www.btb.termiumplus.gc.ca/), the Government of
  Canada's term bank, with its writing tools;
- the OQLF's [Vitrine linguistique](https://vitrinelinguistique.oqlf.gouv.qc.ca/)
  (the *Grand dictionnaire terminologique* and the *Banque de dépannage
  linguistique*);
- [Wiktionnaire](https://fr.wiktionary.org/).
