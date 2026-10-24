# music-suite

Monorepo for the Enkerli music suite: a family of Public Domain tools for
playing *with* music. It holds the shared packages, the source of every
webapp, and the showcase site.

**Use the tools:** <https://enkerli.github.io/music-suite/>. Every app runs
there, in a browser, with nothing to install.

## Apps

Twelve webapps, each at `https://enkerli.github.io/music-suite/apps/<slug>/`:

| App | Slug | What it's for |
|---|---|---|
| Suite Workspace | `workspace` | Several tools on one page, on one message bus; keys and MIDI bound to any of them |
| ProgGenie (Progression Studio) | `proggenie` | Generate, edit and play chord progressions on a leadsheet |
| MIDIcurator | `midicurator` | Collect, analyse and vary MIDI clips |
| Serpe | `serpe` | Rhythm patterns: notation (UPI), Euclidean and Barlow tools, transforms |
| PitchFold | `pitchfold` | Fold incoming pitch into a chosen set of pitches |
| Vane | `vane` | Expressive wavetable synth for breath, pressure and slide |
| DrawnQurve | `drawnqurve` | Draw curves that drive notes, pitch or modulation |
| Twirl | `twirl` | Draw a gesture, hear it, and it keeps looping on its own clock |
| PickPCS | `pickpcs` | Explore sets of notes on a ring |
| Chord Dictionary | `chord-dictionary` | Look chords up; see them on a ring or a pad grid |
| Exquisite Fingerings | `exquisite` | Chords and scales on square and hex pad grids |
| Style Gallery | `style-gallery` | The "paper & ink" design system, live |

Most of them are also plugins and standalones for macOS, iPadOS and Linux,
built from separate repos that read their UI from `apps/` here. A thirteenth
app directory, `apps/rnd-companion`, is the UI of the RND Companion plugin.
The full list, with plugin codes and formats, is
[docs/INVENTORY.md](docs/INVENTORY.md) (checked against the tree by
`npm run check-inventory`); what each name means is
[docs/GLOSSARY.md](docs/GLOSSARY.md).

## Packages

Sixteen `@enkerli/*` packages, one line each in
[docs/INVENTORY.md](docs/INVENTORY.md#packages-16-enkerli-typescriptjs).
The ones the rest stand on:

| Package | Purpose |
|---|---|
| [`@enkerli/theory`](packages/theory) | Zero-dependency TypeScript music-theory core: pitch classes and sets, the 167-quality chord dictionary and detector, taxicab voice leading, structural spelling, rhythm (Euclid, Barlow). The **reference implementation**: Lua and C++ ports must match `packages/theory/vectors/*.json`. |
| [`@enkerli/ui`](packages/ui) | Design tokens and shared web components, for browsers **and** JUCE WebView plugin UIs. |
| [`@enkerli/upi`](packages/upi) | Serpe's UPI rhythm engine: notation parser, generators, transforms, analysis. Powers `msuite upi`. |
| [`@enkerli/proggen`](packages/proggen) | ProgGenie's progression engine over corpus statistics. Ships the derived tables, never the corpus. |
| [`@enkerli/control`](packages/control) | The binding layer: keyboard / MIDI → control-plane params and commands, against tool manifests. |
| [`@enkerli/cli`](packages/cli) | `msuite`, the headless tools (16 commands; INVENTORY lists them). |

## Conventions

- **npm workspaces** (no extra tooling), TypeScript strict, Vitest.
- **Test vectors are the cross-language contract.** Any algorithm ported to
  Lua or C++ (or re-implemented in an app, as Twirl's Barlow weights are)
  gets checked against the JSON vectors here.
- **Leftmost = LSB, structural spelling.** Deliberate decisions, not
  accidents: [CONVENTIONS.md](CONVENTIONS.md).
- **MIDI is progressive enhancement in webapps** (WebKit has no Web MIDI);
  the JUCE WebView bridge is the portable MIDI path.
- **All site copy lives in [`docs/site.md`](docs/site.md)**; `npm run
  build-site` regenerates the pages from it.
- Licensing: CC0-1.0 throughout this repo.

## Develop

```bash
npm install
npx playwright install chromium   # once: Twirl's browser tests use it
npm test                          # all workspaces
npm run typecheck
node tools/doc-audit.mjs          # the docs' checkable claims (a report, not a gate)
```

For everything else (how the site deploys, connecting a deployed page to your
own machine, building the JUCE plugins and standalones with exact `cmake`
commands), see **[BUILD.md](BUILD.md)**, the one place all of that is kept
current. Picking the project up cold: [HANDOFF.md](HANDOFF.md).
