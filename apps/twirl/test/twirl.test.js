/**
 * Twirl's behaviour, held in place before the roadmap starts changing things.
 *
 * The first block is the one that matters most: "draw and hear it" (ROADMAP:
 * "Preserve the immediate draw-and-hear interaction"). Every experiment on the
 * roadmap — collisions, personalities, other pitch spaces — has to keep it
 * passing. The rest pins what mutation, saving and sharing promise, and holds
 * Twirl to the suite's shared contracts (Barlow vectors, leftmost-LSB masks).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { launch, openTwirl, drawStroke, listen, heard, loopPoint } from "./harness.js";

const browser = await launch();
// These tests run in real time (sound, playheads, meetings), some for several
// beats: Vitest's 5-second default is too short for them, on a busy CI runner most.
vi.setConfig({ testTimeout: 30_000 });
afterAll(() => browser?.close());

describe.skipIf(!browser)("Twirl · first contact", () => {
  it("opens with no errors, three example loops and the hint", async () => {
    const { page, context, errors } = await openTwirl(browser);
    expect(await page.evaluate(() => loops.length)).toBe(3);
    expect(await page.isVisible("#hint")).toBe(true);
    expect(await page.title()).toBe("Twirl");
    expect(await page.getAttribute("html", "lang")).toBe("en");
    expect(errors).toEqual([]);
    await context.close();
  });

  it("a stroke sounds while it is being drawn, within a grid step of the touch", async () => {
    const { page, context, errors } = await openTwirl(browser);
    await listen(page);
    let duringStroke = 0;
    await drawStroke(page, { beforeUp: async () => { duringStroke = (await heard(page)).length; } });
    const notes = await heard(page);
    expect(await page.evaluate(() => ctx && ctx.state)).toBe("running");
    expect(duringStroke).toBeGreaterThan(2);                 // heard as drawn, not after release
    // "Immediate": each note is scheduled no later than one grid step (1/16 at
    // 96 bpm = 0.156 s) after it was drawn, plus a little scheduling slack.
    const step = await page.evaluate(() => 60 / state.bpm / (perBeat() || 4));
    for (const n of notes) expect(n.at - n.asked).toBeLessThanOrEqual(step + 0.03);
    expect(await page.isVisible("#hint")).toBe(false);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("the stroke becomes a loop that plays again on its own", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { ensureAudio(); loops.forEach((l) => (l.muted = true)); });   // only the new loop should sound
    await drawStroke(page, { ms: 600 });
    const { n, beats, bpm } = await page.evaluate(() => ({ n: loops.length, beats: loopBeats(loops.at(-1)), bpm: state.bpm }));
    expect(n).toBe(4);
    await listen(page);
    await page.waitForTimeout(((beats * 60) / bpm) * 1000 + 600);   // one full pass, and then some
    expect((await heard(page)).length).toBeGreaterThan(0);
    await context.close();
  });

  it("with Lock on, a stroke still sounds as it is drawn (read on the grid)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { ensureAudio(); $("lockBtn").click(); });
    await listen(page);
    let during = 0;
    await drawStroke(page, { beforeUp: async () => { during = (await heard(page)).length; } });
    expect(during).toBeGreaterThan(0);
    await context.close();
  });

  it("a tap on a loop mutes it rather than drawing a new one", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.morph = false; ensureAudio(); });    // hold still while we aim
    const [x, y] = await loopPoint(page, 0, 40);
    await page.mouse.click(x, y);
    await page.waitForTimeout(450);                                          // past the double-tap window
    expect(await page.evaluate(() => [loops.length, loops[0].muted])).toEqual([3, true]);
    await context.close();
  });

  it("the toybox makes sound from the keyboard alone (no drawing needed)", async () => {
    const { page, context } = await openTwirl(browser);
    await page.keyboard.press("t");
    await page.keyboard.press("Tab");          // tablist → Close
    await page.focus('[data-toy="ring"]');
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => loops.length)).toBe(4);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · mutation and inheritance", () => {
  let page, context;
  beforeAll(async () => ({ page, context } = await openTwirl(browser)));
  afterAll(() => context?.close());

  it("a child inherits the parent's musical identity and leaves the parent untouched", async () => {
    const r = await page.evaluate(() => {
      const parent = loops[0];
      Object.assign(parent, { chord: "triad", rhythm: "euclid", dir: "pingpong", every: 2, wait: 1, zone: "low", gain: 0.7, pen: "bell" });
      const before = JSON.stringify(loopData(parent));
      mutateLoop(parent);
      const child = loops.at(-1);
      const pick = (l) => ({ pen: l.pen, chord: l.chord, rhythm: l.rhythm, dir: l.dir, every: l.every, wait: l.wait, zone: l.zone, gain: l.gain, ts: l.ts, temper: l.temper, trigger: l.trigger, L: l.L });
      return { same: JSON.stringify(loopData(parent)) === before, parent: pick(parent), child: pick(child),
        gen: child.generation, lineage: child.lineage, uid: parent.uid, nEv: [parent.events.length, child.events.length],
        offsOk: child.events.every((e) => e.off >= 0 && e.off < child.L), sorted: child.events.every((e, i, a) => !i || a[i - 1].off <= e.off) };
    });
    expect(r.same).toBe(true);
    expect(r.child).toEqual(r.parent);
    expect(r.gen).toBe(1);
    expect(r.lineage).toBe(r.uid);
    expect(r.nEv[1]).toBe(r.nEv[0]);
    expect(r.offsOk && r.sorted).toBe(true);
  });

  it("generations count up and keep the family's lineage", async () => {
    const r = await page.evaluate(() => {
      const g1 = loops.at(-1); mutateLoop(g1); const g2 = loops.at(-1); mutateLoop(g2); const g3 = loops.at(-1);
      return [g1, g2, g3].map((l) => [l.generation, l.lineage]);
    });
    expect(r.map((x) => x[0])).toEqual([1, 2, 3]);
    expect(new Set(r.map((x) => x[1])).size).toBe(1);
  });

  it("repeated mutation respects the 14-loop cap and never leaves a stale selection", async () => {
    const r = await page.evaluate(() => {
      for (let i = 0; i < 25; i++) mutateLoop(loops.at(-1));
      return { n: loops.length, cap: MAX_LOOPS, selOk: selected === null || loops.includes(selected) };
    });
    expect(r.n).toBe(r.cap);
    expect(r.selOk).toBe(true);
  });

  it("Mutate is offered from More up, not at Simple", async () => {
    await page.evaluate(() => { setLevel(1); openInspector(loops[0]); });
    expect(await page.isVisible("#inspMutate")).toBe(false);
    await page.evaluate(() => setLevel(2));
    expect(await page.isVisible("#inspMutate")).toBe(true);
    await page.evaluate(() => closeInspector());
  });
});

describe.skipIf(!browser)("Twirl · saving and sharing keep what they promise", () => {
  let page, context;
  beforeAll(async () => {
    ({ page, context } = await openTwirl(browser));
    await page.evaluate(() => { mutateLoop(loops[0]); mutateLoop(loops.at(-1)); loops[1].chord = "seventh"; loops[2].dir = "rev"; });
  });
  afterAll(() => context?.close());

  it("a share code round-trips every loop, including its generation and family", async () => {
    const r = await page.evaluate(async () => {
      const sc = serialize(), back = await decodeScene(await encodeScene(sc));
      const pick = (d) => [d.generation, d.lineage, d.chord, d.rhythm, d.dir, d.every, d.wait, d.events.length, d.L];
      return { a: sc.loops.map(pick), b: back.loops.map(pick), settings: [sc.settings.grid, back.settings.grid] };
    });
    expect(r.b).toEqual(r.a);
    expect(r.settings[1]).toBe(r.settings[0]);
  });

  it("codes made before generations existed still open (as generation 0)", async () => {
    const r = await page.evaluate(async () => {
      const pk = packScene(serialize());
      pk.l = pk.l.map((row) => row.slice(0, 24));             // the 24 fields older codes carried
      const back = unpackScene(pk);
      return back.loops.map((d) => [d.generation, d.lineage]);
    });
    expect(r.every(([g, l]) => g === 0 && l === null)).toBe(true);
  });

  it("a kept toy carries its generation, and brings it back when dropped", async () => {
    const r = await page.evaluate(() => {
      const child = loops.find((l) => l.generation === 2);
      keepToy(child);
      const toy = loadToys()[0];
      dropSavedToy(toy);
      return [child.generation, toy.generation, loops.at(-1).generation];
    });
    expect(r).toEqual([2, 2, 2]);
  });

  it("a scene saves and recalls the same sheet", async () => {
    const r = await page.evaluate(() => {
      const sc = serialize(); const n = sc.loops.length;
      recall(JSON.parse(JSON.stringify(sc)));
      return [n, loops.length, loops.map((l) => l.generation).join(","), sc.loops.map((d) => d.generation).join(",")];
    });
    expect(r[1]).toBe(r[0]);
    expect(r[2]).toBe(r[3]);
  });

  it("a take's code round-trips as a valid playflow", async () => {
    const ok = await page.evaluate(async () => {
      const flow = { v: 1, st: serialize().settings, beats: 8, fr: [{ b: 0, add: [[1, packScene({ settings: {}, loops: [loopData(loops[0])] }).l[0], 0]] }] };
      return validFlow(await unpackToken(await packToken(flow, "f")));
    });
    expect(ok).toBe(true);
  });
});

describe.skipIf(!browser)("Twirl · the suite's shared contracts", () => {
  let page, context;
  beforeAll(async () => ({ page, context } = await openTwirl(browser)));
  afterAll(() => context?.close());

  it("Air's Barlow indispensability matches packages/theory/vectors/rhythm.json", async () => {
    const vectors = JSON.parse(readFileSync(new URL("../../../packages/theory/vectors/rhythm.json", import.meta.url), "utf8"));
    expect(vectors.barlowTables.length).toBeGreaterThan(0);
    for (const c of vectors.barlowTables) {
      const table = await page.evaluate((n) => [...Array(n)].map((_, i) => indispensability(i, n)), c.length);
      expect(table, `${c.length} steps`).toEqual(c.table);
    }
  });

  it("scale grids are leftmost-LSB masks (CONVENTIONS.md): Ionian 2741, Lydian 2773", async () => {
    const r = await page.evaluate(() => ({ ionian: GRID.ionian.pcs, lydian: GRID.lydian.pcs, mask: fromMask(2741) }));
    expect(r.ionian).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(r.mask).toEqual(r.ionian);
    expect(r.lydian).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });

  it("every grid rises within its period, and every tuning has 12 rising steps from 0", async () => {
    const r = await page.evaluate(() => ({
      grids: GRIDS.map((g) => { const s = stepsOf(g); return [g.id, s[0] === 0 && s.every((v, i) => !i || v > s[i - 1]) && s.at(-1) < periodOf(g)]; }),
      tunings: Object.entries(TUNINGS).map(([k, t]) => [k, t.length === 12 && t[0] === 0 && t.every((v, i) => !i || v > t[i - 1]) && t[11] < 1200]),
    }));
    for (const [id, ok] of [...r.grids, ...r.tunings]) expect(ok, id).toBe(true);
  });
});

/* Two still lines crossing at the middle of the sheet, drawn to take the same
 * time, starting together: their playheads meet at the crossing, once a pass. */
const crossing = (page, a = {}, b = {}) => page.evaluate(([a, b]) => {
  ensureAudio(); state.morph = false; state.bpm = 120;
  loops.splice(0).forEach(fadeOut);
  const line = (x0, y0, x1, y1, extra) => {
    const s = newStroke(nextStart() + 1);
    for (let i = 0; i <= 40; i++) { const u = i / 40; s.pts.push({ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, b: u * 1.9 }); }
    s.events.push({ off: 0, x: x0, y: y0, heading: 0, fixed: null, vel: 0.6, ms: 0, flashAt: -1 });
    finishStroke(s, false); Object.assign(s, { temper: "still", dir: "fwd", rhythm: "drawn", meets: "sound" }, extra);
    return s.uid;
  };
  meetLog.length = 0; touchLog.length = 0;
  return [line(0.3, 0.5, 0.7, 0.5, a), line(0.5, 0.3, 0.5, 0.7, b)];
}, [a, b]);
const waitBeats = (page, n) => page.waitForTimeout((n * 60 / 120) * 1000);

describe.skipIf(!browser)("Twirl · contacts (crossing a line, meeting a playhead)", () => {
  it("two playheads that reach the same place at the same time meet, and both sound", async () => {
    const { page, context, errors } = await openTwirl(browser);
    await crossing(page);
    await listen(page);
    await waitBeats(page, 5.2);
    const log = await page.evaluate(() => meetLog.slice());
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect((await heard(page)).length).toBeGreaterThanOrEqual(2);         // one note from each loop
    expect(errors).toEqual([]);
    await context.close();
  });

  it("a new loop meets with 'sound' by default; Meets: no, or Meet off, and nothing happens", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.dice = false; });
    await drawStroke(page, { ms: 400 });
    expect(await page.evaluate(() => [loops.at(-1).meets, loops.at(-1).dir, loops.at(-1).rhythm])).toEqual(["sound", "fwd", "drawn"]);
    await crossing(page, { meets: "ignore" });
    await waitBeats(page, 5.2);
    expect(await page.evaluate(() => meetLog.length)).toBe(0);
    await crossing(page);
    await page.evaluate(() => { state.meet = false; });
    await waitBeats(page, 5.2);
    expect(await page.evaluate(() => meetLog.length)).toBe(0);
    await context.close();
  });

  it("a playhead crossing another loop's line sounds there; 'no' stays out of it", async () => {
    const { page, context } = await openTwirl(browser);
    const [a, b] = await crossing(page, {}, { meets: "ignore" });
    await waitBeats(page, 5.2);
    const log = await page.evaluate(() => touchLog.slice());
    expect(log.some((t) => t.x === a && t.y === b)).toBe(true);
    expect(log.some((t) => t.x === b)).toBe(false);
    await context.close();
  });

  it("bump: the line it crosses is nudged along the playhead's way, and stays on the sheet", async () => {
    const { page, context } = await openTwirl(browser);
    const [, b] = await crossing(page, { meets: "bump" });
    const tx0 = await page.evaluate((b) => loops.find((l) => l.uid === b).tx, b);
    await waitBeats(page, 5.2);
    const r = await page.evaluate((b) => { const B = loops.find((l) => l.uid === b); return { tx: B.tx, ty: B.ty, did: touchLog.map((t) => t.did), cx: B.c.x }; }, b);
    expect(r.did).toContain("bump");
    expect(r.tx).toBeGreaterThan(tx0);                                    // A runs left to right: B goes right
    expect(Math.abs(r.ty)).toBeLessThan(0.01);
    expect(r.cx + r.tx).toBeLessThanOrEqual(0.95);
    await context.close();
  });

  it("Surprise: new loops' direction, rhythm and Meets are drawn at random, mostly the usual; toys keep their feel", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      state.dice = true;
      const n = 600, tally = (f) => { const c = {}; for (let i = 0; i < n; i++) { const v = f(); c[v] = (c[v] || 0) + 1; } return c; };
      const out = { dir: tally(pickDir), rhythm: tally(pickRhythm), meets: tally(pickMeets) };
      loops.splice(0).forEach(fadeOut);
      for (let i = 0; i < 6; i++) { dropToy("shaker", [100 + i * 30, 200]); dropToy("beat", [100 + i * 30, 400]); }
      out.toys = [...new Set(loops.map((l) => l.dir + "/" + l.rhythm))];
      state.dice = false; out.off = [pickDir(), pickRhythm(), pickMeets()];
      return out;
    });
    expect(r.dir.fwd / 600).toBeGreaterThan(0.55);
    expect(Object.keys(r.dir).sort()).toEqual(["fwd", "pingpong", "rev"]);
    expect(Object.keys(r.rhythm).sort()).toEqual(["drawn", "euclid", "even"]);
    expect(Object.keys(r.meets).sort()).toEqual(["breed", "bump", "sound", "trade"]);
    expect(r.toys).toEqual(["fwd/drawn"]);
    expect(r.off).toEqual(["fwd", "drawn", "sound"]);
    await context.close();
  });

  it("trade: a loop borrows one thing it doesn't share from the loop it meets", async () => {
    const { page, context } = await openTwirl(browser);
    const [, b] = await crossing(page, { chord: "triad" }, { meets: "trade", chord: "single" });
    await waitBeats(page, 5.2);
    const r = await page.evaluate((b) => { const B = loops.find((l) => l.uid === b); return [B.chord, meetLog.flatMap((m) => m.did)]; }, b);
    expect(r[0]).toBe("triad");
    expect(r[1].join(" ")).toMatch(/took its chords/);
    await context.close();
  });

  it("breed: a meeting has one child (a mutation of the breeder), then waits before another", async () => {
    const { page, context } = await openTwirl(browser);
    const [a] = await crossing(page, { meets: "breed" });
    await waitBeats(page, 5.2);
    const one = await page.evaluate((a) => ({ n: loops.length, child: loops.at(-1).generation, lineage: loops.at(-1).lineage, a }), a);
    expect(one.n).toBe(3);
    expect(one.child).toBe(1);
    expect(one.lineage).toBe(a);
    await waitBeats(page, 4.5);                                            // more meetings, inside the 8-bar wait
    expect(await page.evaluate(() => loops.length)).toBe(3);
    await context.close();
  });

  it("breeding never pushes a loop out at the 14-loop cap", async () => {
    const { page, context } = await openTwirl(browser);
    await crossing(page, { meets: "breed" });
    await page.evaluate(() => { while (loops.length < MAX_LOOPS) dropToy("ring", [60, 60]); loops.slice(2).forEach((l) => (l.meets = "ignore")); });
    const before = await page.evaluate(() => loops.map((l) => l.uid).join());
    await waitBeats(page, 5.2);
    expect(await page.evaluate(() => [loops.length, meetLog.length > 0])).toEqual([14, true]);
    expect(await page.evaluate(() => loops.map((l) => l.uid).join())).toBe(before);
    await context.close();
  });

  it("Meets and Notes travel in share codes; older codes meet with 'sound'", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      loops[0].meets = "breed"; loops[1].meets = "bump"; retrace(loops[0], "dense");
      const back = await decodeScene(await encodeScene(serialize()));
      const pk = packScene(serialize()); pk.l = pk.l.map((row) => row.slice(0, 24));
      return { meets: back.loops.map((d) => d.meets), dens: back.loops[0].density, old: unpackScene(pk).loops.map((d) => d.meets) };
    });
    expect(r.meets.slice(0, 2)).toEqual(["breed", "bump"]);
    expect(r.dens).toBe("dense");
    expect(new Set(r.old)).toEqual(new Set(["sound"]));
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · notes: few by default, re-spaced per loop", () => {
  it("new strokes default to few notes", async () => {
    const { page, context } = await openTwirl(browser);
    expect(await page.evaluate(() => [state.density, $("density").selectedOptions[0].textContent])).toEqual(["sparse", "Notes: few"]);
    await context.close();
  });

  it("a loop's notes can be re-spaced: many gives more than few, along the same path, in order", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const lp = loops.find((l) => !l.events.some((e) => e.fixed));      // the spiral
      retrace(lp, "sparse", 0); const few = lp.events.length;
      retrace(lp, "dense", 0); const many = lp.events.length;
      return { few, many, ok: lp.events.every((e, i, a) => e.off >= 0 && e.off < lp.L && (!i || a[i - 1].off <= e.off)), d: lp.density };
    });
    expect(r.many).toBeGreaterThan(r.few);
    expect(r.ok).toBe(true);
    expect(r.d).toBe("dense");
    await context.close();
  });

  it("shakers and beats keep their fixed notes", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => { const sh = loops.find((l) => l.events.some((e) => e.fixed === "shake")); const n = sh.events.length; return [retrace(sh, "dense"), sh.events.length === n]; });
    expect(r).toEqual([false, true]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · Edit notes", () => {
  it("a tap anywhere on a path adds a note, even right by a bend handle", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.morph = false; ensureAudio(); hint.hidden = true; $("editBtn").click(); });
    for (const j of [7, 23, 39, 41]) {                         // 39 = 3 × handleStep(13): on a handle
      const [x, y, n] = await page.evaluate((j) => { const lp = loops[0], q = lp.pts[j]; return [...place(lp, q.x, q.y, sheet.clientWidth, sheet.clientHeight), lp.events.length]; }, j);
      const onNote = await page.evaluate(([x, y]) => !!hitEvent(x, y), [x, y]);
      await page.mouse.click(x, y); await page.waitForTimeout(80);
      expect(await page.evaluate(() => loops[0].events.length), `point ${j}`).toBe(onNote ? n - 1 : n + 1);
    }
    await context.close();
  });
});
