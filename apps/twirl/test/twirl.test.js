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
      document.querySelector('[data-insp="span"] [data-v="32"]').click();
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
      $("inspTimingFamily").click();
      const fam = [child.snap, child.feel, child.clock, other.snap || "sheet"];
      $("inspTimingAll").click();
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
