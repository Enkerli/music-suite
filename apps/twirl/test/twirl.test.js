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
  // ONE start for both: asked separately, a beat boundary between the two calls
  // started them a beat apart, half a pass out of phase, and they never met (CI).
  const st = nextStart() + 1;
  const line = (x0, y0, x1, y1, extra) => {
    const s = newStroke(st);
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
    await page.waitForFunction(() => meetLog.length > 0, null, { timeout: 20_000 });
    const log = await page.evaluate(() => meetLog.slice());
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect((await heard(page)).length).toBeGreaterThanOrEqual(2);         // one note from each loop
    expect(errors).toEqual([]);
    await context.close();
  });

  it("a new loop meets with 'sound' by default; Meets: no, or Meet off, and nothing happens", async () => {
    const { page, context } = await openTwirl(browser);
    // A new loop's defaults with Surprise off, checked on the stroke itself (on a slow
    // CI machine a drawn stroke may not land, and the last loop was a starting toy).
    expect(await page.evaluate(() => { state.dice = false; const s = newStroke(nextStart()); return [s.meets, s.dir, s.rhythm]; })).toEqual(["sound", "fwd", "drawn"]);
    // The starting sheet is played plainly, Surprise or not.
    expect(await page.evaluate(() => loops.map((l) => [l.meets, l.dir, l.rhythm].join()))).toEqual(Array(3).fill("sound,fwd,drawn"));
    await crossing(page, { meets: "ignore" });
    await waitBeats(page, 5.2);
    expect(await page.evaluate(() => meetLog.length)).toBe(0);
    await page.evaluate(() => { state.meet = false; });                       // off first: under load, the playheads can meet before the next step
    await crossing(page);
    await waitBeats(page, 5.2);
    expect(await page.evaluate(() => meetLog.length)).toBe(0);
    await context.close();
  });

  it("a playhead crossing another loop's line sounds there; 'no' stays out of it", async () => {
    const { page, context } = await openTwirl(browser);
    const [a, b] = await crossing(page, {}, { meets: "ignore" });
    await page.waitForFunction(([a, b]) => touchLog.some((t) => t.x === a && t.y === b), [a, b], { timeout: 20_000 });
    await waitBeats(page, 2);                                              // and a little more, for B to (not) answer
    const log = await page.evaluate(() => touchLog.slice());
    expect(log.some((t) => t.x === a && t.y === b)).toBe(true);
    expect(log.some((t) => t.x === b)).toBe(false);
    await context.close();
  });

  it("bump: the line it crosses is nudged along the playhead's way, and stays on the sheet", async () => {
    const { page, context } = await openTwirl(browser);
    const [, b] = await crossing(page, { meets: "bump" });
    const tx0 = await page.evaluate((b) => loops.find((l) => l.uid === b).tx, b);
    await page.waitForFunction(() => touchLog.some((t) => t.did === "bump"), null, { timeout: 20_000 });
    await waitBeats(page, 1);                                              // let the push ease out
    const r = await page.evaluate((b) => { const B = loops.find((l) => l.uid === b); return { tx: B.tx, ty: B.ty, did: touchLog.map((t) => t.did), cx: B.c.x }; }, b);
    expect(r.did).toContain("bump");
    expect(r.tx).toBeGreaterThan(tx0);                                    // A runs left to right: B goes right
    expect(Math.abs(r.ty)).toBeLessThan(0.01);
    expect(r.cx + r.tx).toBeLessThanOrEqual(0.95);
    await context.close();
  });

  it("lines touching: a contact only when they come into touch, not where they started; bump pushes apart", async () => {
    const { page, context } = await openTwirl(browser);
    const [a, b] = await crossing(page, { muted: true }, { muted: true });     // muted: no playheads, only lines
    await page.evaluate(([a, b]) => { lineLog.length = 0; }, [a, b]);
    await waitBeats(page, 1);
    expect(await page.evaluate(() => lineLog.length)).toBe(0);                // drawn crossing: noted, not a contact
    await page.evaluate((b) => { loops.find((l) => l.uid === b).tx = 0.3; }, b);   // pull B clear of A…
    await waitBeats(page, 1);
    await page.evaluate((b) => { const B = loops.find((l) => l.uid === b); B.tx = 0; B.muted = false; B.meets = "bump"; }, b);   // …and back: contact
    await waitBeats(page, 1.5);
    const r = await page.evaluate((a) => ({ log: lineLog.slice(), tx: loops.find((l) => l.uid === a).tx }), a);
    expect(r.log.length).toBe(1);
    expect(r.log[0].did).toContain("bump");
    expect(Math.abs(r.tx)).toBeGreaterThan(0);                                 // A was pushed away from B
    await context.close();
  });

  it("infect: a child at any contact, then the 8-bar wait; plain breed only when playheads meet", async () => {
    const { page, context } = await openTwirl(browser);
    const [a, b] = await crossing(page, { muted: true }, { muted: true, meets: "breed" });
    await page.evaluate((b) => { loops.find((l) => l.uid === b).tx = 0.3; }, b);
    await waitBeats(page, 1);
    await page.evaluate((b) => { loops.find((l) => l.uid === b).tx = 0; }, b);
    await waitBeats(page, 1.5);
    expect(await page.evaluate(() => [loops.length, lineLog.length])).toEqual([2, 1]);   // breed: lines touching isn't enough
    await page.evaluate(([a, b]) => { const A = loops.find((l) => l.uid === a); A.meets = "infect"; A.muted = false; loops.find((l) => l.uid === b).tx = 0.3; }, [a, b]);
    await waitBeats(page, 1);
    await page.evaluate((b) => { loops.find((l) => l.uid === b).tx = 0; }, b);
    await waitBeats(page, 1.5);
    const r = await page.evaluate((a) => ({ n: loops.length, lineage: loops.at(-1).lineage, meets: loops.at(-1).meets }), a);
    expect(r.n).toBe(3);
    expect(r.lineage).toBe(a);
    expect(r.meets).toBe("sound");                                             // a child never inherits breeding
    await waitBeats(page, 4);                                                  // more contacts, inside the wait
    expect(await page.evaluate(() => loops.length)).toBe(3);
    await context.close();
  });

  it("Vary: no two notes quite alike (loudness, timing, cents, colour); off, every repeat the same; MIDI stays on whole notes", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      ensureAudio();
      const t = ctx.currentTime + 0.5, on = [], off = [];
      state.vary = true; for (let i = 0; i < 20; i++) on.push([...varied(0.6, t, 60), nuance]);
      state.vary = false; for (let i = 0; i < 5; i++) off.push([...varied(0.6, t, 60), nuance]);
      const sent = []; const real = window.sendMidi; window.sendMidi = (...a) => sent.push(a[1]);
      state.vary = true; sound("pluck", 0.5, 0.5, 0.6, t, 0); window.sendMidi = real;
      return { on, off, sent, t };
    });
    expect(new Set(r.on.map((x) => x.join())).size).toBe(20);
    for (const [v, at, m, n] of r.on) {
      expect(Math.abs(v / 0.6 - 1)).toBeLessThanOrEqual(0.16 + 1e-9);
      expect(Math.abs(at - r.t)).toBeLessThanOrEqual(0.007 + 1e-9);
      expect(Math.abs(m - 60)).toBeLessThanOrEqual(0.06 + 1e-9);
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
    }
    expect(r.off.every(([v, at, m, n]) => v === 0.6 && at === r.t && m === 60 && n === 0)).toBe(true);
    expect(r.sent.every(Number.isInteger)).toBe(true);
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
    expect(Object.keys(r.meets).sort()).toEqual(["bump", "sound", "trade"]);       // never breed or infect: chosen by hand
    expect(r.toys).toEqual(["fwd/drawn"]);
    expect(r.off).toEqual(["fwd", "drawn", "sound"]);
    await context.close();
  });

  it("trade: a loop borrows one thing it doesn't share from the loop it meets", async () => {
    const { page, context } = await openTwirl(browser);
    const [, b] = await crossing(page, { chord: "triad" }, { meets: "trade", chord: "single" });
    await page.waitForFunction((b) => loops.find((l) => l.uid === b).chord === "triad", b, { timeout: 20_000 });   // the event, not a fixed time: CI runs slow
    const r = await page.evaluate((b) => { const B = loops.find((l) => l.uid === b); return [B.chord, meetLog.flatMap((m) => m.did)]; }, b);
    expect(r[0]).toBe("triad");
    expect(r[1].join(" ")).toMatch(/took its chords/);
    await context.close();
  });

  it("breed: a meeting has one child (a mutation of the breeder), then waits before another", async () => {
    const { page, context } = await openTwirl(browser);
    const [a] = await crossing(page, { meets: "breed" });
    await page.waitForFunction(() => loops.length === 3, null, { timeout: 20_000 });
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
    // The rule under test is the cap, not the detection (tested above): meet directly.
    await page.evaluate(() => { const W = sheet.clientWidth, H = sheet.clientHeight, p = { x: W / 2, y: H / 2, heading: 0 }; meet(loops[0], p, loops[1], p, nowBeat(), ctx.currentTime, W, H); });
    expect(await page.evaluate(() => [loops.length, meetLog.length > 0])).toEqual([14, true]);
    expect(await page.evaluate(() => loops.map((l) => l.uid).join())).toBe(before);
    await context.close();
  });

  it("Meets and Notes travel in share codes; older codes meet with 'sound'", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      loops[1].meets = "breed"; loops[2].meets = "infect"; retrace(loops[1], "dense");    // loops[0] is the chimes: fixed notes
      const back = await decodeScene(await encodeScene(serialize()));
      const pk = packScene(serialize()); pk.l = pk.l.map((row) => row.slice(0, 24));
      return { meets: back.loops.slice(1).map((d) => d.meets), dens: back.loops[1].density, old: unpackScene(pk).loops.map((d) => d.meets) };
    });
    expect(r.meets.slice(0, 2)).toEqual(["breed", "infect"]);
    expect(r.dens).toBe("dense");
    expect(new Set(r.old)).toEqual(new Set(["sound"]));
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · chimes, sounds across banks, Start over", () => {
  it("the starting sheet is chimes, a drop and a shaker; the chimes bring their own sound", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => loops.map((l) => [l.pack || null, l.events.every((e) => e.fixed === "bell"), l.L]));
    expect(r.length).toBe(3);
    expect(r[0][0]).toBe("chimes");
    expect(r[0][1]).toBe(true);
    expect(r[0][2]).toBeGreaterThanOrEqual(11);                              // a long, odd cycle
    expect(r.slice(1).map((x) => x[0])).toEqual([null, null]);
    await context.close();
  });

  it("a loop with its own sounds plays them, whatever the sheet's pack; they travel in codes", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      ensureAudio(); state.pack = "chip";
      const used = []; const keep = { ...PACKS };
      for (const k of Object.keys(PACKS)) PACKS[k] = new Proxy(keep[k], { get: (o, v) => (used.push(k + "." + String(v)), o[v]) });
      const lp = loops[1]; lp.pack = "mallets";
      sound("pluck", 0.5, 0.5, 0.5, ctx.currentTime + 0.2, 0, undefined, "single", lp.pack);
      sound("pluck", 0.5, 0.5, 0.5, ctx.currentTime + 0.2, 0);
      Object.assign(PACKS, keep);
      const back = await decodeScene(await encodeScene(serialize()));
      return { used, packs: back.loops.map((d) => d.pack) };
    });
    expect(r.used).toEqual(["mallets.pluck", "chip.pluck"]);
    expect(r.packs).toEqual(["chimes", "mallets", null]);
    await context.close();
  });

  it("the sheet never keeps stale pixels: a buffer that's the wrong size is fixed on the next frame, and every pixel is cleared", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      sheet.height = sheet.height + 240;                          // a size change the page wasn't told about
      g2.fillStyle = "#ff0000"; g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillRect(0, 0, sheet.width, sheet.height);
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const dpr = Math.min(2, window.devicePixelRatio || 1), px = g2.getImageData(2, sheet.height - 2, 1, 1).data;
      return { fits: sheet.height === Math.round(sheet.clientHeight * dpr), red: px[0] > 200 && px[1] < 60 && px[2] < 60 };
    });
    expect(r).toEqual({ fits: true, red: false });
    await context.close();
  });

  it("Start over is a first visit: Simple level, no Edit, no numbers, nothing selected, the hint, the drawer closed; Bring it back restores the view too", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { setLevel(3); setNumbers(true); $("editBtn").click(); select(loops[0]); hint.hidden = true; setDrawer(true); });
    const r = await page.evaluate(() => { $("initBtn").click(); $("initBtn").click();
      return { level, numbers: showNumbers, edit: state.edit, sel: selected, hint: !hint.hidden, drawer: document.body.classList.contains("drawer-open"), n: loops.length }; });
    expect(r).toEqual({ level: 1, numbers: false, edit: false, sel: null, hint: true, drawer: false, n: 3 });
    const b = await page.evaluate(() => { $("initBtn").click(); return { level, numbers: showNumbers, edit: state.edit }; });
    expect(b).toEqual({ level: 3, numbers: true, edit: true });
    await context.close();
  });

  it("Start over: the starting sheet and default settings, two taps; Bring it back undoes it", async () => {
    const { page, context } = await openTwirl(browser);
    const before = await page.evaluate(() => { state.bpm = 140; state.grid = "chromatic"; dropToy("ring", [200, 200]); return loops.map((l) => l.uid).join(); });
    await page.evaluate(() => { $("initBtn").click(); });
    expect(await page.evaluate(() => [loops.length, state.bpm, $("initBtn").textContent])).toEqual([4, 140, "Start over?"]);   // one tap only arms it
    const after = await page.evaluate(() => { $("initBtn").click(); return { n: loops.length, bpm: state.bpm, grid: state.grid, chimes: loops[0].pack, label: $("initBtn").textContent }; });
    expect(after).toEqual({ n: 3, bpm: 96, grid: "pentMaj", chimes: "chimes", label: "Bring it back" });
    const back = await page.evaluate(() => { $("initBtn").click(); return { n: loops.length, bpm: state.bpm, grid: state.grid, label: $("initBtn").textContent }; });
    expect(back).toEqual({ n: 4, bpm: 140, grid: "chromatic", label: "Start over" });
    expect(before.split(",").length).toBe(4);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · Life: loops that change over the passes", () => {
  const ring = (page) => page.evaluate(() => {
    loops.splice(0).forEach(fadeOut); state.morph = false;
    dropToy("ring", [sheet.clientWidth / 2, sheet.clientHeight / 2]); const lp = loops[0];
    retrace(lp, "dense", 0); lp.temper = "still"; return lp.events.length;
  });

  it("swell: from its strongest notes to all of them and back; its drawn notes never change", async () => {
    const { page, context } = await openTwirl(browser);
    const n = await ring(page);
    const r = await page.evaluate(() => {
      const lp = loops[0], before = JSON.stringify(lp.events.map((e) => [e.off, e.x, e.y]));
      const playing = (age) => { lp.life = "swell"; lp.age = age; return lp.events.filter((_, i) => lifePlays(lp, i)).length; };
      const out = [0, 4, 8, 12, 16].map(playing);
      lp.life = "steady"; lp.age = 0;
      return { out, same: before === JSON.stringify(lp.events.map((e) => [e.off, e.x, e.y])), steady: lp.events.filter((_, i) => lifePlays(lp, i)).length };
    });
    expect(r.out[0]).toBeLessThan(n / 2);                                  // starts sparse
    expect(r.out[1]).toBeGreaterThan(r.out[0]);                           // fills in
    expect(r.out[2]).toBe(n);                                             // all of them at the top
    expect(r.out[3]).toBeLessThan(n);                                     // thins out again
    expect(r.out[4]).toBe(r.out[0]);                                      // and round again
    expect(r.same).toBe(true);
    expect(r.steady).toBe(n);
    await context.close();
  });

  it("swell keeps the notes that matter most to the beat: the downbeat is always among them", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    const r = await page.evaluate(() => {
      const lp = loops[0]; lp.life = "swell"; lp.age = 0;
      const per = perBeat() || 4, offs = offsOf(lp);
      return lp.events.map((_, i) => [Math.round(offs[i] * per) % (per * BAR) === 0, lifePlays(lp, i)]).filter(([down]) => down).every(([, plays]) => plays);
    });
    expect(r).toBe(true);
    await context.close();
  });

  it("fade: quieter each pass, gone after 16 into undo; ⌘Z brings it back, steady", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    const r = await page.evaluate(() => {
      const lp = loops[0]; lp.life = "fade"; lp.age = 0;
      const vit = []; for (let k = 0; k < 16; k++) { vit.push(lifeState(lp).vital); ageLoop(lp); }
      buryDead();
      const gone = !loops.includes(lp), inUndo = undone.at(-1) === lp;
      redoLoop();
      return { vit, gone, inUndo, back: loops.includes(lp), life: lp.life, age: lp.age };
    });
    expect(r.vit[0]).toBe(1);
    expect(r.vit.every((v, i) => !i || v < r.vit[i - 1])).toBe(true);
    expect(r).toMatchObject({ gone: true, inUndo: true, back: true, life: "steady", age: 0 });
    await context.close();
  });

  it("Evolve off holds every life where it is; muted and held loops don't age", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    const r = await page.evaluate(() => {
      const lp = loops[0]; lp.life = "brief"; lp.age = 3;
      state.evolve = false; ageLoop(lp); const off = lp.age;
      state.evolve = true; lp.muted = true; ageLoop(lp); const muted = lp.age;
      lp.muted = false; ageLoop(lp);
      return [off, muted, lp.age];
    });
    expect(r).toEqual([3, 3, 4]);
    await context.close();
  });

  it("a loop with a Life ages as it plays, pass by pass", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    await page.evaluate(() => { ensureAudio(); state.bpm = 240; const lp = loops[0]; lp.life = "swell"; lp.age = 0; });
    await page.waitForFunction(() => loops[0].age >= 2, null, { timeout: 20_000 });
    await context.close();
  });

  it("Life and age travel in codes; a child starts its own life at age 0; old codes are steady", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    const r = await page.evaluate(async () => {
      const lp = loops[0]; lp.life = "brief"; lp.age = 5;
      const back = await decodeScene(await encodeScene(serialize()));
      const pk = packScene(serialize()); pk.l = pk.l.map((row) => row.slice(0, 29));
      const old = unpackScene(pk).loops[0];
      const child = mutateLoop(lp);
      return { life: back.loops[0].life, age: back.loops[0].age, old: [old.life, old.age], child: [child.life, child.age] };
    });
    expect(r).toEqual({ life: "brief", age: 5, old: ["steady", 0], child: ["brief", 0] });
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
    await page.evaluate(() => {
      state.morph = false; ensureAudio(); hint.hidden = true;
      loops.splice(0).forEach(fadeOut); dropToy("ring", [sheet.clientWidth / 2, sheet.clientHeight / 2]); loops[0].temper = "still";   // a plain, uncrossed path
      $("editBtn").click();
    });
    for (const j of [7, 23, 39, 41]) {                         // 39 = 3 × handleStep(13): on a handle
      const [x, y, n] = await page.evaluate((j) => { const lp = loops[0], q = lp.pts[j]; return [...place(lp, q.x, q.y, sheet.clientWidth, sheet.clientHeight), lp.events.length]; }, j);
      const onNote = await page.evaluate(([x, y]) => !!hitEvent(x, y), [x, y]);
      await page.mouse.click(x, y); await page.waitForTimeout(80);
      expect(await page.evaluate(() => loops[0].events.length), `point ${j}`).toBe(onNote ? n - 1 : n + 1);
    }
    await context.close();
  });
});
