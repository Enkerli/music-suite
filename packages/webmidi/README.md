# @enkerli/webmidi

The suite's shared **real-time Web MIDI** layer — a thin, suite-shaped wrapper
over [WEBMIDI.js](https://webmidijs.org). Apps depend on this API, not the
library directly, so the surface speaks in the suite's webapp↔plugin parity
concepts and the underlying library can evolve without touching app code.

This is the I/O foundation for bringing the plugin WebView UIs (Serpe, PitchFold,
DrawnQurve, Vane) to feature parity as standalone webapps. Audio output is a
separate concern — see `@enkerli/audio` for the preview voice; a synth like
Vane's wavetable engine is its own AudioWorklet, not this package. No OSC.

## Usage

```js
import { connect, ClockCounter } from "@enkerli/webmidi";

const midi = await connect({ sysex: false });   // enables WEBMIDI.js
midi.selectInput("Your Controller");
midi.selectOutput("Your Synth");

// Parity: advance scenes/progressive on MIDI clock or note-in, like the plugin.
const clock = new ClockCounter(() => advanceScene(), 24 /* pulses per beat */);
midi.onClock(() => clock.pulse());
midi.onTransport((t) => { if (t === "stop") clock.reset(); });
midi.onNoteIn((e) => { if (e.on) { advanceScene(); setOutputNote(e.note); } });

// Out
midi.sendNoteOn(60, { velocity: 100, channel: 1 });
```

`connect()` imports the browser-only library dynamically, so importing this
package in Node (e.g. for tests) never touches the Web MIDI global. The pure
helpers (`ClockCounter`, `normalizeNoteEvent`, `normalizeCCEvent`) and the
`SuiteMidi` class (constructed with any WEBMIDI.js-like object) are fully
unit-testable with a fake.

## Licensing

This wrapper is **CC0-1.0 (Public Domain)**, like the rest of the suite. It
depends on **WEBMIDI.js (Apache-2.0)**, which keeps its own license; that license
and attribution are reproduced in [`THIRD_PARTY_LICENSES.md`](./THIRD_PARTY_LICENSES.md)
and must travel with any bundle that includes the library (including the deployed
webapps). The suite's own apps and plugins remain Public Domain.
