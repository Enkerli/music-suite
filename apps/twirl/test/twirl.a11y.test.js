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
  "messages, quiet dot and its log": async (p) => { await p.evaluate(() => { toast("Lock on"); toast("Loop 2 took its chords from loop 1"); }); await p.click("#msgBtn"); },
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

describe.skipIf(!browser)("Twirl · axe, every state, in French", () => {
  for (const [name, act] of Object.entries(STATES)) {
    it(`${name} (fr)`, async () => {
      const { page, context, errors } = await openTwirl(browser, { query: "?lang=fr" });
      await act(page);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe("fr");
      expect(await axe(page)).toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    });
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
      // Measured once the panel has settled (it slides in; a slow CI runner caught it mid-way).
      const at = () => { const r = $("inspClose").getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; };
      await page.waitForFunction(at, null, { timeout: 3000 }).catch(() => {});
      expect(await page.evaluate(at)).toBe("inspClose");
      // …and all of it on the screen, whatever the fonts: the panel never grows wider than the screen.
      const edge = await page.evaluate(() => [$("inspClose").getBoundingClientRect().right, $("inspector").getBoundingClientRect().right, innerWidth]);
      expect(edge[0]).toBeLessThanOrEqual(edge[2]);
      expect(edge[1]).toBeLessThanOrEqual(edge[2] + 0.5);
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

describe.skipIf(!browser)("Twirl · messages stay quiet, behind a dot; replays stay out of the picture", () => {
  it("a message doesn't show on the sheet by default: the dot lights up, its log has it, and screen readers still hear it", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => toast("Lock on"));
    expect(await page.evaluate(() => [$("toast").hidden, $("msgBtn").hidden, $("msgBtnLabel").textContent, $("srStatus").textContent])).toEqual([true, false, "1 new", "Lock on"]);
    await page.click("#msgBtn");
    expect(await page.evaluate(() => [$("msgLog").hidden, $("msgList").textContent.includes("Lock on"), document.activeElement.id])).toEqual([false, true, "msgLogTitle"]);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => [$("msgLog").hidden, $("msgBtnLabel").textContent, document.activeElement.id])).toEqual([true, "What happened", "msgBtn"]);
    await context.close();
  });

  it("'Show them as they happen' brings the toasts back, and is remembered; messages that need you always show", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => toast("The sound was interrupted · touch the sheet or press a key to bring it back", true));
    expect(await page.evaluate(() => $("toast").hidden)).toBe(false);
    await page.click("#msgBtn"); await page.click("#msgLoudBtn");
    expect(await page.evaluate(() => [store.get("twirl:messages"), $("msgLoudBtn").getAttribute("aria-pressed")])).toEqual(["show", "true"]);
    await page.keyboard.press("Escape");
    await page.evaluate(() => { $("toast").hidden = true; toast("Lock off"); });
    expect(await page.evaluate(() => $("toast").hidden)).toBe(false);
    await context.close();
  });

  it("two modes, one switch: quiet shows nothing (Start over too); shown shows every message, stacked; the controls and the key I switch it", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { toast("one"); toast("two"); $("initBtn").click(); $("initBtn").click(); });
    expect(await page.evaluate(() => $("toast").hidden)).toBe(true);
    await page.click("#menuBtn"); await page.click('#strip [data-set-level="3"]'); await page.click("#msgModeBtn");   // Everything → View
    expect(await page.evaluate(() => [$("msgModeBtn").getAttribute("aria-pressed"), msgsLoud])).toEqual(["true", true]);
    await page.evaluate(() => { toast("Lock on"); toast("Morph off"); toast("Loop 2 took its rhythm"); });
    expect(await page.evaluate(() => [...$("toast").children].map((d) => d.textContent).slice(-3))).toEqual(["Lock on", "Morph off", "Loop 2 took its rhythm"]);
    await page.click("#drawerClose"); await page.mouse.click(5, 400);
    await page.keyboard.press("i");
    expect(await page.evaluate(() => [msgsLoud, $("toast").hidden])).toEqual([false, true]);
    await context.close();
  });

  it("with 'Show them as they happen' on, a message is on top of whatever is open: the drawer, a loop's settings, a shelf, the log", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { toast("one"); });
    await page.click("#msgBtn"); await page.click("#msgLoudBtn");
    const onTop = () => page.evaluate(() => {
      const t = $("toast"); if (t.hidden) return "hidden";
      t.style.pointerEvents = "auto"; const r = t.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); t.style.pointerEvents = "";
      return t.contains(top) ? "on top" : `under ${top.id || top.className}`;
    });
    expect(await onTop()).toBe("on top");                                      // its own confirmation, over the log
    await page.keyboard.press("Escape");
    for (const open of [() => setDrawer(true), () => openInspector(loops[1]), () => openShelf("toybox"), () => openShelf("scenes")]) {
      await page.evaluate((src) => { closeInspector(); closeShelf(); setDrawer(false); (0, eval)(`(${src})`)(); toast("Lock on"); }, open.toString());
      expect(await onTop()).toBe("on top");
    }
    await context.close();
  });

  it("during a replay, the timer and Stop shrink to a dot after a moment; the dot brings them back", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600);
    await page.keyboard.press("Shift+Space"); await page.waitForTimeout(400);
    await page.evaluate(() => dropToy("ring", [300, 300]));
    await page.waitForTimeout(5500);                                         // a take longer than the 3 s before the bar shrinks
    await page.keyboard.press("Shift+Space");
    await page.waitForFunction(() => loadFlows().length > 0);
    await page.evaluate(() => { closeShelf(); startReplay(loadFlows()[0]); });
    await page.waitForFunction(() => !$("replayBar").hidden && !$("replayBar").classList.contains("mini"));
    await page.waitForFunction(() => $("replayBar").classList.contains("mini"), null, { timeout: 6000 });
    await page.click("#replayMini");
    expect(await page.evaluate(() => [$("replayBar").classList.contains("mini"), document.activeElement.id])).toEqual([false, "replayStop"]);
    await context.close();
  }, 30_000);
});

describe.skipIf(!browser)("Twirl · keyboard in panels, and diagnostics", () => {
  it("Tab wraps inside a loop's settings and never leaves for the address bar; ` closes a dropdown's panel", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(5, 400);
    await page.keyboard.press("1"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "inspTitle");
    const seen = new Set();
    for (let i = 0; i < 80; i++) { await page.keyboard.press("Tab"); seen.add(await page.evaluate(() => $("inspWrap").contains(document.activeElement))); }
    expect([...seen]).toEqual([true]);                                          // always inside
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => $("inspWrap").contains(document.activeElement))).toBe(true);
    await page.focus("#inspPen"); await page.keyboard.press("`");
    expect(await page.evaluate(() => $("inspWrap").hidden)).toBe(true);
    await context.close();
  });

  it("diagnostics: Q shows load, notes a second, errors and where the last tap landed; errors are caught", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600);
    await page.evaluate(() => setTimeout(() => { throw new Error("test boom"); }, 0));
    await page.waitForTimeout(100);
    await page.keyboard.press("q"); await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({ text: $("perf").textContent, rep: diagReport() }));
    expect(r.text).toMatch(/notes\/s/); expect(r.text).toMatch(/last tap: #sheet/); expect(r.text).toMatch(/errors: 1/);
    expect(r.rep.errors[0]).toMatch(/test boom/);
    expect(Object.keys(r.rep)).toEqual(expect.arrayContaining(["fps", "notesPerSecond", "memory", "lastTap", "panels"]));
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · Space is Play/Pause (outside panels), whatever has the focus", () => {
  const spaceDoes = async (page) => {
    const before = await page.evaluate(() => [ctx.state, !!(recorder || flowRec)]);
    await page.keyboard.press("Space"); await page.waitForTimeout(350);
    const after = await page.evaluate(() => [ctx.state, !!(recorder || flowRec)]);
    return before[1] !== after[1] ? "recording" : before[0] !== after[0] ? "play/pause" : "nothing";
  };
  const fresh = async () => { const o = await openTwirl(browser); await o.page.mouse.click(600, 650); await o.page.waitForTimeout(150); return o; };

  it("with Rec focused, after recording by key, after the Takes shelf, after the messages: Space plays or pauses", async () => {
    for (const setup of [
      (p) => p.evaluate(() => $("recBtn").focus()),
      async (p) => { await p.keyboard.press("Shift+Space"); await p.waitForTimeout(150); await p.keyboard.press("Shift+Space"); },
      async (p) => { await p.keyboard.press("Shift+Space"); await p.waitForTimeout(150); await p.keyboard.press("Shift+Space"); await p.keyboard.press("Escape"); },
      async (p) => { await p.evaluate(() => toast("x")); await p.click("#msgBtn"); await p.keyboard.press("Escape"); },
      (p) => p.evaluate(() => $("loops").children[0].focus()),
    ]) {
      const { page, context } = await fresh();
      await setup(page); await page.waitForTimeout(250);
      expect(await spaceDoes(page)).toBe("play/pause");
      await context.close();
    }
  }, 40_000);

  it("inside an open panel, Space presses the focused button (and never pauses); Enter presses a focused button anywhere", async () => {
    const { page, context } = await fresh();
    await page.keyboard.press("1"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "inspTitle");
    await page.focus("#inspMute");
    const muted0 = await page.evaluate(() => loops[0].muted);
    expect(await spaceDoes(page)).toBe("nothing");
    expect(await page.evaluate(() => loops[0].muted)).toBe(!muted0);          // the button was pressed
    await page.keyboard.press("Escape");
    await page.evaluate(() => $("recBtn").focus()); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
    expect(await page.evaluate(() => !!(recorder || flowRec))).toBe(true);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · moving between loops' settings from the keyboard", () => {
  it("PageDown / PageUp and the ◀ ▶ buttons step through loops' settings; Tab past the last control moves on; ⇧Tab from the title goes back", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(5, 400);
    await page.keyboard.press("1"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === "inspTitle");
    const which = () => page.evaluate(() => loops.indexOf(insp));
    await page.keyboard.press("PageDown"); expect(await which()).toBe(1);
    await page.keyboard.press("PageUp"); expect(await which()).toBe(0);
    await page.click("#inspNext"); expect(await which()).toBe(1);
    await page.keyboard.press("Shift+Tab"); expect(await which()).toBe(0);            // from the title: the previous loop
    const n = await page.evaluate(() => focusables($("inspWrap")).length);
    for (let i = 0; i <= n; i++) await page.keyboard.press("Tab");                    // through every control, then one more
    expect(await which()).toBe(1);                                                  // past the last control: the next loop
    expect(await page.evaluate(() => document.activeElement.id)).toBe("inspTitle");
    await context.close();
  });

  it("two digits quickly pick loops 10 to 14", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.dice = false; while (loops.length < 12) dropToy("ring", [100 + loops.length * 40, 600]); });
    await page.mouse.click(5, 300);
    await page.keyboard.press("1"); expect(await page.evaluate(() => loops.indexOf(selected))).toBe(0);
    await page.keyboard.press("2"); expect(await page.evaluate(() => loops.indexOf(selected))).toBe(11);   // loop 12
    await page.waitForTimeout(800); await page.keyboard.press("1"); await page.waitForTimeout(800); await page.keyboard.press("2");
    expect(await page.evaluate(() => loops.indexOf(selected))).toBe(1);                                    // slowly: loop 2
    await context.close();
  });

  it("a note at zero loudness (a fade's last moment) is simply not made: no error", async () => {
    const { page, context, errors } = await openTwirl(browser);
    await page.evaluate(() => { ensureAudio(); sound("pluck", 0.5, 0.5, 0, ctx.currentTime + 0.1, 0); env(ctx.createGain(), ctx.currentTime + 0.1, 0, 0.2); });
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
    await context.close();
  });
});
