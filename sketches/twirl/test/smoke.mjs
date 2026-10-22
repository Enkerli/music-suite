#!/usr/bin/env node
/**
 * Twirl smoke test: drives the real page in headless Chromium and checks the
 * things that have broken (or been reported) before. Not a unit test suite:
 * the engine isn't extracted yet (see ../TESTING.md for the plan).
 *
 *   node sketches/twirl/test/smoke.mjs            # exits 1 on any failure
 *
 * Needs Playwright with a Chromium (`npm i -D playwright`, or a global one).
 * Fixtures in ./fixtures are real share tokens from the field, as received,
 * including the junk that apps inserted into them.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(here, "..", "index.html")).href;
const fixture = (name) => readFileSync(join(here, "fixtures", name), "utf8");

async function loadPlaywright() {
  try { return await import("playwright"); } catch (_) { /* try a global install */ }
  const root = execSync("npm root -g").toString().trim();
  return createRequire(join(root, "noop.js"))("playwright");
}

let failures = 0;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "  ✓" : "  ✗"} ${what}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
};

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
const newPage = async (viewport = { width: 1180, height: 820 }) => {
  const ctx = await browser.newContext({ viewport, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page };
};

console.log("Twirl smoke test\n\nFirst contact");
{
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  check(await page.evaluate(() => loops.length) === 3, "opens with three example loops");
  check(await page.evaluate(() => document.body.classList.contains("lvl-1")), "opens at the Simple level");
  check(await page.isHidden("#grid"), "Simple hides the grid picker");
  await page.click("#power");
  check(await page.evaluate(() => ctx && ctx.state === "running"), "sound starts");

  console.log("\nDrawing and Lock");
  await page.mouse.move(200, 400); await page.mouse.down();
  for (let i = 1; i < 30; i++) { await page.mouse.move(200 + i * 9, 400 + Math.sin(i / 4) * 80); await page.waitForTimeout(25); }
  await page.mouse.up();
  check(await page.evaluate(() => loops.length) === 4, "a drawn stroke becomes a loop");
  await page.evaluate(() => { state.lock = true; window.__strikes = 0; const real = lockStep; lockStep = (...args) => { const v = real(...args); if (v) window.__strikes++; return v; }; });
  await page.mouse.move(300, 200); await page.mouse.down();
  for (let i = 1; i < 40; i++) { await page.mouse.move(300 + i * 8, 200 + i * 6); await page.waitForTimeout(25); }
  await page.mouse.up();
  check(await page.evaluate(() => locked(loops.at(-1))), "with Lock on, loops are read on the grid");
  await page.waitForTimeout(1500);
  const strikes = await page.evaluate(() => window.__strikes);
  check(strikes > 2, "locked loops strike on the grid steps", `${strikes} strikes`);

  console.log("\nQuantizing is live (what you change is what you hear)");
  // Capture the beat of every free note played for a while, under two divisions.
  await page.evaluate(() => { state.lock = false; window.__beats = []; const real = play; play = (lp, ev, t, b, ph) => { window.__beats.push(b); return real(lp, ev, t, b, ph); }; });
  await page.evaluate(() => { $("div").value = "4"; $("div").dispatchEvent(new Event("change")); window.__beats = []; });
  await page.waitForTimeout(2500);
  const quarters = await page.evaluate(() => window.__beats.slice());
  check(quarters.length > 0 && quarters.every((b) => Math.abs(b - Math.round(b)) < 1e-6), "Division 1/4 puts every existing note on a beat", `${quarters.length} notes`);
  await page.evaluate(() => { $("div").value = "16"; $("div").dispatchEvent(new Event("change")); window.__beats = []; });
  await page.waitForTimeout(2500);
  const sixteenths = await page.evaluate(() => window.__beats.slice());
  check(sixteenths.some((b) => Math.abs(b - Math.round(b)) > 1e-6) && sixteenths.every((b) => Math.abs(b * 4 - Math.round(b * 4)) < 1e-6),
    "Division 1/16 lets them back between the beats", `${sixteenths.length} notes`);
  await page.evaluate(() => { window.__strikes = 0; });
  await page.evaluate(() => $("lockBtn").click());
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => window.__strikes) > 2, "toggling Lock changes existing loops at once");
  await page.evaluate(() => $("lockBtn").click());

  console.log("\nA loop's own settings");
  // Freeze motion first: a loop that drifts between aiming and holding makes the hold land elsewhere.
  const pt = await page.evaluate(() => { state.morph = false; loops.forEach((l) => { l.mt = { ...l.m }; }); const l = loops[0]; return place(l, l.pts[60].x, l.pts[60].y, sheet.clientWidth, sheet.clientHeight); });
  await page.mouse.move(pt[0], pt[1]); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  check(await page.isVisible("#inspector"), "holding a loop opens its settings");
  await page.click('[data-insp="zone"] [data-v="low"]');
  await page.click('[data-insp="temper"] [data-v="still"]');
  check(await page.evaluate(() => insp && insp.zone === "low" && insp.temper === "still"), "zone and movement apply to that loop");
  await page.waitForTimeout(1800);
  check(await page.evaluate(() => { const l = insp; const cy = l.c.y + l.ty + l.m.ty; return cy >= 0.6; }), "a low loop glides into the low zone");
  await page.evaluate(() => { const g = $("inspGain"); g.value = "0.5"; g.dispatchEvent(new Event("input")); window.__vels = []; const real = sound; sound = (v, x, y, vel, ...r) => { window.__vels.push(vel); return real(v, x, y, vel, ...r); }; loops.forEach((l) => { if (l !== insp) l.muted = true; }); });
  await page.waitForTimeout(3000);
  const vels = await page.evaluate(() => window.__vels.slice());
  check(vels.length > 0 && Math.max(...vels) <= 0.5 + 1e-9, "a loop's Volume scales its notes", `${vels.length} notes, max ${Math.max(...vels).toFixed(2)}`);
  await page.evaluate(() => loops.forEach((l) => { l.muted = false; }));
  await page.click("#inspClose");

  console.log("\nSounds and density");
  for (const pack of ["mallets", "chip", "paper"]) {
    await page.evaluate((p) => { state.pack = p; for (const v of ["pluck", "bell", "blip", "drum", "shake"]) sound(v, 0.5, 0.2, 0.8, ctx.currentTime + 0.01, nowBeat()); sound("drum", 0.5, 0.5, 0.8, ctx.currentTime + 0.01, nowBeat()); sound("drum", 0.5, 0.9, 0.8, ctx.currentTime + 0.01, nowBeat()); }, pack);
  }
  check(errors.length === 0, "every voice of every pack plays", errors.join("; "));
  const strides = await page.evaluate(() => ["sparse", "medium", "dense"].map((d) => { state.density = d; return Math.round(stridePx()); }));
  check(strides[0] > strides[1] && strides[1] > strides[2], "density changes note spacing", strides.join(" > "));
  await page.evaluate(() => { state.density = "medium"; });

  console.log("\nClear keeps saved things");
  await page.click("#toyBtn"); await page.click('[data-tab="scenes"]'); await page.click("#slots .slot >> nth=0");
  await page.click("#shelfClose");
  await page.evaluate(() => setDrawer(true));
  await page.click("#clear"); await page.click("#clear");
  check(await page.evaluate(() => loops.length) === 0, "two taps clear the sheet");
  check(await page.evaluate(() => !!store.get(slotKey(1))), "the saved scene survives Clear");

  console.log("\nCodes: everything, from one browser to another");
  await page.click("#toyBtn"); await page.click('[data-tab="scenes"]'); await page.click("#slots .slot >> nth=0");     // recall it
  await page.evaluate(() => keepToy(loops[0]));
  await page.click("#toyBtn"); await page.click('[data-tab="scenes"]'); await page.click("#shareAllBtn"); await page.waitForTimeout(300);
  const everything = await page.inputValue("#shareLink");
  check(everything.startsWith("twirl:a1."), "Copy everything makes a code", `${everything.length} chars`);
  const other = await newPage({ width: 375, height: 664 });
  await other.page.goto(PAGE); await other.page.waitForTimeout(300);
  await other.page.evaluate(() => openShelf("scenes")); await other.page.click("#openLinkBtn");
  await other.page.fill("#pasteLink", "here you go\n" + everything + "\n:)"); await other.page.waitForTimeout(900);
  check(await other.page.evaluate(() => !!store.get(slotKey(1)) && loadToys().length >= 1), "pasting it elsewhere fills scenes and toys");
}

console.log("\nKeyboard");
{
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  check(await page.evaluate(() => ctx && ctx.state === "running"), "Space starts the sound");
  await page.keyboard.press("Backspace");
  check(await page.evaluate(() => loops.length) === 2, "Backspace removes the newest loop");
  await page.keyboard.press("Control+Shift+Z");
  check(await page.evaluate(() => loops.length) === 3, "Ctrl/⌘+Shift+Z brings it back");
  await page.keyboard.press("l");
  check(await page.evaluate(() => state.lock), "L toggles Lock");
  await page.keyboard.press("n");
  check(await page.evaluate(() => state.density) === "dense", "N steps the notes density");
  await page.keyboard.press("Shift+N");
  check(await page.evaluate(() => state.density) === "medium", "Shift steps it back");
  await page.keyboard.press("]");
  check(await page.evaluate(() => state.bpm) === 98, "] nudges the tempo up");
  await page.keyboard.press("\\"); await page.keyboard.press("\\");
  check(await page.evaluate(() => document.body.classList.contains("lvl-3")), "\\ steps through the levels to Everything");
  await page.keyboard.press("2");
  check(await page.evaluate(() => selected === loops[1]), "2 selects loop 2");
  const before = await page.evaluate(() => selected.tx);
  await page.keyboard.press("Shift+ArrowRight");
  check(await page.evaluate((b) => selected.tx > b, before), "arrows move the selected loop");
  await page.keyboard.press("x");
  check(await page.evaluate(() => selected.muted), "X mutes it");
  await page.keyboard.press("x");
  await page.keyboard.press("Shift+Digit2");
  check(await page.evaluate(() => state.pen) === "drum", "Shift+2 picks the drum pen");
  await page.keyboard.press("v");
  check(await page.isVisible("#palette"), "V shows the pen palette");
  await page.click('[data-pen="bell"]');
  check(await page.evaluate(() => state.pen) === "bell", "the palette sets the pen");
  await page.keyboard.press("v");
  await page.keyboard.press("t");
  check(await page.isVisible("#toybox"), "T opens the Toybox");
  await page.keyboard.press("Escape");
  check(await page.isHidden("#shelf"), "Esc closes it");
  await page.keyboard.press("?");
  check(await page.isVisible("#keys"), "? shows the shortcut list");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+Backspace"); await page.keyboard.press("Shift+Backspace");
  check(await page.evaluate(() => loops.length) === 0, "Shift+Backspace twice clears the sheet");
}

console.log("\nRhythm, harmony, swing, drone, sounds, recording");
{
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  await page.click("#power");
  const offs = await page.evaluate(() => { const lp = loops.find((l) => l.events.length > 3); lp.rhythm = "even"; const o = offsOf(lp); return { o, L: lp.L, n: lp.events.length }; });
  const gaps = offs.o.slice(1).map((x, i) => x - offs.o[i]);
  check(gaps.every((g) => Math.abs(g - offs.L / offs.n) < 1e-9), "Rhythm: even spaces a loop's notes evenly");
  // (A loop with more notes than steps can't give each its own step; pick one that fits.)
  const eu = await page.evaluate(() => { state.div = "16"; const lp = loops.find((l) => l.events.length > 1 && l.events.length <= l.L * 4); lp.rhythm = "euclid"; return offsOf(lp).map((x) => x * 4); });
  check(eu.every((x) => Math.abs(x - Math.round(x)) < 1e-9), "Rhythm: euclidean lands every note on a step");
  const stack = await page.evaluate(() => { let n = 0; const real = VOICES.pluck; state.pack = "paper"; VOICES.pluck = (...a) => { n++; return real(...a); }; sound("pluck", 0.5, 0.5, 0.8, ctx.currentTime + 0.01, nowBeat(), undefined, "seventh"); VOICES.pluck = real; return n; });
  check(stack === 4, "Chord: sevenths stack four notes", `${stack}`);
  const sw = await page.evaluate(() => { state.div = "8"; state.swing = 0.5; return [swung(0), swung(0.5), swung(1)]; });
  check(sw[0] === 0 && sw[1] === 0.75 && sw[2] === 1, "Swing delays every other step", sw.join(", "));
  await page.evaluate(() => { state.swing = 0; state.drone = true; setDrone(true); for (const v of ["lowfifth", "triad", "open"]) { state.droneVoicing = v; setDrone(true); } setDroneVol(0.8); });
  check(await page.evaluate(() => drone && drone.voices.length === 4), "Drone: voicings rebuild it (open = 4 notes)");
  await page.evaluate(() => { for (const pack of Object.keys(PACKS)) { state.pack = pack; for (const v of ["pluck", "bell", "blip"]) sound(v, 0.5, 0.4, 0.8, ctx.currentTime + 0.01, nowBeat(), undefined, "triad"); sound("drum", 0.5, 0.9, 0.8, ctx.currentTime + 0.01, nowBeat()); } state.pack = "paper"; });
  check(true, "every sound pack plays, chords included (errors would show below)");
  await page.keyboard.press("Shift+Space"); await page.waitForTimeout(1200); await page.keyboard.press("Shift+Space"); await page.waitForTimeout(600);
  check(await page.evaluate(() => takes.length === 1 && takes[0].blob.size > 0), "Shift+Space records a take", await page.evaluate(() => takes[0] && `${takes[0].blob.size} bytes, .${takes[0].ext}`));
  check(await page.isVisible("#takes"), "the take shows in Toybox → Takes");
}

console.log("\nSelection, direction, breathing, arcs, duplicates");
{
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  await page.click("#power");
  await page.keyboard.press("1"); await page.keyboard.press("Enter");
  await page.keyboard.press("2");
  check(await page.evaluate(() => insp === loops[1] && !$("inspWrap").hidden), "open settings follow the selected loop (1, Enter, 2)");
  await page.keyboard.press("Escape");
  check(await page.evaluate(() => [0, 1, 2, 3].map((k) => backwards({ dir: "pingpong" }, k)).join()) === "false,true,false,true", "ping-pong: every other pass runs backwards");
  // Timing: one free loop, no snapping, fast tempo; record where its notes land in each pass.
  const heard = await page.evaluate(async () => {
    state.div = "free"; state.morph = false; state.lock = false; state.bpm = 240; t0 = nowAudio() - nowBeat() / bps();
    loops.splice(1).forEach(fadeOut);
    const lp = loops[0]; lp.trigger = "free"; lp.rhythm = "drawn"; lp.ts = 1; lp.dir = "rev"; lp.every = 1;
    lp.start = Math.ceil(nowBeat()) + 1; lp.cursor = lp.start; lp.lastPass = 0;
    const got = []; const real = play;
    play = (l, ev, t, b, ph) => { if (l === lp) got.push(b - lp.start); return real(l, ev, t, b, ph); };
    await new Promise((r) => setTimeout(r, (lp.L * 2 + 1.5) * 250));
    play = real;
    return { got, offs: lp.events.map((e) => e.off), L: lp.L };
  });
  const firstPass = heard.got.filter((b) => b < heard.L).sort((x, y) => x - y);
  const expected = heard.offs.map((o) => Math.max(0, heard.L - o - 1e-6)).sort((x, y) => x - y);
  check(firstPass.length === expected.length && firstPass.every((b, i) => Math.abs(b - expected[i]) < 1e-3),
    "reverse: a note drawn at t sounds at L − t", `${firstPass.length}/${expected.length} notes`);
  const rests = await page.evaluate(async () => {
    const lp = loops[0]; lp.dir = "fwd"; lp.every = 2;
    lp.start = Math.ceil(nowBeat()) + 1; lp.cursor = lp.start; lp.lastPass = 0;
    const passes = new Set(); const real = play;
    play = (l, ev, t, b, ph) => { if (l === lp) passes.add(Math.floor((b - lp.start) / lp.L)); return real(l, ev, t, b, ph); };
    await new Promise((r) => setTimeout(r, (lp.L * 3 + 1) * 250));
    play = real;
    return [...passes].sort();
  });
  check(rests.length > 0 && rests.every((k) => k % 2 === 0), "Plays: every other pass rests", `passes ${rests.join(", ")}`);
  const air = await page.evaluate(() => {
    const count = (a) => { state.air = a; strikeLog = []; let kept = 0; for (let i = 0; i < 200; i++) if (airKeep(i / 100 + 0.013)) kept++; return kept; };
    const r = [count(0), count(1)]; state.air = 0; return r;
  });
  check(air[0] === 200 && air[1] < 60, "Air thins a busy stretch", `${air[0]} → ${air[1]} of 200`);
  const arc = await page.evaluate(() => {
    state.arc = "4"; state.walk = false;
    const phases = [0, 1, 2, 3].map((bar) => harmonyAt(bar * BAR + 0.5).phase);
    const home = [...Array(14)].map((_, d) => mod(resolveStep(d), stepCount()));
    state.arc = "off";
    return { phases, home };
  });
  check(arc.phases.join() === "0,1,2,3", "Arc (4 bars): home, away, pull, resolve", arc.phases.join());
  check(arc.home.every((d) => [0, 2, 4].includes(d)), "resolving lands on the home chord's steps", arc.home.join(""));
  const dup = await page.evaluate(() => { const n = loops.length; select(loops[0]); return n; });
  await page.keyboard.press("d");
  check(await page.evaluate((n) => loops.length === n + 1 && loops[n].events.length === loops[0].events.length && loops[n].uid !== loops[0].uid, dup),
    "D duplicates the selected loop");
}

console.log("\nPlayflows: record what you do, replay it, share it");
{
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  await page.click("#power");
  await page.evaluate(() => { state.bpm = 180; t0 = nowAudio() - nowBeat() / bps(); loops.forEach((l) => (l.temper = "still")); });
  await page.keyboard.press("Shift+Space"); await page.waitForTimeout(300);
  await page.mouse.move(300, 300); await page.mouse.down();
  for (let i = 1; i < 25; i++) { await page.mouse.move(300 + i * 10, 300 + Math.cos(i / 3) * 60); await page.waitForTimeout(25); }
  await page.mouse.up(); await page.waitForTimeout(400);
  await page.keyboard.press("1"); await page.keyboard.press("Shift+ArrowUp"); await page.keyboard.press("x"); await page.waitForTimeout(400);
  await page.keyboard.press("2"); await page.keyboard.press("Backspace"); await page.waitForTimeout(400);
  await page.evaluate(() => { $("bpm").value = "150"; $("bpm").dispatchEvent(new Event("input")); }); await page.waitForTimeout(400);
  const before = await page.evaluate(() => loops.map((l) => ({ n: l.events.length, ty: Math.round(l.ty * 1000), muted: l.muted })));
  await page.keyboard.press("Shift+Space"); await page.waitForTimeout(600);
  const flows = await page.evaluate(() => loadFlows());
  check(flows.length === 1 && flows[0].token.startsWith("f"), "● Rec keeps a playflow", flows[0] && `${flows[0].token.length} characters, ${flows[0].loops} loops`);
  check(await page.evaluate(() => !!document.querySelector('#takeList [data-flow]')), "the take shows in Takes with Replay");
  await page.evaluate(() => startReplay(loadFlows()[0]));
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!replay && !$("replayBar").hidden && loops.length > 0 && loops.every((l) => l.replaying)), "Replay clears the sheet and rebuilds it from the take");
  await page.waitForFunction(() => !replay, null, { timeout: 15000 }).catch(() => {});
  const after = await page.evaluate(() => ({ bpm: state.bpm, loops: loops.map((l) => ({ n: l.events.length, ty: Math.round(l.ty * 1000), muted: l.muted })) }));
  check(after.bpm === 150, "the replay changes the tempo when you did", `${after.bpm}`);
  check(JSON.stringify(after.loops) === JSON.stringify(before), "the replay ends where you left off (drawn, moved, muted, erased)",
    `${JSON.stringify(after.loops)} vs ${JSON.stringify(before)}`);
  await page.evaluate(() => startReplay(loadFlows()[0])); await page.waitForTimeout(300);
  await page.mouse.click(600, 600);
  check(await page.evaluate(() => !replay && $("replayBar").hidden), "touching the sheet takes over from a replay");
  const code = await page.evaluate(() => codeOf(loadFlows()[0].token));
  const other = await newPage({ width: 375, height: 664 });
  await other.page.goto(PAGE); await other.page.waitForTimeout(300);
  await other.page.evaluate((c) => openPasted(`here's my take: ${c} enjoy`), code); await other.page.waitForTimeout(300);
  check(await other.page.evaluate(() => loadFlows().length === 1 && !$("takes").hidden), "a take's code pastes into another browser's Takes");
}

console.log("\nField links (as received)");
for (const [name, loopsExpected] of [["field-1-stray-bangs.txt", 4], ["field-2-bangs-and-line-breaks.txt", 4], ["field-3-clean-long-safari.txt", 14]]) {
  const { page } = await newPage();
  await page.goto(PAGE); await page.waitForTimeout(300);
  await page.evaluate(() => openShelf("scenes")); await page.click("#openLinkBtn");
  await page.fill("#pasteLink", "https://claude.ai/artifact/NErPKSQ1XZ2JEXZ4j5CxTa#s1." + fixture(name).trim()); await page.waitForTimeout(900);
  const n = await page.evaluate(() => loops.length);
  check(n === loopsExpected, `${name} opens by pasting`, `${n} loops`);
}

console.log("\nPhone");
{
  const { page } = await newPage({ width: 375, height: 664 });
  await page.goto(PAGE); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.body.scrollWidth) <= 375, "no sideways scrolling at 375px");
  await page.click("#menuBtn"); await page.waitForTimeout(300);
  check(await page.evaluate(() => document.body.classList.contains("drawer-open")), "☰ opens the drawer");
  await page.click('[data-set-level="3"]');
  check(await page.isVisible("#tuning"), "Everything shows the tuning picker");
}

check(errors.length === 0, "no page errors anywhere", errors.join("; "));
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
