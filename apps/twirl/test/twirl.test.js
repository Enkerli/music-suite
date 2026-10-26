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
import { launch, openTwirl, drawStroke, listen, heard, loopPoint, PAGE } from "./harness.js";

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

  it("at the 14-loop cap, breeding replaces the oldest loop (never a parent), into undo", async () => {
    const { page, context } = await openTwirl(browser);
    await crossing(page, { meets: "breed" });
    await page.evaluate(() => { const two = loops.slice(); loops.splice(0); while (loops.length < MAX_LOOPS - 2) dropToy("ring", [60, 60]); loops.forEach((l) => (l.meets = "ignore")); loops.push(...two); });
    const r = await page.evaluate(() => {
      const W = sheet.clientWidth, H = sheet.clientHeight, p = { x: W / 2, y: H / 2, heading: 0 };
      const oldest = loops[0], A = loops.at(-2), B = loops.at(-1);
      meet(A, p, B, p, nowBeat(), ctx.currentTime, W, H);
      return { n: loops.length, oldestGone: !loops.includes(oldest), inUndo: undone.at(-1) === oldest, parents: loops.includes(A) && loops.includes(B), child: loops.at(-1).lineage === A.uid, said: msgLog[0].msg };
    });
    expect(r).toMatchObject({ n: 14, oldestGone: true, inUndo: true, parents: true, child: true });
    expect(r.said).toMatch(/made room/);
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
    const after = await page.evaluate(() => { $("initBtn").click(); return { n: loops.length, bpm: state.bpm, grid: state.grid, root: state.root, chimes: loops[0].pack, label: $("initBtn").textContent }; });
    expect(after).toMatchObject({ n: 3, chimes: "chimes", label: "Bring it back" });
    expect(after.bpm).toBeGreaterThanOrEqual(84); expect(after.bpm).toBeLessThanOrEqual(112);          // a fresh sheet: its own key and tempo, within reason
    expect(["pentMaj", "pentMin"]).toContain(after.grid);
    expect([0, 2, 3, 5, 7, 9, 10]).toContain(after.root);
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

  it("bloom: notes beyond the drawn ones come in and leave again; the drawn ones always play and never change", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { loops.splice(0).forEach(fadeOut); state.morph = false; dropToy("ring", [sheet.clientWidth / 2, sheet.clientHeight / 2]); retrace(loops[0], "sparse", 0); loops[0].temper = "still"; });
    const r = await page.evaluate(() => {
      const lp = loops[0], n = lp.events.length, before = JSON.stringify(lp.events.map((e) => [e.off, e.x, e.y]));
      const at = (age) => { lp.life = "bloom"; lp.age = age; return [bloomNow(lp).length, lp.events.filter((_, i) => lifePlays(lp, i)).length]; };
      const out = [0, 4, 8, 12, 16].map(at);
      return { n, out, extra: bloomNotes(lp).length, same: before === JSON.stringify(lp.events.map((e) => [e.off, e.x, e.y])) };
    });
    expect(r.extra).toBeGreaterThan(r.n);                                 // "over the initial density": more than drawn
    expect(r.out.map((x) => x[0])).toEqual([0, expect.any(Number), r.extra, expect.any(Number), 0]);
    expect(r.out[1][0]).toBeGreaterThan(0);
    expect(r.out.every((x) => x[1] === r.n)).toBe(true);                  // every drawn note, always
    expect(r.same).toBe(true);
    await context.close();
  });

  it("bloom's extra notes come in strongest first: the downbeat before the rest", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0).forEach(fadeOut); dropToy("ring", [sheet.clientWidth / 2, sheet.clientHeight / 2]); const lp = loops[0];
      const all = bloomNotes(lp), first = all.filter((e) => e.order < Math.max(1, Math.round(all.length / 4)));
      return Math.min(...first.map((e) => e.rank)) >= Math.max(...all.filter((e) => !first.includes(e)).map((e) => e.rank)) - 1e-3;
    });
    expect(r).toBe(true);
    await context.close();
  });

  it("swell: louder and back, again and again; brief: fills in to its drawn notes, then fades and goes", async () => {
    const { page, context } = await openTwirl(browser);
    await ring(page);
    const r = await page.evaluate(() => {
      const lp = loops[0], n = lp.events.length;
      lp.life = "swell"; const sw = [0, 8, 16].map((a) => ((lp.age = a), lifeState(lp).vital));
      lp.life = "brief"; const br = [0, 7, 8, 12].map((a) => ((lp.age = a), [lp.events.filter((_, i) => lifePlays(lp, i)).length, lifeState(lp).vital]));
      lp.age = 16; const done = lifeState(lp).done;
      return { n, sw, br, done };
    });
    expect(r.sw[0]).toBeLessThan(0.5); expect(r.sw[1]).toBe(1); expect(r.sw[2]).toBeCloseTo(r.sw[0]);
    expect(r.br[0][0]).toBeLessThan(r.n / 2); expect(r.br[2][0]).toBe(r.n);
    expect(r.br[3][1]).toBeLessThan(1);
    expect(r.done).toBe(true);
    await context.close();
  });

  it("Surprise gives a life only once the sheet is busy, brief most often; never to a first stroke on a quiet sheet", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      state.dice = true; loops.splice(0).forEach(fadeOut);
      const quiet = new Set(); for (let i = 0; i < 200; i++) quiet.add(pickLife());
      for (let i = 0; i < 5; i++) dropToy("ring", [80 + i * 40, 600]);
      const busy = {}; for (let i = 0; i < 1000; i++) { const v = pickLife(); busy[v] = (busy[v] || 0) + 1; }
      return { quiet: [...quiet], busy };
    });
    expect(r.quiet).toEqual(["steady"]);
    expect(r.busy.brief).toBeGreaterThan(r.busy.bloom + r.busy.swell);
    expect(r.busy.steady).toBeGreaterThan(520);                          // 62 %: most loops stay
    expect(r.busy.fade).toBeGreaterThan(80);                             // some fade (16 or 32 passes)
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
    await page.evaluate(() => { ensureAudio(); state.bpm = 240; const lp = loops[0]; lp.life = "bloom"; lp.age = 0; });
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

describe.skipIf(!browser)("Twirl · Influence: loops that feed and drain the loops they touch", () => {
  const two = (page) => page.evaluate(() => {
    loops.splice(0).forEach(fadeOut); state.morph = false;
    dropToy("ring", [400, 400]); dropToy("rose", [800, 400]);
    loops.forEach((l) => { l.temper = "still"; retrace(l, "sparse", 0); });
  });

  it("feeds: the touched loop grows louder and denser; drains: quieter and sparser; once a beat per pair", async () => {
    const { page, context } = await openTwirl(browser);
    await two(page);
    const r = await page.evaluate(() => {
      const [X, Y] = loops, n = Y.events.length, g0 = gainOf(Y);
      X.gives = "feed";
      influence(X, Y, 10); influence(X, Y, 10.5);                         // the second is inside the beat: ignored
      const once = Y.strength;
      for (let b = 11; b < 15; b++) influence(X, Y, b);
      const fed = { s: Y.strength, louder: gainOf(Y) > g0, extra: bloomNow(Y).length, drawn: Y.events.filter((_, i) => lifePlays(Y, i)).length };
      Y.strength = 1; X.gives = "drain";
      for (let b = 20; b < 25; b++) influence(X, Y, b);
      const drained = { s: Y.strength, quieter: gainOf(Y) < g0, drawn: Y.events.filter((_, i) => lifePlays(Y, i)).length, extra: bloomNow(Y).length };
      return { n, once, fed, drained };
    });
    expect(r.once).toBeCloseTo(1.15);
    expect(r.fed).toMatchObject({ louder: true, drawn: r.n });
    expect(r.fed.s).toBeGreaterThan(1.5); expect(r.fed.extra).toBeGreaterThan(0);
    expect(r.drained).toMatchObject({ quieter: true, extra: 0 });
    expect(r.drained.s).toBeLessThan(0.5); expect(r.drained.drawn).toBeLessThan(r.n);
    await context.close();
  });

  it("strength settles back each pass; feeding keeps a fading loop young, draining ages it; Evolve off freezes it all", async () => {
    const { page, context } = await openTwirl(browser);
    await two(page);
    const r = await page.evaluate(() => {
      const [X, Y] = loops; X.gives = "feed"; Y.strength = 1.5;
      const back = []; for (let k = 0; k < 4; k++) { settle(Y); back.push(Y.strength); }
      for (let k = 0; k < 40; k++) settle(Y);
      const home = Y.strength;
      Y.life = "fade"; Y.age = 10; influence(X, Y, 100); const young = Y.age;
      X.gives = "drain"; influence(X, Y, 101); influence(X, Y, 102); const aged = Y.age;
      state.evolve = false; const s0 = Y.strength; influence(X, Y, 200); Y.strength = 1.4; settle(Y);
      return { back, home, young, aged, frozen: [s0 === s0, Y.strength] };
    });
    expect(r.back.every((v, i) => v < (i ? r.back[i - 1] : 1.5) && v > 1)).toBe(true);
    expect(r.home).toBe(1);
    expect(r.young).toBe(9);
    expect(r.aged).toBe(11);
    expect(r.frozen[1]).toBe(1.4);
    await context.close();
  });

  it("influence happens at real contacts: a feeding loop crossing another's line makes it stronger", async () => {
    const { page, context } = await openTwirl(browser);
    const [a, b] = await crossing(page, { gives: "feed" });
    await page.waitForFunction((b) => (loops.find((l) => l.uid === b).strength ?? 1) > 1, b, { timeout: 20_000 });
    await context.close();
  });

  it("influence and strength travel in codes; children start at full strength; Surprise gives influence only on a busy sheet", async () => {
    const { page, context } = await openTwirl(browser);
    await two(page);
    const r = await page.evaluate(async () => {
      const [X, Y] = loops; X.gives = "drain"; Y.strength = 0.7;
      const back = await decodeScene(await encodeScene(serialize()));
      const child = mutateLoop(Y);
      state.dice = true; loops.splice(0).forEach(fadeOut);
      const quiet = new Set(); for (let i = 0; i < 200; i++) quiet.add(pickInfluence());
      return { gives: back.loops[0].gives, strength: back.loops[1].strength, child: child.strength, quiet: [...quiet] };
    });
    expect(r).toEqual({ gives: "drain", strength: 0.7, child: 1, quiet: ["none"] });
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · Spinner (an ostinato that spins)", () => {
  it("a beat long, a drum then rising bells, evenly spaced, spinning; tall enough to span pitches", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      dropToy("spinner", [600, 400]); const lp = loops.at(-1), H = sheet.clientHeight;
      const ys = lp.events.map((e) => e.y), voices = lp.events.map((e) => voiceOf(lp, e));
      return { L: lp.L, temper: lp.temper, rhythm: lp.rhythm, n: lp.events.length, offs: offsOf(lp), voices, span: (Math.max(...ys) - Math.min(...ys)) * H / H, rising: ys.every((y, i) => !i || y < ys[i - 1]) };
    });
    expect(r).toMatchObject({ L: 1, temper: "spin", rhythm: "even", rising: true });
    expect(r.n).toBeGreaterThanOrEqual(3);
    expect(r.voices[0]).toBe("drum"); expect(r.voices.slice(1).every((v) => v === "bell")).toBe(true);
    expect(r.offs.every((o, i) => Math.abs(o - i / r.n) < 1e-9)).toBe(true);
    expect(r.span).toBeGreaterThan(0.35);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · timing freedom: snap, feel, clock (Everything)", () => {
  it("snap: the division (default), fine (1/64) or none (exactly as drawn)", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const lp = loops[1], b = 10.1234;
      const at = (m) => ((lp.snap = m), snapLoop(lp, b));
      return { def: snapOf(loops[0]), sheet: at("sheet"), fine: at("fine"), none: at("none"), div64: !!DIVS["64"] && !!$("div").querySelector('[value="64"]') };
    });
    expect(r.def).toBe("sheet");
    expect(r.sheet).toBeCloseTo(10, 6);                                      // 1/16 grid: 10.1234 → 10
    expect(r.fine).toBeCloseTo(10.125, 6);                                   // 1/64 of a bar = 1/16 of a beat
    expect(r.none).toBe(10.1234);
    expect(r.div64).toBe(true);
    await context.close();
  });

  it("feel: a loop pushed or laid back sounds that many ms off the beat", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => {
      ensureAudio(); state.morph = false; state.vary = false; state.meet = false;   // contacts sound on the beat: not this test
      loops.splice(0).forEach(fadeOut);
      dropToy("ring", [400, 400]); const a = loops[0]; a.temper = "still";
      const b = buildLoop(loopData(a), a.start, false); b.feel = 30; loops.push(b);
      window.__t = []; const orig = sound;
      window.sound = function (voice, xN, yN, vel, t, beat, ...rest) { __t.push([t, beat]); return orig.call(this, voice, xN, yN, vel, t, beat, ...rest); };
    });
    await page.waitForFunction(() => __t.length >= 6, null, { timeout: 20_000 });
    const d = await page.evaluate(() => {
      const byBeat = new Map(); for (const [t, b] of __t) { const k = b.toFixed(4); (byBeat.get(k) || byBeat.set(k, []).get(k)).push(t); }
      const pairs = [...byBeat.entries()].filter(([k, v]) => Number(k) >= 1 && v.length === 2).map(([, [x, y]]) => Math.abs(y - x));   // past the first beat (which may be clamped to now)
      return pairs;
    });
    expect(d.length).toBeGreaterThan(0);
    for (const x of d) expect(x).toBeCloseTo(0.03, 3);
    await context.close();
  });

  it("clock: drifting ahead or behind changes the pass by 1% and unsnaps it; in step brings the exact speed back", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      ensureAudio(); const lp = loops[1], ts0 = lp.ts, pass0 = loopBeats(lp);
      const set = (v) => { const base = baseTs(lp); lp.clock = v; retime(lp, base); return [loopBeats(lp) / pass0, baseTs(lp), snapOf(lp)]; };
      return { ahead: set("ahead"), behind: set("behind"), step: set("step"), ts0, ts: lp.ts };
    });
    expect(r.ahead[0]).toBeCloseTo(1 / 1.01, 6); expect(r.ahead[1]).toBeCloseTo(r.ts0, 9); expect(r.ahead[2]).toBe("none");
    expect(r.behind[0]).toBeCloseTo(1.01, 6);
    expect(r.step).toEqual([1, r.ts0, "sheet"]);
    expect(r.ts).toBe(r.ts0);
    await context.close();
  });

  it("snap, feel and clock travel in codes; old codes are in step, snapped, on the beat", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      const lp = loops[1]; lp.snap = "fine"; lp.feel = -20; const base = baseTs(lp); lp.clock = "behind"; retime(lp, base);
      const back = (await decodeScene(await encodeScene(serialize()))).loops[1];
      const pk = packScene(serialize()); pk.l = pk.l.map((row) => row.slice(0, 33));
      const old = unpackScene(pk).loops[1];
      return { back: [back.snap, back.feel, back.clock], old: [old.snap, old.feel, old.clock] };
    });
    expect(r.back).toEqual(["fine", -20, "behind"]);
    expect(r.old).toEqual(["sheet", 0, "step"]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · session tools: life length, Walk, shared timing, replayed drawing", () => {
  it("a life's length is a choice (8, 16, 32, 64 passes); changing it keeps the loop at the same point of its life", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      const lp = loops[1]; lp.life = "fade"; lp.span = 8; lp.age = 7;
      const short = [lifeState(lp).done, ((lp.age = 8), lifeState(lp).done)];
      lp.age = 4; openInspector(lp); setLevel(2);
      $("inspSpan").value = "32"; $("inspSpan").dispatchEvent(new Event("change"));
      const moved = [lp.span, lp.age, $("inspLife").textContent];
      const back = (await decodeScene(await encodeScene(serialize()))).loops[1].span;
      return { short, moved, back, def: spanOf(loops[0]) };
    });
    expect(r.short).toEqual([false, true]);
    expect(r.moved[0]).toBe(32); expect(r.moved[1]).toBe(16); expect(r.moved[2]).toMatch(/of 32/);
    expect(r.back).toBe(32); expect(r.def).toBe(16);
    await context.close();
  });

  it("Walk has ways (a progression, sway, fifths, climb, wander) and a pace; wander is repeatable", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      applySettings({ grid: "ionian" in GRID ? "ionian" : state.grid });
      const n = stepCount(), ways = {};
      for (const w of WALK_WAYS) { state.walkWay = w; ways[w] = [0, 1, 2, 3, 4, 5, 6, 7].map(walkShift); }
      state.walkWay = "wander"; const again = [0, 1, 2, 3, 4, 5, 6, 7].map(walkShift);
      state.walk = true; state.walkWay = "climb"; state.walkPace = 4;
      const shifts = [0, 8, 16, 24].map((b) => harmonyAt(b).shift);
      return { n, ways, again, shifts, saved: serialize().settings.walkWay };
    });
    expect(r.ways.steps.slice(0, 4)).toEqual(r.ways.steps.slice(4, 8));      // round and round
    expect(new Set(r.ways.sway)).toEqual(new Set([0, r.ways.sway[1]]));
    expect(new Set(r.ways.fifths).size).toBeGreaterThan(3);
    expect(r.ways.climb.slice(0, 3)).toEqual([0, 1, 2]);
    expect(r.again).toEqual(r.ways.wander);
    expect(r.shifts).toEqual([0, 0, 1, 1]);                                 // every 4 bars (16 beats)
    expect(r.saved).toBe("climb");
    await context.close();
  });

  it("timing is shared only on request: to the loop's family, or to all loops", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const lp = loops[1], child = mutateLoop(lp), other = loops[0];
      setLevel(3); openInspector(lp); lp.snap = "none"; lp.feel = 20; const base = baseTs(lp); lp.clock = "behind"; retime(lp, base);
      $("inspCopyWhat").value = "timing";
      $("inspCopyFamily").click();
      const fam = [child.snap, child.feel, child.clock, other.snap || "sheet"];
      $("inspCopyAll").click();
      const all = [other.snap, other.feel, other.clock, Math.abs(baseTs(other) - Math.round(baseTs(other) * 1000) / 1000) < 1e-3];
      const fresh = newStroke(nextStart());
      return { fam, all, fresh: [fresh.snap || "sheet", fresh.feel || 0, fresh.clock || "step"] };
    });
    expect(r.fam).toEqual(["none", 20, "behind", "sheet"]);
    expect(r.all).toEqual(["none", 20, "behind", true]);
    expect(r.fresh).toEqual(["sheet", 0, "step"]);                          // a new loop is always plain
    await context.close();
  });

  it("in a replay, a loop's first pass is its drawing: it appears as it was drawn", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      ensureAudio(); const lp = loops[1], b0 = lp.start;
      lp.replaying = true;
      const at = (b) => drawnUpTo(lp, b);
      const out = [at(b0 - 0.5), at(b0 + 0.25 * lp.ts), at(b0 + lp.L * lp.ts + 0.1)];
      delete lp.replaying;
      return { out, live: drawnUpTo(lp, b0 + 0.25) };
    });
    expect(r.out[0]).toBeLessThan(0);
    expect(r.out[1]).toBeCloseTo(0.25, 6);
    expect(r.out[2]).toBe(Infinity);
    expect(r.live).toBe(Infinity);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · performance: a busy sheet keeps up", () => {
  const busy = (page) => page.evaluate(() => {
    ensureAudio(); hint.hidden = true;
    const kinds = ["spiral", "rose", "lissajous", "ring", "star", "spinner", "chimes", "shaker", "beat", "drop", "spiral", "rose", "lissajous", "ring"];
    loops.splice(0).forEach(fadeOut);
    kinds.forEach((k, i) => dropToy(k, [300 + (i % 5) * 140, 250 + Math.floor(i / 5) * 160]));
    loops.forEach((l, i) => { if (!l.events.some((e) => e.fixed)) retrace(l, "dense", 0); l.meets = ["sound", "bump", "trade", "sound"][i % 4]; l.life = ["steady", "bloom", "brief", "swell"][i % 4]; l.gives = ["none", "feed", "none", "drain"][i % 4]; });
  });

  it("a budget: 14 dense loops with contacts, lives and influence; a frame's script and a scheduler tick stay well under a frame", async () => {
    const { page, context } = await openTwirl(browser);
    await busy(page);
    const r = await page.evaluate(() => {
      const W = sheet.clientWidth, H = sheet.clientHeight, f = [], t = [];
      for (let i = 0; i < 60; i++) { const a = performance.now(); frame(); f.push(performance.now() - a); }
      for (let i = 0; i < 60; i++) { const a = performance.now(); schedule(); t.push(performance.now() - a); }
      const p95 = (x) => x.sort((a, b) => a - b)[Math.floor(x.length * 0.95)];
      return { frame: p95(f), tick: p95(t), notes: loops.reduce((a, l) => a + l.events.length, 0) };
    });
    expect(r.notes).toBeGreaterThan(150);
    expect(r.frame).toBeLessThan(25);                                        // generous for CI; about 5 ms on a laptop
    expect(r.tick).toBeLessThan(12);
    await context.close();
  });

  it("late ticks: the scheduler looks further ahead (up to 0.4 s) and comes back slowly", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      ensureAudio(); lookahead = LOOKAHEAD;
      lastTickAt = performance.now() - 200; schedule(); const after = lookahead;      // a 200 ms gap
      lastTickAt = performance.now() - 2000; schedule(); const capped = lookahead;    // a 2 s one
      for (let i = 0; i < 50; i++) { lastTickAt = performance.now() - 25; schedule(); }
      return { after, capped, settling: lookahead };
    });
    expect(r.after).toBeGreaterThan(0.3);
    expect(r.capped).toBe(0.4);
    expect(r.settling).toBeLessThan(0.4); expect(r.settling).toBeGreaterThan(0.12);
    await context.close();
  });

  it("sharpness drops when frames are slow and comes back when calm; Q shows the readout", async () => {
    const { page, context } = await openTwirl(browser, { viewport: { width: 1180, height: 820 } });
    const r = await page.evaluate(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      frameTimes = []; for (let i = 0; i < 30; i++) adaptQuality(50); const slow = quality;
      for (let i = 0; i < 90; i++) adaptQuality(10); const calm = quality;
      return { dpr, slow, calm };
    });
    if (r.dpr > 1) { expect(r.slow).toBeLessThan(1); expect(r.calm).toBeGreaterThan(r.slow); }
    else expect([r.slow, r.calm]).toEqual([1, 1]);                          // at 1× there's nothing to drop
    await page.mouse.click(600, 600); await page.keyboard.press("q"); await page.waitForTimeout(700);
    expect(await page.evaluate(() => [$("perf").hidden, /fps/.test($("perf").textContent)])).toEqual([false, true]);
    await context.close();
  });

  it("the paper and its lines are a layer of their own, drawn only when they change", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      const raf = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      await raf(); const k1 = gridCache.key; await raf(); const same = gridCache.key === k1;
      applySettings({ root: (state.root + 2) % 12 }); await raf();
      return { same, changed: gridCache.key !== k1, layer: $("gridLayer").width > 0 };
    });
    expect(r).toEqual({ same: true, changed: true, layer: true });
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · Edit: a note's own sound", () => {
  it("double-tap a note to change its sound (round the voices, back to by direction); a single tap still removes it", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => {
      state.morph = false; ensureAudio(); hint.hidden = true;
      loops.splice(0).forEach(fadeOut); dropToy("ring", [sheet.clientWidth / 2, sheet.clientHeight / 2]); loops[0].temper = "still";
      $("editBtn").click();
    });
    const at = () => page.evaluate(() => { const lp = loops[0], ev = lp.events[1]; return [...notePos(lp, ev, undefined, sheet.clientWidth, sheet.clientHeight), lp.events.length]; });
    const [x, y, n] = await at();
    const sounds = [];
    for (let k = 0; k < 6; k++) {
      await page.mouse.click(x, y); await page.waitForTimeout(60); await page.mouse.click(x, y); await page.waitForTimeout(350);
      sounds.push(await page.evaluate(() => [loops[0].events[1].fixed, voiceOf(loops[0], loops[0].events[1])]));
    }
    expect(sounds.map((v) => v[0])).toEqual(["pluck", "bell", "blip", "drum", "shake", null]);
    expect(sounds[1][1]).toBe("bell");
    expect(await page.evaluate(() => [loops[0].events.length, retrace(loops[0], "dense", 0)])).toEqual([n, true]);   // still a drawn loop
    const [x2, y2] = await at(), m = await page.evaluate(() => loops[0].events.length);
    await page.mouse.click(x2, y2); await page.waitForTimeout(450);
    expect(await page.evaluate(() => loops[0].events.length)).toBe(m - 1);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · lives in bars, copying to several loops, Walk roles, a file of everything", () => {
  it("a life can last bars, not passes: a 2-bar fade ends after 8 beats, whatever the loop's size", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      const lp = loops[1]; lp.life = "fade"; lp.span = -2; setLifeProgress(lp, 0);
      const steps = []; while (!lifeState(lp).done && steps.length < 40) { ageLoop(lp); steps.push(+lp.ageB.toFixed(2)); }
      const back = (await decodeScene(await encodeScene(serialize()))).loops[1];
      return { beats: lp.ageB, pass: loopBeats(lp), back: [back.span, back.ageB] };
    });
    expect(r.beats).toBeGreaterThanOrEqual(8); expect(r.beats - r.pass).toBeLessThan(8);
    expect(r.back[0]).toBe(-2); expect(r.back[1]).toBeCloseTo(r.beats, 1);
    await context.close();
  });

  it("copy a life to loops you choose (tapping their chips): they all start together; each keeps its own length after", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => { state.dice = false; dropToy("ring", [300, 300]); dropToy("rose", [700, 300]); setLevel(2); });   // no Surprise lives in the way
    const r = await page.evaluate(() => {
      const [a, b, c, d, e] = loops; a.life = "fade"; a.span = 16; setLifeProgress(a, 0.5); c.life = "bloom"; c.age = 5;
      openInspector(a); $("inspCopyWhat").value = "life"; $("inspCopyChosen").click();
      const chips = [...$("loops").children];
      chips[2].click(); chips[3].click();                                        // c and d
      const note = $("inspCopyNote").textContent;
      $("inspCopyApply").click();
      const out = { note, lives: loops.map((l) => [l.life, l.age || 0]), chosen: !!choosing };
      d.span = -8; setLifeProgress(d, lifeProgress(d));
      out.d = [d.span, lifeProgress(d)];
      return out;
    });
    expect(r.note).toMatch(/2 chosen/);
    expect(r.lives[0]).toEqual(["fade", 0]);                                   // the one copied from restarts too
    expect(r.lives[2]).toEqual(["fade", 0]); expect(r.lives[3]).toEqual(["fade", 0]);
    expect(r.lives[1][0]).not.toBe("fade"); expect(r.lives[4][0]).not.toBe("fade");
    expect(r.chosen).toBe(false);
    expect(r.d).toEqual([-8, 0]);
    await context.close();
  });

  it("Walk roles: moves shifts by scale steps; stays ignores Walk; fits keeps its pitch and goes to the nearest tone of the walked chord", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      applySettings({ grid: "pentMaj", walk: true, walkWay: "climb", walkPace: 1, arc: "off" });
      const b = 4 * BAR + 0.1, h = harmonyAt(b).shift, n = stepCount(), d = 7;
      const fit = walkFor("fits", d, b), tones = [0, 2, 4].map((k) => mod(h + k, n));
      return { h, moves: walkFor("moves", d, b), stays: walkFor("stays", d, b), fit, isTone: tones.includes(mod(fit, n)), near: Math.abs(fit - d) <= 2, atHome: walkFor("fits", d, 0.1) };
    });
    expect(r.h).toBeGreaterThan(0);
    expect(r.moves).toBe(7 + r.h);
    expect(r.stays).toBe(7);
    expect(r.isTone).toBe(true); expect(r.near).toBe(true);
    expect(r.atHome).toBe(7);                                                   // at home, nothing to fit
    await context.close();
  });

  it("download everything as readable JSON, and open it back: scenes fill empty slots, toys and takes join", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      store.set(slotKey(1), { ...serialize(), v: 3, at: 1 });
      const c = collection(), text = JSON.stringify(c);
      for (let i = 1; i <= SLOTS; i++) localStorage.removeItem(slotKey(i));
      openCollection(JSON.parse(text));
      return { format: c.format, scenes: c.scenes.filter(Boolean).length, sheet: c.sheet.loops.length, filled: [...Array(SLOTS)].filter((_, i) => store.get(slotKey(i + 1))).length };
    });
    expect(r).toEqual({ format: "twirl-collection", scenes: 1, sheet: 3, filled: 2 });     // the sheet came in as a scene too
    await context.close();
  });

  it("?start=macro: a fresh sheet starts in 5-EDO, slendro or 7-EDO; otherwise pentatonic as always", async () => {
    const context = await browser.newContext(); const page = await context.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(PAGE + "?start=macro");
    await page.waitForFunction(() => typeof loops !== "undefined" && loops.length > 0);
    expect(["edo5", "slendro", "edo7"]).toContain(await page.evaluate(() => state.grid));
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
      await page.mouse.click(x, y); await page.waitForTimeout(450);          // a tap on a note waits to see it isn't a double-tap
      expect(await page.evaluate(() => loops[0].events.length), `point ${j}`).toBe(onNote ? n - 1 : n + 1);
    }
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · a smoother, more colourful sheet", () => {
  // Alex, 2026-10-25: "auto-smooth new curves. Not show the beat lines by
  // default. And strokes can have their voice's colour."
  it("beat lines are hidden by default, shown on request, and always under Lock", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const verticals = () => {                       // count the full-height lines drawGrid draws
        const real = g2, W = 800, H = 600; let n = 0;
        g2 = new Proxy(real, { get: (t, k) => k === "lineTo" ? (x, y) => { if (y === H) n++; } : typeof t[k] === "function" ? t[k].bind(t) : t[k], set: (t, k, v) => ((t[k] = v), true) });
        try { drawGrid(W, H); } finally { g2 = real; }
        return n;
      };
      const off = verticals(); setBeats(true); const on = verticals(); const saved = store.get("twirl:beats");
      setBeats(false); state.lock = true; const lock = verticals(); state.lock = false;
      return { off, on, saved, lock, pressed: $("beatsBtn").getAttribute("aria-pressed") };
    });
    expect(r.off).toBe(0);
    expect(r.on).toBeGreaterThan(0);
    expect(r.lock).toBe(r.on);
    expect(r.saved).toBe(true);
    expect(r.pressed).toBe("false");
    await context.close();
  });

  it("a new stroke settles into a smoother curve, notes still on the line; Smooth off keeps it as drawn", async () => {
    const { page, context } = await openTwirl(browser);
    await page.evaluate(() => {
      window.__rough = [];
      const rough = (lp) => lp.pts.slice(1, -1).reduce((a, p, j) => a + Math.hypot(lp.pts[j].x - 2 * p.x + lp.pts[j + 2].x, lp.pts[j].y - 2 * p.y + lp.pts[j + 2].y), 0);
      const orig = settleStroke;
      window.settleStroke = function (lp, ...rest) { const before = rough(lp); orig.call(this, lp, ...rest); window.__rough.push([before, rough(lp)]); };
      loops.splice(0);                                              // an empty sheet: the stroke can't land on a loop
      Math.random = () => 0.8;                                      // Surprise's "jitter" way of moving: still smoothed (only scribbles aren't)
    });
    // A trembling hand: a slow line with a 3 px wobble across it.
    await page.mouse.move(260, 420); await page.mouse.down();
    for (let k = 1; k <= 80; k++) { await page.mouse.move(260 + k * 4, 420 - k * 1.5 + (k % 2 ? 3 : -3)); await page.waitForTimeout(12); }
    await page.mouse.up();
    const r = await page.evaluate(() => {
      const lp = loops.at(-1);
      return { rough: window.__rough.slice(), onLine: lp.events.every((e) => lp.pts.some((p) => p.x === e.x && p.y === e.y)) };
    });
    expect(r.rough.length).toBe(1);
    expect(r.rough[0][1]).toBeLessThan(r.rough[0][0] * 0.5);   // visibly smoother, not a token pass (2026-10-25: "curves aren't automatically smoothened")
    expect(r.onLine).toBe(true);
    await page.evaluate(() => { setSmooth(false); loops.splice(0); });
    await drawStroke(page);
    expect(await page.evaluate(() => [window.__rough.length, store.get("twirl:smooth")])).toEqual([1, false]);
    await context.close();
  });

  it("the ticks across loops come and go with Beats (off by default)", async () => {
    const { page, context } = await openTwirl(browser);
    const count = () => page.evaluate(async () => {
      let n = 0; const orig = drawBeatTicks; window.drawBeatTicks = (...a) => { n++; return orig(...a); };
      await new Promise((ok) => setTimeout(ok, 300)); window.drawBeatTicks = orig; return n;
    });
    expect(await count()).toBe(0);
    await page.evaluate(() => setBeats(true));
    expect(await count()).toBeGreaterThan(0);
    await context.close();
  });

  it("a path takes its voices' colours, stretch by stretch, and following a change of sound", async () => {
    const { page, context, errors } = await openTwirl(browser);
    await drawStroke(page);
    const r = await page.evaluate(() => {
      const lp = loops.at(-1);
      lp.events.forEach((e) => (e.fixed = "bell"));
      const allBell = new Set(voiceColours(lp, lp.pts));
      lp.events.forEach((e, i) => (e.fixed = i < lp.events.length / 2 ? "drum" : "blip"));
      const mixed = voiceColours(lp, lp.pts);
      return { allBell: [...allBell], first: mixed[0], last: mixed.at(-1), bell: colors.bell, drum: colors.drum, blip: colors.blip };
    });
    expect(r.allBell).toEqual([r.bell]);
    expect(r.first).toBe(r.drum);
    expect(r.last).toBe(r.blip);
    await page.waitForTimeout(300);                                 // a few frames drawn in colour
    expect(errors).toEqual([]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · spacing by register, warmth, tadpoles", () => {
  // Alex, 2026-10-25: "wider gaps between bass notes, tighter between top notes.
  // Following loosely an acoustic principle about dissonance."
  it("by register: fewer, wider rows low down, every row up high, octaves always kept and equally tall", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      Object.assign(state, { grid: "ionian", root: 0, range: 3, spread: "register" });
      const { degs, edge } = sheetRows(), n = stepCount();
      const inOct = (o) => degs.filter((d) => Math.floor(d / n) === o).length;
      const octEdges = degs.map((d, i) => (d % n === 0 ? edge[i] : null)).filter((v) => v !== null);
      const fromY = [0.99, 0.5, 0.01].map((y) => bandAt(y));
      state.spread = "even"; const even = sheetRows().degs.length, evenTop = bandAt(0.01);
      state.spread = "register";
      return { counts: [0, 1, 2].map(inOct), n, octEdges, fromY, even, evenTop, all: degs.every((d) => Number.isInteger(d)) };
    });
    expect(r.counts[0]).toBeLessThan(r.counts[1]);           // the bass octave is thinned most
    expect(r.counts[1]).toBeLessThanOrEqual(r.counts[2]);
    expect(r.counts[2]).toBe(r.n);                            // the top octave keeps every step
    expect(r.octEdges.map((e) => Math.round(e * 300) / 100)).toEqual([0, 1, 2]);   // each octave a third of the sheet
    expect(r.even).toBe(r.n * 3);
    expect(r.fromY[0]).toBe(0);
    expect(r.fromY[2]).toBe(r.evenTop);                       // the top row is the top step either way
    expect(r.all).toBe(true);
    await context.close();
  });

  it("older sheets open as they were (even); a fresh sheet is by register; chords low down open up", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const fresh = STATE_DEFAULTS.spread;
      const sc = serialize(); delete sc.settings.spread; recall(sc);
      const old = state.spread;
      Object.assign(state, { spread: "register", root: 0, range: 3, grid: "pentMaj" });   // the bottom note: C3, under G3 (a fresh sheet's key is random)
      const seen = []; const orig = midiForDegree;
      window.midiForDegree = (d) => { seen.push(d); return orig(d); };
      ensureAudio(); sound("pluck", 0.5, 0.99, 0.5, ctx.currentTime + 0.05, 0, 0, "triad");
      window.midiForDegree = orig;
      return { fresh, old, saved: serialize().settings.spread, seen };
    });
    expect(r.fresh).toBe("register");
    expect(r.old).toBe("even");
    expect(r.saved).toBe("register");
    expect(r.seen.some((d) => d >= 5)).toBe(true);            // a triad on the bottom note: its third an octave up
    await context.close();
  });

  it("warmth: hiss, crackle and wobble under the master, scaled and turned off by Warmth", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      ensureAudio(); await new Promise((ok) => setTimeout(ok, 300));
      const at = () => [room.hissG.gain.value, room.crG.gain.value, room.wowG.gain.value];
      const half = at(); setWarmth(0); await new Promise((ok) => setTimeout(ok, 800)); const none = at();
      setWarmth(1); await new Promise((ok) => setTimeout(ok, 800));
      return { half, none, full: at(), saved: serialize().settings.warmth };
    });
    expect(r.half.every((v) => v > 0)).toBe(true);
    expect(r.none.every((v) => v < 1e-4)).toBe(true);
    expect(r.full[0]).toBeGreaterThan(r.half[0]);
    expect(r.half[0]).toBeLessThan(0.01);                     // barely there
    expect(r.saved).toBe(1);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("the drone takes each space; binaural sets its left and right apart", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(async () => {
      ensureAudio(); const out = {};
      for (const sp of Object.keys(DRONE_SPACES)) { state.droneSpace = sp; setDrone(true); out[sp] = drone.split; }
      await new Promise((ok) => setTimeout(ok, 1500));
      const [l, rr] = drone.voices[0].pair.map((o) => o.frequency.value);
      state.droneSpace = "binaural"; setDrone(true); await new Promise((ok) => setTimeout(ok, 2500));
      const [bl, br] = drone.voices[0].pair.map((o) => o.frequency.value);
      setDrone(false);
      return { out, still: Math.abs(l - rr), apart: br - bl };
    });
    expect(r.out.binaural).toBe(3);
    expect(r.still).toBeLessThan(0.01);
    expect(r.apart).toBeGreaterThan(2.5);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("tadpoles: five single-note, drifting, fading breeders; their children breed too, other children don't", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0); state.dice = false;
      const all = dropTadpoles(400, 300, sheet.clientWidth, sheet.clientHeight, 600);
      const made = all.slice(0, 3);                                    // a small school of three; the current is the template's, not the toy's
      const c = dropCurrent(400, 300, sheet.clientWidth, sheet.clientHeight), currentKind = `${c.meets}/${c.life}/${c.events.length > 2}`;
      const kinds = [...new Set(made.map((l) => `${l.meets}/${l.life}/${l.temper}`))];
      const kid = mutateLoop(made[0]);
      const plain = loops.find((l) => !made.includes(l) && l !== kid) || made[1];
      plain.life = "steady"; plain.meets = "breed"; const kid2 = mutateLoop(plain);
      return {
        n: made.length, notes: made.map((l) => l.events.length), waits: made.map((l) => l.wait),
        kinds,
        kid: kid && [kid.meets, kid.life], kid2: kid2 && kid2.meets, all: all.length, currentKind,
      };
    });
    expect(r.n).toBe(3);
    expect(r.all).toBe(3);
    expect(r.currentKind).toBe("sound/steady/true");          // a steady line across them, with a few notes
    expect(r.notes).toEqual([1, 1, 1]);
    expect(r.waits.every((w) => w >= 4)).toBe(true);
    expect(r.kinds).toEqual(["infect/fade/drift"]);
    expect(r.kid).toEqual(["infect", "fade"]);
    expect(r.kid2).toBe("sound");
    expect(errors).toEqual([]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · merging, the drone's level, two modes", () => {
  it("merge: one loop swallows the other, its path then the other's, notes and all, where they were; the other goes to undo", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0); state.dice = false;
      dropToy("ring", [300, 300]); dropToy("wave", [600, 400]);
      const [X, Y] = loops, W = sheet.clientWidth, H = sheet.clientHeight;
      Y.rot = 0.7; Y.tx = 0.05;                                       // turned and moved: baked in as it is now
      const before = [...X.events, ...Y.events].length, yFirst = place(Y, Y.events[0].x, Y.events[0].y, W, H);
      const xL = X.pts.at(-1).b, ywas = Y.uid;
      X.meets = "merge";
      const said = mergeLoops(X, Y, nowBeat());
      const e = X.events.find((ev) => ev.off >= xL + BRIDGE - 1e-9), at = place(X, e.x, e.y, W, H);
      const again = mergeLoops(X, X, nowBeat());
      return { said: !!said, n: loops.length, notes: X.events.length, before, moved: Math.hypot(at[0] - yFirst[0], at[1] - yFirst[1]), undone: undone.at(-1).uid === ywas, L: X.L, rot: X.rot, again };
    });
    expect(r.said).toBe(true);
    expect(r.n).toBe(1);
    expect(r.notes).toBe(r.before);
    expect(r.moved).toBeLessThan(1);                                // Y's first note is where it was on screen
    expect(r.undone).toBe(true);
    expect(r.L).toBeLessThanOrEqual(16);
    expect(r.rot).toBe(0);
    expect(r.again).toBe(null);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("merge: not past 16 beats, not twice within 4 bars; a merger answers when lines touch", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0); state.dice = false;
      dropToy("ring", [300, 300]); dropToy("ring", [600, 300]); dropToy("ring", [450, 500]);
      const [A, B, C] = loops; A.meets = "merge";
      const one = mergeLoops(A, B, 100), soon = mergeLoops(A, C, 101);
      A.L = 15; A.pts.at(-1).b = 14.9; const long = mergeLoops(A, C, 200);
      return { one: !!one, soon, long, n: loops.length, order: MEET_ORDER.at(-1) };
    });
    expect(r).toEqual({ one: true, soon: null, long: null, n: 2, order: "merge" });
    await context.close();
  });

  it("the drone is about as loud as one loop at its default, and a fresh sheet draws its space", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      const spaces = new Set(); for (let i = 0; i < 60; i++) spaces.add(freshKey().droneSpace);
      return { gain: droneLevel(STATE_DEFAULTS.droneVol), top: droneLevel(1), spaces: [...spaces].every((s) => s in DRONE_SPACES), many: spaces.size > 1 };
    });
    expect(r.gain).toBeLessThanOrEqual(0.012);                       // starts a little under one loop (was 0.05: four times a loop)
    expect(r.top).toBeGreaterThanOrEqual(0.1);                       // but the range is the old one ("wasn't really asking for a lower range")
    expect(r.spaces).toBe(true);
    expect(r.many).toBe(true);
    await context.close();
  });

  it("two modes: Simple shows a few controls, Everything adds labelled, folding sections; More is gone", async () => {
    const { page, context } = await openTwirl(browser);
    await page.click("#menuBtn");
    const simple = await page.evaluate(() => [...document.querySelectorAll("#strip button, #strip select, #strip input")].filter((e) => e.offsetParent).length);
    const levels = await page.$$eval('#strip [data-set-level]', (b) => b.map((x) => x.textContent));
    await page.click('#strip [data-set-level="3"]');
    const r = await page.evaluate(() => ({
      every: [...document.querySelectorAll("#strip button, #strip select, #strip input")].filter((e) => e.offsetParent).length,
      secs: [...document.querySelectorAll("#strip details.dsec .dtitle")].map((t) => t.textContent),
      two: (setLevel(2), level),
    }));
    expect(levels).toEqual(["Simple", "Everything"]);
    expect(simple).toBeLessThanOrEqual(12);
    expect(r.every).toBeGreaterThan(simple * 2);
    expect(r.secs).toEqual(["Drawing", "Time", "Pitch", "Loops together", "Harmony", "Sound and room", "View"]);
    expect(r.two).toBe(3);                                           // an old "More" opens Everything
    await page.click('#strip details[data-sec="pitch"] > summary');
    await page.waitForFunction(() => store.get("twirl:sec:pitch") === false, null, { timeout: 2000 });   // "toggle" fires a moment after the click
    expect(await page.evaluate(() => [document.querySelector('details[data-sec="pitch"]').open, store.get("twirl:sec:pitch")])).toEqual([false, false]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · undoing what happened, the chord, templates", () => {
  it("a child born at a contact can be undone from the log; so can a merge (the swallowed loop comes back, the other as it was)", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0); state.dice = false; state.lock = false;
      dropToy("ring", [300, 300]); dropToy("rose", [600, 300]); dropToy("wave", [450, 500]);
      const [A, B, C] = loops;
      breedWith(A, B, 1000); toast("a child", false, takeUndo());
      const afterBirth = loops.length, entry = msgLog[0];
      openMsgLog(); const btn = document.querySelector("#msgList .undo"); btn.click();
      const afterUndo = loops.length, marked = entry.undone, label = btn.getAttribute("aria-label");
      const L0 = A.L, n0 = A.events.length;
      mergeLoops(A, C, 2000); toast("merged", false, takeUndo());
      const merged = [loops.length, A.events.length > n0];
      msgLog[0].undo();
      return { afterBirth, afterUndo, marked, label, merged, back: [loops.length, loops.includes(C), A.L === L0, A.events.length === n0], leftover: undoBuf.length };
    });
    expect(r.afterBirth).toBe(4);
    expect(r.afterUndo).toBe(3);
    expect(r.marked).toBe(true);
    expect(r.label).toBe("Undo: a child");
    expect(r.merged).toEqual([2, true]);
    expect(r.back).toEqual([3, true, true, true]);
    expect(r.leftover).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("a trade and a life's end can be undone too", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      loops.splice(0); state.dice = false;
      dropToy("ring", [300, 300]); dropToy("drop", [600, 300]);
      const [A, B] = loops; A.chord = "single"; B.chord = "triad"; A.pen = B.pen = "auto"; A.rhythm = B.rhythm = "drawn"; A.dir = B.dir = "fwd";
      A.tradeNext = 0;                                                // next up: chords
      const got = borrow(A, B), u = takeUndo(), traded = A.chord; u();
      dying.push(B); buryDead();
      const gone = !loops.includes(B); msgLog[0].undo();
      return { got, traded, back: A.chord, gone, alive: loops.includes(B) };
    });
    expect(r).toEqual({ got: "its chords", traded: "triad", back: "single", gone: true, alive: true });
    await context.close();
  });

  it("with Walk on, the sheet shows the chord it's on, named", async () => {
    const { page, context } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      Object.assign(state, { grid: "ionian", root: 0, tuning: "equal", walk: false, arc: "off" });
      const home = chordLabel(0);
      state.grid = "pentMaj"; const pent = chordLabel(0);
      state.grid = "edo7"; const micro = chordLabel(0);
      return { home, pent, micro };
    });
    expect(r.home).toBe("chord: C · step 1 of 7");
    expect(r.pent).toBe("chord: Am/C · step 1 of 5");                 // C E A: A minor over C
    expect(r.micro).toMatch(/^chord on step 1 of 7$/);
    await context.close();
  });

  it("?template=tadpoles opens a tadpole sea with a current, keeps your sheet aside, and only once", async () => {
    const ctx0 = await browser.newContext();
    const page = await ctx0.newPage();
    await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await page.goto(PAGE); await page.waitForTimeout(400);
    await page.evaluate(() => autosave && autosave());
    await page.goto(PAGE + "?template=tadpoles"); await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ n: loops.length, steady: loops.filter((l) => l.life === "steady").length, drone: state.drone, level, before: !!store.get(BEFORE_KEY) }));
    await page.evaluate(() => { loops.splice(0, 3); autosave(); });
    await page.reload(); await page.waitForTimeout(500);
    const again = await page.evaluate(() => loops.length);
    expect(r).toEqual({ n: 7, steady: 1, drone: true, level: 3, before: true });
    expect(again).toBe(4);                                           // a reload keeps what you've done since
    await ctx0.close();
  });
});

describe.skipIf(!browser)("Twirl · steps below the sheet", () => {
  it("a step under the bottom row has a pitch (the scale's top step, an octave down), so fits never makes a NaN note", async () => {
    const { page, context, errors } = await openTwirl(browser);
    const r = await page.evaluate(() => {
      Object.assign(state, { grid: "pentMaj", root: 0, range: 3 });
      const m0 = midiForDegree(0), mm1 = midiForDegree(-1), mm5 = midiForDegree(-5);
      ensureAudio(); let thrown = null;
      try { state.walk = true; sound("pluck", 0.5, 0.999, 0.6, ctx.currentTime + 0.05, 0, -1); } catch (e) { thrown = e.message; }
      return { m0, mm1, mm5, thrown, skipped: diag.skipped || 0 };
    });
    expect(r.mm1).toBe(r.m0 - 3);                                    // C3 → A2 in C major pentatonic
    expect(r.mm5).toBe(r.m0 - 12);
    expect(r.thrown).toBe(null);
    expect(r.skipped).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · diagnostics for new hardware", () => {
  it("⇧Q's report says what the pointer reported and what MIDI sees", async () => {
    const { page, context } = await openTwirl(browser);
    await drawStroke(page);
    const r = await page.evaluate(() => { const d = diagReport(); return { pen: d.pen, midi: d.midi, keys: Object.keys(d) }; });
    expect(r.pen.type).toBe("mouse");
    expect(r.pen.events).toBeGreaterThan(5);
    expect(typeof r.midi === "string" || Array.isArray(r.midi.outputs)).toBe(true);
    expect(r.keys).toContain("skippedNotes");
    expect(r.keys).toEqual(expect.arrayContaining(["ticksLateMs", "audioDevice", "clock"]));
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · inside the plugin (twirl-dpf)", () => {
  // DPF's web view injects these before the page runs (DPF distrho/src/DistrhoUI.cpp).
  const dpf = () => {
    window.__host = [];
    window.setState = (key, value) => window.__host.push({ key, value, at: performance.timeOrigin + performance.now() });
    window.sendNote = () => {};
  };

  it("as MIDI, sends its notes to the host in timed batches, and makes no sound itself", async () => {
    const { page, context, errors } = await openTwirl(browser, { initScript: dpf });
    await page.evaluate(() => { $("out").value = "host:midi"; $("out").dispatchEvent(new Event("change")); });   // the picker sits in Everything
    await page.evaluate(() => {
      window.__voiced = 0;
      const orig = voiceFn;
      window.voiceFn = (...a) => { const f = orig(...a); return (...b) => { window.__voiced++; return f(...b); }; };
    });
    await page.mouse.click(600, 600);
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => ({
      inHost: IN_HOST, out: state.out, picker: [...$("out").options].map((o) => o.value), voiced: window.__voiced,
      batches: window.__host.filter((m) => m.key === "notes"), sent: diag.midiSent, report: diagReport().midi,
    }));
    expect(r.inHost).toBe(true);
    expect(r.out).toBe("host:midi");
    expect(r.picker).toEqual(["host:sound", "host:midi", "host:both", "host:engine", "host:engine+midi"]);
    expect(r.voiced).toBe(0);                                  // the host's instruments make the sound
    expect(r.report).toMatchObject({ out: "host:midi", host: true, followHost: false, holding: false });
    expect(r.batches.length).toBeGreaterThan(1);
    expect(r.batches.length).toBeLessThan(r.sent * 2);         // batched: not one message per event
    const events = r.batches.flatMap((b) => b.value.split(";").map((e) => {
      const [t, status, note, vel] = e.split(",").map(Number);
      return { t, status, note, vel, sentAt: b.at };
    }));
    expect(events.length).toBe(r.sent * 2);                    // an on and an off for each note
    for (const e of events) {
      expect(e.t).toBeGreaterThan(e.sentAt - 5);               // sent ahead of (or at) its time, never after
      expect([0x80, 0x90]).toContain(e.status & 0xf0);
      expect([0, 1, 2, 9]).toContain(e.status & 0x0f);         // pluck, bell, blip, drums
      expect(e.note).toBeGreaterThanOrEqual(0); expect(e.note).toBeLessThan(128);
      expect(e.vel).toBeGreaterThanOrEqual(0); expect(e.vel).toBeLessThan(128);
    }
    // Each off follows its on by Twirl's length for the voice (drums 80 ms, pluck and blip 220, bell 600).
    const ons = events.filter((e) => (e.status & 0xf0) === 0x90);
    const offs = events.filter((e) => (e.status & 0xf0) === 0x80);
    expect(ons.length).toBe(offs.length);
    for (const on of ons) {
      const len = (on.status & 0x0f) === 9 ? 80 : (on.status & 0x0f) === 1 ? 600 : 220;
      expect(offs.some((off) => off.status === (0x80 | (on.status & 0x0f)) && off.note === on.note && Math.abs(off.t - on.t - len) < 0.2)).toBe(true);
    }
    expect(errors).toEqual([]);
    await context.close();
  });

  it("starts at once, untouched (its window may never open), and sends its own sound and MIDI", async () => {
    const { page, context, errors } = await openTwirl(browser, { initScript: dpf });
    expect(await page.inputValue("#out")).toBe("host:both");
    expect(await page.evaluate(() => window.__host.some((m) => m.key === "ready"))).toBe(true);
    await page.waitForTimeout(1500);                           // no click: the plugin starts it
    const r = await page.evaluate(() => {
      const audio = window.__host.filter((m) => m.key === "audio");
      const sizes = audio.map((m) => atob(m.value.split(",")[2]).length);
      // The chunks' 16-bit samples: is there sound in them (the example loops play)?
      const peak = Math.max(...audio.map((m) => {
        const b = atob(m.value.split(",")[2]); let p = 0;
        for (let i = 0; i < b.length; i += 2) { const v = (b.charCodeAt(i) | (b.charCodeAt(i + 1) << 8)) << 16 >> 16; p = Math.max(p, Math.abs(v)); }
        return p;
      }));
      // Each chunk carries when its first frame was rendered: just before it was sent.
      const stampAges = audio.map((m) => m.at - Number(m.value.split(",")[1]));
      return { n: audio.length, rate: audio.length ? Number(audio[0].value.split(",")[0]) : 0, sizes: [...new Set(sizes)], peak,
               stampAges: [Math.min(...stampAges), Math.max(...stampAges)],
               first: audio.length ? audio[0].at : 0, last: audio.length ? audio.at(-1).at : 0, notes: window.__host.filter((m) => m.key === "notes").length };
    });
    expect(r.rate).toBe(await page.evaluate(() => ctx.sampleRate));
    expect(r.sizes).toEqual([2048]);                           // 512 stereo frames, 16-bit
    // Real time: as many frames sent as the time they span (give or take a chunk or two).
    expect(Math.abs(r.n * 512 / r.rate - (r.last - r.first) / 1000)).toBeLessThan(0.1);
    expect(r.peak).toBeGreaterThan(100);
    expect(r.stampAges[0]).toBeGreaterThanOrEqual(0);
    expect(r.stampAges[1]).toBeLessThan(200);
    expect(r.notes).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("with the sound made in the plugin (route C), sends notes for its engine, and its own sound none", async () => {
    const { page, context, errors } = await openTwirl(browser, { initScript: dpf });
    const pick = (v) => page.evaluate((v) => { $("out").value = v; $("out").dispatchEvent(new Event("change")); window.__host.length = 0; }, v);
    const sent = () => page.evaluate(() => ({
      voices: window.__host.filter((m) => m.key === "voices").flatMap((m) => m.value.split(";").map((e) => e.split(",").map(Number))),
      notes: window.__host.filter((m) => m.key === "notes").length, audio: window.__host.filter((m) => m.key === "audio").length,
      engine: window.__host.filter((m) => m.key === "engine").map((m) => m.value),
    }));
    await pick("host:engine");
    await page.waitForTimeout(1500);
    let r = await sent();
    expect(r.voices.length).toBeGreaterThan(3);
    for (const [t, voice, pack, midi, vel, pan, y] of r.voices) {
      expect(Number.isFinite(t) && t > 1e12).toBe(true);
      expect([0, 1, 2, 3, 4]).toContain(voice);
      expect(pack).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(midi)).toBe(true);
      expect(vel).toBeGreaterThan(0); expect(Math.abs(pan)).toBeLessThanOrEqual(1); expect(y).toBeGreaterThanOrEqual(0);
    }
    expect([r.notes, r.audio]).toEqual([0, 0]);                 // no MIDI, nothing streamed
    await pick("host:engine+midi");
    await page.evaluate(() => setVolume(0.5));
    await page.waitForTimeout(1500);
    r = await sent();
    expect(r.voices.length).toBeGreaterThan(3);
    expect(r.notes).toBeGreaterThan(0);
    expect(r.engine.at(-1)).toBe(`0.5,${await page.evaluate(() => state.bpm)}`);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("gives the plugin its state to save, and takes it back", async () => {
    const a = await openTwirl(browser, { initScript: dpf });
    await a.page.evaluate(() => { setTempo(123); $("out").value = "host:sound"; $("out").dispatchEvent(new Event("change")); setHostSync(true); autosave(); });
    const saved = await a.page.evaluate(() => window.__host.filter((m) => m.key === "page").at(-1).value);
    expect(saved).toMatch(/^[A-Za-z0-9+/=]+$/);                 // base64: safe to hand back inside a JS string
    await a.context.close();
    const b = await openTwirl(browser, { initScript: dpf });
    expect(await b.page.evaluate(() => [state.bpm !== 123, state.out, hostSync])).toEqual([true, "host:both", false]);   // a fresh sheet
    await b.page.evaluate((s) => twirlRestore(s), saved);
    expect(await b.page.evaluate(() => [state.bpm, state.out, hostSync, $("syncBtn").getAttribute("aria-pressed")])).toEqual([123, "host:sound", true, "true"]);
    expect(b.errors).toEqual([]);
    await b.context.close();
  });

  it("follows the host when asked: its tempo, its transport, its beat", async () => {
    const { page, context, errors } = await openTwirl(browser, { initScript: dpf });
    await page.waitForTimeout(500);
    // The plugin's report, as now: the host at `beat` on the plugin's clock.
    const host = (tempo, playing, beat) => page.evaluate(([tempo, playing, beat]) =>
      twirlHost({ tempo, playing, beat, at: performance.timeOrigin + performance.now(), lag: 0 }), [tempo, playing, beat]);
    const offBeats = () => page.evaluate(() => {
      const h = hostInfo, wall = performance.timeOrigin + performance.now() + (soundOn() ? h.lag : 0);
      let e = h.beat + (wall - h.at) * h.tempo / 60000 - beatAt(ctx.currentTime); return e - 48 * Math.round(e / 48);
    });
    const own = await page.evaluate(() => state.bpm);
    await host(120, true, 10);
    expect(await page.evaluate(() => [state.bpm, hostHold])).toEqual([own, false]);  // off: its own clock
    await page.evaluate(() => setHostSync(true));
    await host(120, false, 10);
    const [held, heldBeat] = await page.evaluate(() => [diag.midiSent, nowBeat()]);
    await page.waitForTimeout(600);
    // Stopped: the loops wait, and the clock (so the playheads) stands still.
    expect(await page.evaluate(() => [hostHold, diag.midiSent, nowBeat()])).toEqual([true, held, heldBeat]);
    // Playing: 20 reports a second, as the plugin sends them, the host's beat moving on.
    await page.evaluate(() => new Promise((done) => {
      const from = performance.timeOrigin + performance.now(); let n = 0;
      const id = setInterval(() => {
        const at = performance.timeOrigin + performance.now();
        twirlHost({ tempo: 132, playing: true, beat: 17.25 + (at - from) * 132 / 60000, at, lag: 0 });
        if (++n === 20) { clearInterval(id); done(); }
      }, 50);
    }));
    expect(await page.evaluate(() => [state.bpm, hostHold, $("bpm").disabled, $("hostChip").textContent])).toEqual([132, false, true, "Host: 132 BPM"]);
    // On the host's beat. Within 0.04 beats (18 ms) here: headless Chromium has no
    // sound device and its audio clock moves in coarse steps. In the plugin's web
    // view, against Carla's transport, it measured 0.3 to 2 ms.
    expect(Math.abs(await offBeats())).toBeLessThan(0.04);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => diag.midiSent)).toBeGreaterThan(held);           // and playing
    // The host stops calling the plugin (no reports for a while): as good as stopped.
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => hostHold)).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });

  it("Start over tells the host to end what's sounding", async () => {
    const { page, context } = await openTwirl(browser, { initScript: dpf });
    await page.mouse.click(600, 600);
    await page.evaluate(() => { $("initBtn").click(); $("initBtn").click(); });
    expect(await page.evaluate(() => window.__host.some((m) => m.key === "panic"))).toBe(true);
    await context.close();
  });

  it("in a browser, nothing changes: no host, the sound plays", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => [IN_HOST, state.out, soundOn(), !!diag.audioSent])).toEqual([false, "sound", true, false]);
    await context.close();
  });
});

describe.skipIf(!browser)("Twirl · the clock", () => {
  it("ticks from a Worker (not throttled in the background), and ?clock=main keeps the page's timer", async () => {
    const { page, context } = await openTwirl(browser);
    await page.mouse.click(600, 600);
    await page.waitForTimeout(600);
    const w = await page.evaluate(() => ({ kind: clockKind, ticked: performance.now() - lastWorkerTick < 200 }));
    expect(w).toEqual({ kind: "worker", ticked: true });
    await page.goto(PAGE + "?clock=main"); await page.mouse.click(600, 600); await page.waitForTimeout(400);
    expect(await page.evaluate(() => [clockKind, lastWorkerTick])).toEqual(["main", 0]);
    await context.close();
  });
});
