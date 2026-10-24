/**
 * Twirl's accessibility floor, as tests. Method from mgifford/accessibility-skills
 * (skills/ci-cd, cli-audit): axe-core on every meaningful STATE, not just the
 * first screen, in BOTH colour schemes; plus semantic and keyboard assertions
 * for what axe cannot see. Audit record: apps/twirl/A11Y.md.
 *
 * What this does NOT establish: WCAG conformance, or that Twirl works well
 * with a screen reader. The sheet is a drawing surface (path-dependent input,
 * WCAG 2.1.1's exception); the keyboard and single-pointer routes tested here
 * are alternatives to it, not a translation of it. Manual and AT passes are
 * listed in A11Y.md as still to do.
 */
import { describe, it, expect, afterAll } from "vitest";
import { launch, openTwirl, AXE } from "./harness.js";

const browser = await launch();
afterAll(() => browser?.close());

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
async function axe(page) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }), TAGS);
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
}

/** Every state a person can reach that changes what is on screen. */
const STATES = {
  "first screen": async () => {},
  "after the first touch": async (p) => { await p.mouse.click(40, 500); },
  "controls drawer, Simple": async (p) => { await p.click("#menuBtn"); },
  "controls drawer, Everything": async (p) => { await p.click("#menuBtn"); await p.click('[data-set-level="3"]'); },
  "Toybox": async (p) => { await p.keyboard.press("t"); },
  "My toys": async (p) => { await p.keyboard.press("y"); },
  "Scenes, with a share code": async (p) => { await p.keyboard.press("s"); await p.click("#shareBtn"); await p.waitForSelector("#share:not([hidden])"); },
  "Takes": async (p) => { await p.keyboard.press("t"); await p.click('[data-tab="takes"]'); },
  "a loop's settings, Everything": async (p) => { await p.evaluate(() => { setLevel(3); openInspector(loops[0]); }); },
  "keyboard list": async (p) => { await p.keyboard.press("?"); },
  "pen palette": async (p) => { await p.evaluate(() => setLevel(2)); await p.keyboard.press("v"); },
};

describe.skipIf(!browser)("Twirl · axe, every state, both schemes", () => {
  for (const colorScheme of ["light", "dark"]) {
    for (const [name, act] of Object.entries(STATES)) {
      it(`${name} (${colorScheme})`, async () => {
        const { page, context, errors } = await openTwirl(browser, { colorScheme });
        await act(page);
        expect(await axe(page)).toEqual([]);
        expect(errors).toEqual([]);
        await context.close();
      });
    }
  }
});

describe.skipIf(!browser)("Twirl · keyboard and focus", () => {
  it("digits pick a loop, Enter opens its settings with focus inside, Escape closes them", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("2");
    expect(await page.evaluate(() => loops.indexOf(selected))).toBe(1);
    await page.keyboard.press("Enter");
    expect(await page.isVisible("#inspector")).toBe(true);
    expect(await page.evaluate(() => $("inspector").contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    expect(await page.isVisible("#inspector")).toBe(false);
    await context.close();
  });

  it("a loop chip opened from the keyboard gets focus back when its settings close", async () => {
    const { page, context } = await openTwirl(browser);
    await page.focus("#loops .chip:nth-child(3)");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement.id)).toBe("inspTitle");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => [...$("loops").children].indexOf(document.activeElement))).toBe(2);
    await context.close();
  });

  it("the shelf's tabs are one tab stop, moved with the arrow keys", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("t");
    expect(await page.evaluate(() => document.activeElement.id)).toBe("tab-toybox");
    expect(await page.evaluate(() => [...document.querySelectorAll("[role=tab]")].map((t) => t.tabIndex))).toEqual([0, -1, -1, -1]);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => [document.activeElement.id, shelfTab, $("scenes").hidden])).toEqual(["tab-scenes", "scenes", false]);
    await page.keyboard.press("End");
    expect(await page.evaluate(() => shelfTab)).toBe("takes");
    await context.close();
  });

  it("the keyboard list takes focus and gives it back", async () => {
    const { page, context } = await openTwirl(browser);
    await page.click("#menuBtn");
    await page.focus("#keysBtn");
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement.id)).toBe("keysClose");
    await page.keyboard.press("Escape");
    expect(await page.isVisible("#keys")).toBe(false);
    await context.close();
  });

  it("Tab and Shift+Tab step through the loops from the page, and wrap (never off to the address bar)", async () => {
    const { page, context } = await openTwirl(browser);
    const sel = () => page.evaluate(() => loops.indexOf(selected));
    await page.keyboard.press("Tab"); expect(await sel()).toBe(0);
    await page.keyboard.press("Tab"); expect(await sel()).toBe(1);
    await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); expect(await sel()).toBe(0);   // 3 loops: wraps
    await page.keyboard.press("Shift+Tab"); expect(await sel()).toBe(2);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await context.close();
  });

  it("C takes focus into the controls, where Tab reaches buttons with a visible ring", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("c");
    expect(await page.evaluate(() => document.activeElement.id)).toBe("drawerClose");
    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return [document.activeElement.tagName, s.outlineStyle, parseFloat(s.outlineWidth)]; });
    expect(ring[0]).toBe("BUTTON");
    expect(ring[1]).not.toBe("none");
    expect(ring[2]).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => [document.body.classList.contains("drawer-open"), $("strip").contains(document.activeElement)])).toEqual([false, false]);
    await context.close();
  });

  it("without an Esc key: ` and ⌘. close what's open, and Enter closes a loop's settings", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("h");
    expect(await page.isVisible("#keys")).toBe(true);
    await page.keyboard.press("`");
    expect(await page.isVisible("#keys")).toBe(false);
    await page.keyboard.press("t");
    expect(await page.isVisible("#shelf")).toBe(true);
    await page.keyboard.press("Meta+.");
    expect(await page.isVisible("#shelf")).toBe(false);
    await page.keyboard.press("1");
    await page.keyboard.press("Enter");
    expect(await page.isVisible("#inspector")).toBe(true);
    await page.keyboard.press("Enter");                         // focus is on the panel's title, not a button
    expect(await page.isVisible("#inspector")).toBe(false);
    await context.close();
  });

  it("a shifted digit always picks a pen, even where it types ? (⇧6 on Canadian French)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "?", code: "Digit6", shiftKey: true, bubbles: true })));
    expect(await page.evaluate(() => [state.pen, $("keys").hidden])).toEqual(["shake", true]);
    await page.keyboard.press("h");                             // help is H
    expect(await page.isVisible("#keys")).toBe(true);
    await context.close();
  });

  it("a loop's settings can switch Simple / More / Everything themselves", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { setLevel(1); openInspector(loops[0]); });
    expect(await page.isVisible("#inspMutate")).toBe(false);
    await page.click('#inspector [data-set-level="3"]');
    expect(await page.evaluate(() => level)).toBe(3);
    expect(await page.isVisible("#inspMutate")).toBe(true);
    expect(await page.getAttribute('#strip [data-set-level="3"]', "aria-pressed")).toBe("true");   // one setting, shown in both places
    await context.close();
  });

  it("F toggles full screen, and the button says which", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(40, 500);                            // full screen needs a user gesture in the page
    await page.keyboard.press("f");
    // The button follows the browser's fullscreenchange event, which can land a
    // moment after fullscreenElement changes: wait for the button, not the page.
    await page.waitForFunction(() => !!document.fullscreenElement && $("fsBtn").getAttribute("aria-pressed") === "true");
    await page.keyboard.press("f");
    await page.waitForFunction(() => !document.fullscreenElement && $("fsBtn").getAttribute("aria-pressed") === "false");
    expect(await page.getAttribute("#fsBtn", "aria-pressed")).toBe("false");
    await context.close();
  });

  it("full screen that slips away mid-stroke (a pull-down) comes back when the finger lifts; leaving on purpose stays left", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(40, 500);
    await page.keyboard.press("f");
    await page.waitForFunction(() => !!document.fullscreenElement && $("fsBtn").getAttribute("aria-pressed") === "true");
    await page.mouse.move(300, 80); await page.mouse.down(); await page.mouse.move(300, 300, { steps: 5 });
    await page.evaluate(() => document.exitFullscreen());                     // what the system's pull-down does
    await page.waitForFunction(() => !document.fullscreenElement && $("fsBtn").getAttribute("aria-pressed") === "false");   // the system's exit lands mid-stroke
    await page.mouse.up();
    await page.waitForFunction(() => !!document.fullscreenElement && $("fsBtn").getAttribute("aria-pressed") === "true");
    await page.keyboard.press("f");                                            // leaving on purpose…
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.mouse.click(300, 400);                                          // …and the next stroke doesn't undo that
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await context.close();
  });

  it("on its own site: a quiet Fork me on GitHub, and no 'now lives on Pages' note", async () => {
    const { page, context } = await openTwirl(browser);
    expect(await page.isVisible("#forkMe")).toBe(true);
    expect(await page.evaluate(() => $("homeNote").hidden)).toBe(true);
    expect(await page.getAttribute("#forkMe", "href")).toContain("github.com/Enkerli/music-suite");
    await context.close();
  });

  it("a full scene can be overwritten without a long press (Shift + Enter)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("s");
    await page.focus("#slots .slot:nth-child(1)");
    await page.keyboard.press("Enter");                       // empty: saves
    const first = await page.evaluate(() => store.get(slotKey(1)).loops.length);
    await page.evaluate(() => mutateLoop(loops[0]));
    await page.keyboard.press("Shift+Enter");                 // full: overwrites, and keeps focus on the slot
    expect(await page.evaluate(() => store.get(slotKey(1)).loops.length)).toBe(first + 1);
    expect(await page.evaluate(() => !!document.activeElement.closest("#slots"))).toBe(true);
    expect(await page.evaluate(() => !!(recorder || flowRec))).toBe(false);   // Shift+Space/Enter here must not start a recording
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · pointer alternatives and preferences", () => {
  it("a loop can be moved and turned with single taps (no drag, no two-finger turn)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.morph = false; openInspector(loops[0]); });
    const before = await page.evaluate(() => [loops[0].tx, loops[0].ty, loops[0].rot]);
    for (const m of ["right", "down", "ccw"]) await page.click(`[data-move="${m}"]`);
    const after = await page.evaluate(() => [loops[0].tx, loops[0].ty, loops[0].rot]);
    expect(after[0]).toBeGreaterThan(before[0]);
    expect(after[1]).toBeGreaterThan(before[1]);
    expect(after[2]).toBeGreaterThan(before[2]);
    await context.close();
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    it(`a loop's settings stay clear of the top bar at ${viewport.width}×${viewport.height}`, async () => {
      const { page, context } = await openTwirl(browser, { viewport, hasTouch: true });
      await page.evaluate(() => { setLevel(3); openInspector(loops[0]); });
      // The Done button must be what a tap on it hits (it once sat under ● Rec).
      const hit = await page.evaluate(() => { const r = $("inspClose").getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; });
      expect(hit).toBe("inspClose");
      await context.close();
    });
  }

  it("with reduced motion asked for, loops start still (Morph off, and says so)", async () => {
    const { page, context } = await openTwirl(browser, { reducedMotion: "reduce" });
    expect(await page.evaluate(() => [state.morph, $("morphBtn").getAttribute("aria-pressed")])).toEqual([false, "false"]);
    await context.close();
  });

  it("follows the suite's saved theme (enkerli.theme)", async () => {
    const { page, context } = await openTwirl(browser, { colorScheme: "light" });
    await page.evaluate(() => localStorage.setItem("enkerli.theme", "dark"));
    await page.reload();
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor])).toEqual(["dark", "rgb(26, 24, 20)"]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · pause", () => {
  it("Pause fades out before it suspends (no buzz), and Play fades back in", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => ensureAudio());
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    const paused = await page.evaluate(() => [ctx.state, master.gain.value]);
    expect(paused).toEqual(["suspended", 0]);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => [ctx.state, Math.abs(master.gain.value - state.volume) < 1e-3]);
    expect(back).toEqual(["running", true]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · the sound only pauses when you pause it", () => {
  it("Space inside a loop's settings doesn't pause the sheet (while recording, too)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600); await page.waitForTimeout(200);
    await page.keyboard.press("Shift+Space"); await page.waitForTimeout(300);
    await page.keyboard.press("1"); await page.keyboard.press("Enter");          // its settings, focus on the title
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "inspTitle");
    await page.keyboard.press("Space"); await page.waitForTimeout(300);
    expect(await page.evaluate(() => [ctx.state, !!(recorder || flowRec)])).toEqual(["running", true]);
    await context.close();
  });

  it("if the system interrupts the sound, Twirl says so and brings it back at the next touch", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600); await page.waitForTimeout(200);
    await page.evaluate(() => ctx.suspend());                                     // not through Pause: an interruption
    await page.waitForFunction(() => ctx.state === "suspended" && lostSound && !$("toast").hidden);
    await page.mouse.click(300, 700);
    await page.waitForFunction(() => ctx.state === "running");
    await page.keyboard.press("Space");                                           // and Pause still pauses, quietly
    await page.waitForFunction(() => ctx.state === "suspended");
    expect(await page.evaluate(() => lostSound)).toBe(false);
    await context.close();
  });
});
