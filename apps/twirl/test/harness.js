/**
 * Shared harness for Twirl's tests: the real page (apps/twirl/index.html, the
 * very file Pages serves) in headless Chromium, driven through Playwright.
 *
 * Twirl is one self-contained HTML file with one classic <script>, so its
 * top-level functions and state (loops, state, mutateLoop, packScene…) are
 * reachable from page.evaluate(). The tests use that to set up states and read
 * results, and use real pointer and keyboard input wherever the behaviour
 * under test IS the input (drawing, focus, keys).
 *
 * No browser? Locally the tests skip, with a note saying why. In CI they must
 * run: a self-skipping guard that silently guards nothing is the failure mode
 * tests.yml's bridge job already warns about, so `CI` turns a missing browser
 * into a failure. Install it with `npx playwright install chromium`.
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const PAGE = new URL("../index.html", import.meta.url).href;
export const AXE = require.resolve("axe-core/axe.min.js");

/** One browser per test file. Resolves null (skip) only outside CI. */
export async function launch() {
  try {
    // Sound starts on the first touch in real use; headless has no touch to unlock it.
    return await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  } catch (e) {
    if (process.env.CI) throw e;
    console.warn(`\n[twirl] no Chromium for Playwright here, so Twirl's browser tests are skipped.\n        npx playwright install chromium   (${String(e.message).split("\n")[0]})\n`);
    return null;
  }
}

/**
 * A fresh Twirl in its own context (so its own localStorage: no scene, toy or
 * level leaks between tests). Fonts are blocked: the tests don't need them
 * and CI shouldn't depend on Google being reachable.
 */
export async function openTwirl(browser, { colorScheme = "light", viewport = { width: 1280, height: 800 }, reducedMotion = "no-preference", hasTouch = false, initScript, query = "" } = {}) {
  const context = await browser.newContext({ colorScheme, viewport, reducedMotion, hasTouch });
  if (initScript) await context.addInitScript(initScript);   // runs before the page's own script (as DPF's injected functions do)
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(PAGE + query);                               // query: "?lang=fr", "?template=…"
  await page.waitForFunction(() => typeof loops !== "undefined" && loops.length > 0);
  return { page, context, errors };
}

/** Screen position (px) of point `j` of loop `i`, wherever the loop is now. */
export const loopPoint = (page, i, j = 0) => page.evaluate(([i, j]) => {
  const lp = loops[i], p = lp.pts[Math.min(j, lp.pts.length - 1)];
  return place(lp, p.x, p.y, sheet.clientWidth, sheet.clientHeight);
}, [i, j]);

/** Draw a curved stroke with the mouse: down, `steps` moves over `ms`, up. */
export async function drawStroke(page, { x = 260, y = 420, w = 360, h = 160, steps = 36, ms = 900, beforeUp } = {}) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= steps; k++) {
    const u = k / steps;
    await page.mouse.move(x + w * u, y - h * Math.sin(u * Math.PI));
    await page.waitForTimeout(ms / steps);
  }
  if (beforeUp) await beforeUp();
  await page.mouse.up();
}

/** Record every note Twirl sounds (voice, when it was asked for, when it sounds). */
export const listen = (page) => page.evaluate(() => {
  window.__heard = [];
  const orig = sound;            // a top-level function declaration: replacing window.sound re-routes every call
  window.sound = function (voice, xN, yN, vel, t, ...rest) {
    window.__heard.push({ voice, asked: ctx ? ctx.currentTime : 0, at: t });
    return orig.call(this, voice, xN, yN, vel, t, ...rest);
  };
});
export const heard = (page) => page.evaluate(() => window.__heard.slice());
