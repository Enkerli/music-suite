// Renders Twirl's own voices offline, dry, as the page plays them (its recipes
// in index.html, section 3), for comparing against other renderings of them
// (the Surge XT patches, apps/twirl/surge/). Usage:
//   node apps/twirl/test/render-voices.mjs <out dir> '<json list of {pack, voice, note, vel, yN, midi}>'
// `note` is the MIDI note Twirl sends for it (bell and blip an octave above
// the page's pitch; drums General MIDI's), `vel` 0..1, `yN` the height (the
// drum's kind, the shaker's size), `midi` the page's pitch where it isn't
// the note's (drums: 60, as the plugin plays drum notes coming in). The
// Drone: {voice: "drone", vel: its level, seconds}, the starting sheet's
// chord in its default voicing and space, no Warmth; its notes (as sent on
// channel 4) go to <name>.json. Writes <pack>-<voice>-<note>-<vel>.f32:
// mono float32 at 48 kHz, 2 s (or `seconds`), through Twirl's volume (0.8)
// but not its delay.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { PAGE } from "./harness.js";

const [outDir, list] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto(PAGE);
await page.waitForFunction(() => typeof loops !== "undefined");
for (const j of JSON.parse(list)) {
  const { samples, notes } = await page.evaluate(async ({ pack, voice, note, vel, yN, midi: m, seconds = 2 }) => {
    // The page is live: once it has an audio context, its scheduler would play
    // the starting sheet's loops (and the Drone) into this one too. Silence it.
    loops.splice(0); state.drone = false; state.walk = false;
    const off = new OfflineAudioContext(1, 48000 * seconds, 48000);
    ctx = off; nuance = 0; lift = 0;                    // as drawn: no Vary, no accent
    master = off.createGain(); master.gain.value = 0.8; master.connect(off.destination);
    delaySend = off.createGain();                        // the delay: left out
    noiseBuf = off.createBuffer(1, 48000, 48000);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (voice === "drone") {
      Object.assign(state, { droneVol: vel, droneVoicing: "fifth", droneSpace: "drift", warmth: 0 });
      setDrone(true);
      const notes = drone.voices.map((d) => Math.round(midiForDegree(harmonyAt(nowBeat()).shift + d.deg + stepCount()) - 24));
      return { samples: Array.from((await off.startRendering()).getChannelData(0)), notes };
    }
    const v = PACKS[pack][voice] || VOICES[voice], midi = m ?? note - (voice === "bell" || voice === "blip" ? 12 : 0);
    if (voice === "shake") v.call(PACKS[pack], 0.01, vel, 0, 1 - yN); else v.call(PACKS[pack], 0.01, midi, vel, 0, yN ?? 0.5);
    const buf = await off.startRendering();
    // the panner's centre is -3 dB on each side; one side, as a mono voice
    return { samples: Array.from(buf.getChannelData(0)) };
  }, j);
  const name = `${j.pack}-${j.voice}-${j.note}-${j.vel}`;
  writeFileSync(`${outDir}/${name}.f32`, Buffer.from(new Float32Array(samples).buffer));
  if (notes) writeFileSync(`${outDir}/${name}.json`, JSON.stringify(notes));
  console.log(name);
}
await browser.close();
