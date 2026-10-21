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
  const lockLoop = await page.evaluate(() => loops.at(-1).trigger);
  check(lockLoop === "lock", "Lock strokes become locked loops");
  await page.waitForTimeout(1500);
  const strikes = await page.evaluate(() => window.__strikes);
  check(strikes > 2, "locked loops strike on the grid steps", `${strikes} strikes`);

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
  await page.keyboard.press("3");
  check(await page.evaluate(() => document.body.classList.contains("lvl-3")), "3 shows Everything");
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
