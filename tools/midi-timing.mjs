#!/usr/bin/env node
/**
 * MIDI timing analyser — what a .mid file actually says, in ticks.
 *
 * WHY TICKS AND NOT MILLISECONDS. A tick position is tempo-independent and is
 * exactly what a DAW stores; milliseconds are a rendering of it. Asserting in
 * ms means a tempo change reads as a timing bug, and a rounding difference
 * reads as drift. Everything here is integer ticks against the file's own
 * division.
 *
 * WHAT THIS IS FOR. Serpe's timing has been argued about by ear for a year and
 * measured almost never. `msuite upi --midi` renders what the notation SHOULD
 * produce; `serpe_dataflow_probe` renders what the engine DID produce; a DAW
 * capture is what a host actually recorded. All three are .mid, so all three
 * can be compared to each other with one tool instead of three opinions.
 *
 *   node tools/midi-timing.mjs FILE.mid                  describe it
 *   node tools/midi-timing.mjs FILE.mid --expect "0 360 720"    assert onsets
 *   node tools/midi-timing.mjs A.mid --against B.mid     diff two renderings
 *   node tools/midi-timing.mjs A.mid --against B.mid --tolerance 24
 *   node tools/midi-timing.mjs FILE.mid --json           machine-readable
 *
 * TOLERANCE, and when it is honest to use one. Comparing two RENDERINGS of the
 * same notation should be tick-exact — both are computed, so any difference is
 * a real disagreement. Comparing a rendering against something a real engine
 * PLAYED is different: `serpe_dataflow_probe` advances in whole audio blocks,
 * so its onsets carry up to one block of quantisation (512 samples at 48k is
 * ~10.7ms, which at 120bpm and 960 ticks/quarter is ~20 ticks). Measured on
 * serpe-accent-mono.mid: deltas of 471/492/941/962 where the notation says
 * 480/960. Use --tolerance for that comparison and NOT for reference-vs-
 * reference, or it hides exactly the drift it was added to accommodate.
 *
 * Exit 0 when every requested check passes, 1 otherwise — so it works in a
 * script without reading the prose.
 *
 * NOT a musical judgement. "The ticks match" is not "it sounds right"; the
 * .mid artifacts exist so a person can also listen. This tool only removes the
 * cases where the disagreement is arithmetic.
 */
import { readFileSync } from "node:fs";

// ── SMF reading ─────────────────────────────────────────────────────────────
// Deliberately minimal: header + note-ons + tempo. No sysex interpretation, no
// track names. Running status IS handled — JUCE writes it, and a parser that
// ignores it silently loses notes rather than failing, which is the worst
// possible behaviour for a measurement tool.

function readVarLen(d, i) {
  let v = 0;
  for (;;) {
    const b = d[i++];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) return [v, i];
  }
}

/** @returns {{division:number, tracks:number, notes:Array, tempos:Array}} */
export function parseSMF(buf) {
  if (buf.length < 14 || buf.toString("latin1", 0, 4) !== "MThd")
    throw new Error("not a Standard MIDI File (no MThd)");
  const division = buf.readUInt16BE(12);
  if (division & 0x8000)
    throw new Error("SMPTE time division is not supported — this suite writes ticks-per-quarter");

  const notes = [], tempos = [], offs = [];
  let i = 14, tracks = 0;
  while (i + 8 <= buf.length) {
    if (buf.toString("latin1", i, i + 4) !== "MTrk") break;
    const len = buf.readUInt32BE(i + 4);
    let p = i + 8;
    const end = Math.min(p + len, buf.length);
    let t = 0, status = 0;
    tracks++;
    while (p < end) {
      let dt;
      [dt, p] = readVarLen(buf, p);
      t += dt;
      let b = buf[p];
      if (b & 0x80) { status = b; p++; }        // else: running status, reuse
      const kind = status & 0xf0;
      if (kind === 0x90 || kind === 0x80) {
        const note = buf[p], vel = buf[p + 1];
        p += 2;
        // A note-on with velocity 0 is a note-off. Counting it as an onset
        // doubles every note in files that use that convention.
        if (kind === 0x90 && vel > 0)
          notes.push({ tick: t, note, vel, channel: (status & 0x0f) + 1 });
        else
          offs.push({ tick: t, note, channel: (status & 0x0f) + 1 });
      } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) p += 2;
      else if (kind === 0xc0 || kind === 0xd0) p += 1;
      else if (status === 0xff) {
        const type = buf[p++];
        let l;
        [l, p] = readVarLen(buf, p);
        if (type === 0x51 && l === 3)
          tempos.push({ tick: t, usPerQuarter: (buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2] });
        p += l;
      } else if (status === 0xf0 || status === 0xf7) {
        let l;
        [l, p] = readVarLen(buf, p);
        p += l;
      } else break;                              // unknown status: stop this track
    }
    i = end;
  }
  notes.sort((a, b) => a.tick - b.tick || a.note - b.note);
  return { division, tracks, notes, tempos, offs };
}

// ── measurements ────────────────────────────────────────────────────────────

/** Onset ticks, de-duplicated: simultaneous notes are ONE onset in time. */
export const onsetTicks = (notes) => [...new Set(notes.map((n) => n.tick))].sort((a, b) => a - b);

/** Gaps between consecutive onsets — the shape of a rhythm, independent of
 *  where it starts. Two renderings that differ only by a leading rest have
 *  identical deltas, which is usually the question being asked. */
export const deltas = (ticks) => ticks.slice(1).map((t, k) => t - ticks[k]);

/**
 * Group notes by pitch. Serpe renders each poly lane on its own note number,
 * so this is how a lane's own timeline is recovered from the mixed stream —
 * without it, `E(3,8)/E(3,7)` is twelve interleaved onsets and says nothing
 * about either lane.
 */
export function byNote(notes) {
  const m = new Map();
  for (const n of notes) (m.get(n.note) ?? m.set(n.note, []).get(n.note)).push(n);
  return [...m.entries()].sort((a, b) => a[0] - b[0])
    .map(([note, ns]) => ({ note, ticks: ns.map((x) => x.tick), velocities: [...new Set(ns.map((x) => x.vel))].sort((a, b) => a - b) }));
}

/**
 * Pair every note-on with its note-off and report what the gap to the NEXT
 * onset of the same pitch actually is.
 *
 * Onsets alone cannot distinguish a legato line from a staccato one — the
 * attacks land in the same places. For a wind instrument that difference is
 * most of the performance: Vane's mono bore handoff, its synthetic-breath
 * envelope and its melisma all key off whether a note is still sounding when
 * the next begins. An analyser that drops note-offs is blind to all of it, and
 * this one was until 2026-08-02.
 *
 * `overlap` > 0 means the notes overlap (unambiguous legato), 0 means they abut
 * exactly, < 0 is the silent gap between them.
 */
export function articulation(notes, offs) {
  const byPitch = new Map();
  for (const n of notes) (byPitch.get(n.note) ?? byPitch.set(n.note, []).get(n.note)).push(n);
  const out = [];
  for (const [note, ns] of [...byPitch.entries()].sort((a, b) => a[0] - b[0])) {
    const pool = offs.filter((o) => o.note === note).sort((a, b) => a.tick - b.tick);
    const used = new Set();
    const durs = ns.map((n) => {
      const k = pool.findIndex((o, idx) => !used.has(idx) && o.tick > n.tick);
      if (k < 0) return null;
      used.add(k);
      return pool[k].tick - n.tick;
    });
    const overlaps = ns.slice(0, -1).map((n, k) =>
      durs[k] == null ? null : (n.tick + durs[k]) - ns[k + 1].tick);
    const known = overlaps.filter((v) => v != null);
    const verdict = !known.length ? "single note"
      : known.every((v) => v > 0) ? "legato (overlapping)"
      : known.every((v) => v === 0) ? "legato (abutting)"
      : known.every((v) => v < 0) ? "detached"
      : "mixed";
    out.push({ note, durations: durs, overlaps, verdict });
  }
  return out;
}

/**
 * Articulation of a monophonic LINE — consecutive notes in time, whatever their
 * pitch.
 *
 * Per-pitch grouping above is the right lens for Serpe poly lanes, where each
 * lane owns a note number and a lane's own succession is the question. It is
 * the WRONG lens for a melody: two occurrences of the same pitch four bars
 * apart are not consecutive in any musical sense, and reading their "overlap"
 * says nothing. Melisma — several pitches inside one breath — only shows up
 * here.
 *
 * Only computed when every onset is at a distinct tick. A file with
 * simultaneous onsets is a chord or a poly stack, and "the next note" is not
 * well defined for it.
 */
export function lineArticulation(notes, offs) {
  const ns = [...notes].sort((a, b) => a.tick - b.tick);
  if (new Set(ns.map((n) => n.tick)).size !== ns.length) return null;
  const pool = [...offs].sort((a, b) => a.tick - b.tick);
  const used = new Set();
  const durs = ns.map((n) => {
    const k = pool.findIndex((o, idx) => !used.has(idx) && o.note === n.note && o.tick > n.tick);
    if (k < 0) return null;
    used.add(k);
    return pool[k].tick - n.tick;
  });
  const overlaps = ns.slice(0, -1).map((n, k) =>
    durs[k] == null ? null : (n.tick + durs[k]) - ns[k + 1].tick);
  const known = overlaps.filter((v) => v != null);
  const slurred = known.filter((v) => v >= 0).length;
  const verdict = !known.length ? "single note"
    : known.every((v) => v > 0) ? "legato (overlapping)"
    : known.every((v) => v === 0) ? "legato (abutting)"
    : known.every((v) => v < 0) ? "detached"
    : `mixed — ${slurred}/${known.length} slurred`;
  return { durations: durs, overlaps, verdict, slurred, transitions: known.length };
}

/** Beats, for reading only — the assertions stay in ticks. */
export const toBeats = (tick, division) => tick / division;

// ── reporting ───────────────────────────────────────────────────────────────

export function describe(file) {
  const smf = parseSMF(readFileSync(file));
  const ticks = onsetTicks(smf.notes);
  return {
    file,
    division: smf.division,
    tracks: smf.tracks,
    bpm: smf.tempos.length ? Math.round(60_000_000 / smf.tempos[0].usPerQuarter) : null,
    noteCount: smf.notes.length,
    onsetCount: ticks.length,
    span: ticks.length ? [ticks[0], ticks[ticks.length - 1]] : [],
    onsets: ticks,
    deltas: deltas(ticks),
    lanes: byNote(smf.notes),
    articulation: articulation(smf.notes, smf.offs),
    line: lineArticulation(smf.notes, smf.offs),
  };
}

const list = (a) => a.join(" ");

function print(r) {
  console.log(`${r.file}`);
  console.log(`  division ${r.division} ticks/quarter${r.bpm ? ` · ${r.bpm} bpm` : " · no tempo event"}`
    + ` · ${r.tracks} track(s) · ${r.noteCount} notes, ${r.onsetCount} distinct onsets`);
  if (r.onsets.length)
    console.log(`  span     ${r.span[0]}..${r.span[1]} ticks (${toBeats(r.span[0], r.division).toFixed(3)}..${toBeats(r.span[1], r.division).toFixed(3)} beats)`);
  console.log(`  onsets   ${list(r.onsets)}`);
  console.log(`  deltas   ${list(r.deltas)}`);
  for (const l of r.lanes)
    console.log(`  note ${String(l.note).padEnd(3)} vel ${list(l.velocities).padEnd(8)} ${list(l.ticks)}`);
  if (r.line)
    console.log(`  line     ${r.line.verdict.padEnd(21)}`
      + ` ${r.line.transitions} transition(s)`
      + (r.line.transitions ? `  overlap ${list([...new Set(r.line.overlaps.filter((v) => v != null))])}` : ""));
  for (const a of r.articulation ?? []) {
    const d = [...new Set(a.durations.filter((v) => v != null))];
    const o = [...new Set(a.overlaps.filter((v) => v != null))];
    console.log(`  note ${String(a.note).padEnd(3)} ${a.verdict.padEnd(21)}`
      + ` dur ${list(d)}` + (o.length ? `  overlap ${list(o)}` : ""));
  }
}

/** Two renderings of the same notation — engine vs reference, or before vs
 *  after a change. Compares ONSETS, not the note stream: a velocity or channel
 *  difference is a separate question from a timing one. */
function compare(a, b, tol = 0) {
  const near = (x, y) => Math.abs(x - y) <= tol;
  const same = a.onsets.length === b.onsets.length && a.onsets.every((t, k) => near(t, b.onsets[k]));
  if (same) {
    const worst = Math.max(0, ...a.onsets.map((t, k) => Math.abs(t - b.onsets[k])));
    console.log(`\nMATCH — ${a.onsets.length} onsets`
      + (tol ? `, within ${tol} ticks (worst ${worst})` : ", identical ticks"));
    return true;
  }
  console.log(`\nDIFFER`);
  console.log(`  ${a.file}: ${list(a.onsets)}`);
  console.log(`  ${b.file}: ${list(b.onsets)}`);
  const n = Math.max(a.onsets.length, b.onsets.length);
  for (let k = 0; k < n; k++) {
    const x = a.onsets[k], y = b.onsets[k];
    if (x === undefined || y === undefined || !near(x, y)) {
      console.log(`  first difference at onset ${k}: ${x ?? "(none)"} vs ${y ?? "(none)"}`
        + (x !== undefined && y !== undefined ? `  (off by ${Math.abs(x - y)}${tol ? `, tolerance ${tol}` : ""})` : ""));
      break;
    }
  }
  return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const flag = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? undefined : args[i + 1]; };
  if (!file) {
    console.error("usage: midi-timing.mjs FILE.mid [--expect \"0 360 720\"] [--against OTHER.mid] [--tolerance N] [--json]");
    process.exit(2);
  }
  const r = describe(file);
  if (args.includes("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  print(r);

  let ok = true;
  const expect = flag("expect");
  if (expect !== undefined) {
    const want = expect.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const got = r.onsets;
    const tol = Number(flag("tolerance") ?? 0);
    const hit = want.length === got.length && want.every((t, k) => Math.abs(t - got[k]) <= tol);
    console.log(hit ? `\nEXPECT ok — ${want.length} onsets match`
                    : `\nEXPECT FAILED\n  wanted ${list(want)}\n  got    ${list(got)}`);
    ok &&= hit;
  }
  const against = flag("against");
  if (against !== undefined) ok = compare(r, describe(against), Number(flag("tolerance") ?? 0)) && ok;

  process.exit(ok ? 0 : 1);
}
