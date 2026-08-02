/**
 * The kit — six-ish sounds, each on its own PITCH CLASS.
 *
 * Alex's framing for the drum work: "in drum contexts, MIDI notes are lanes",
 * and each sound is assigned to a pitch class. So the kit is defined by its GM
 * note, and the pitch class falls out of it — which means existing drum MIDI
 * maps straight in with no translation table, and that matters more than
 * anything else here: the whole point of D2 (drum MIDI → pattern) is reading
 * files somebody else wrote.
 *
 * GM notes chosen to avoid pitch-class COLLISIONS, which the standard kit does
 * not otherwise guarantee: GM high tom is 48, and 48 % 12 == 0 == kick. So the
 * high tom is not in this kit; mid and low are, and they do not collide.
 *
 *     kick   36 → pc 0      closed hat 42 → pc 6
 *     crash  49 → pc 1      pedal hat  44 → pc 8
 *     snare  38 → pc 2      mid tom    45 → pc 9
 *     clap   39 → pc 3      open hat   46 → pc 10
 *     low tom 41 → pc 5     ride       59 → pc 11
 *
 * Ten sounds over ten distinct pitch classes {0,1,2,3,5,6,8,9,10,11} — which is
 * a pitch-class set like any other, and PickPCS will happily draw it.
 *
 * The PEDAL HAT was added 2026-08-02 after analysing Alex's EZdrummer jazz
 * waltzes: 11% of every file is the hi-hat foot marking the bar, and it is the
 * voice that makes the meter readable at all (tools/drum-grid.mjs finds the
 * bar from it). Without it the kit could not name the most structurally
 * important drum in the corpus.
 *
 * The RIDE followed for the same reason and from the same corpus: it is 40% of
 * every file, and before this it resolved to a CRASH — a 1.4-second wash where
 * a jazz ride should tick. A kit for this material without a ride is not a kit
 * for this material.
 */

/** @typedef {"kick"|"snare"|"clap"|"closedHat"|"openHat"|"crash"|"lowTom"|"midTom"} DrumName */

export const KIT = {
  kick:      { note: 36, pc: 0,  label: "Kick" },
  crash:     { note: 49, pc: 1,  label: "Crash" },
  snare:     { note: 38, pc: 2,  label: "Snare" },
  // GM 39 is Hand Clap. Toontrack maps the same note to a snare articulation
  // ("Ruffs" / "Half Circle"), verified against their community mapping sheet
  // 2026-08-02 — so a Toontrack file sending 39 will clap here rather than
  // ruff. Kept as GM, because the kit is GM-based and GM is the wider
  // convention; recorded because it is a real disagreement and the kind that
  // otherwise gets rediscovered as "why is there a clap in my jazz take".
  // The jazz-waltz corpus has zero hits on 39, so nothing currently misfires.
  clap:      { note: 39, pc: 3,  label: "Clap" },
  lowTom:    { note: 41, pc: 5,  label: "Low tom" },
  closedHat: { note: 42, pc: 6,  label: "Closed hat" },
  pedalHat:  { note: 44, pc: 8,  label: "Pedal hat" },
  midTom:    { note: 45, pc: 9,  label: "Mid tom" },
  openHat:   { note: 46, pc: 10, label: "Open hat" },
  ride:      { note: 59, pc: 11, label: "Ride" },
};

/** GM note → kit name. Built from KIT so the two cannot drift. */
export const BY_NOTE = Object.fromEntries(
  Object.entries(KIT).map(([name, d]) => [d.note, name]));

/** Pitch class → kit name. */
export const BY_PC = Object.fromEntries(
  Object.entries(KIT).map(([name, d]) => [d.pc, name]));

/**
 * The kit as a pitch-class set — usable anywhere the suite takes one.
 * Sorted, so it reads as a set rather than as a listing order.
 */
export const KIT_PCS = Object.values(KIT).map((d) => d.pc).sort((a, b) => a - b);

/**
 * Notes outside the kit, mapped to the nearest kit sound BY MEANING.
 *
 * Real drum MIDI does not stay inside eight notes. GM alone has three toms, two
 * crashes, a ride and a cowbell; EZdrummer spreads hi-hat articulations across
 * a dozen notes and puts the pedal hat at 21, which is outside GM entirely.
 *
 * This table exists because the pitch-class fallback below is MUSICALLY WRONG
 * for those notes and was silently so: 21 % 12 == 9, so the EZdrummer pedal hat
 * resolved to a mid tom — 11% of a jazz-waltz corpus rendered as a tom, and
 * nothing said anything. Meaning first, arithmetic only as a last resort.
 *
 * Note 21 confirmed against the community EZdrummer mapping sheet and by Alex
 * on EZD2: A-1 is the closed pedal.
 */
const EXTENDED = {
  21: "pedalHat",   // EZdrummer pedal hat — outside GM
  35: "kick",       // acoustic bass drum
  37: "snare",      // side stick (GM and Toontrack agree)
  40: "snare",      // electric snare
  43: "lowTom",     // high floor tom
  44: "pedalHat",   // GM pedal hi-hat
  47: "midTom",     // low-mid tom
  48: "midTom",     // hi-mid tom
  50: "midTom",     // high tom
  // The ride lives at 59 (GM Ride Cymbal 2) rather than 51, because 51 % 12 is
  // 3 and the clap already has that pitch class — and one sound per pitch class
  // is the premise the whole drum mapping rests on. 51 is THE ride note in
  // practice, so it resolves here rather than to a pitch class.
  51: "ride", 53: "ride", 52: "crash", 55: "crash", 57: "crash",
};

/**
 * Resolve whatever a caller has to a kit name.
 *
 * Accepts a name, a GM note, or a bare pitch class. Drum MIDI in the wild uses
 * notes outside this kit constantly (there are three toms, two crashes, a ride,
 * a cowbell…), so an unknown note folds to its pitch class before giving up —
 * a 48 high tom lands on the kick, which is wrong but audible, and silence
 * would be worse for a first pass at somebody's file. Returns null only when
 * even the pitch class is unclaimed.
 */
export function resolveDrum(x) {
  if (typeof x === "string") return KIT[x] ? x : null;
  if (!Number.isInteger(x)) return null;
  if (BY_NOTE[x]) return BY_NOTE[x];
  if (EXTENDED[x]) return EXTENDED[x];
  return BY_PC[((x % 12) + 12) % 12] ?? null;
}

/**
 * Common ways people write these names, → kit name.
 *
 * Lane labels are the natural place to say which drum a lane is —
 * `kick=E(4,16) / hat=E(8,16)` already reads like a drum pattern, and it would
 * be perverse to make someone restate it. But nobody writes "closedHat", so the
 * spellings they DO write have to land.
 */
const ALIASES = {
  bd: "kick", kik: "kick", bass: "kick", bassdrum: "kick", k: "kick",
  sd: "snare", sn: "snare", s: "snare",
  cp: "clap", hc: "clap", handclap: "clap",
  hh: "closedHat", hat: "closedHat", hats: "closedHat", ch: "closedHat",
  chh: "closedHat", closedhat: "closedHat", closed: "closedHat",
  oh: "openHat", ohh: "openHat", openhat: "openHat", open: "openHat",
  cy: "crash", cym: "crash", cymbal: "crash", cr: "crash", ride: "crash",
  lt: "lowTom", tom: "lowTom", floortom: "lowTom", lowtom: "lowTom",
  mt: "midTom", midtom: "midTom", tom2: "midTom",
};

/**
 * A lane label → kit name, or null.
 *
 * Case- and separator-insensitive, so `Closed Hat`, `closed_hat` and `chh` all
 * arrive. Returns null for anything unrecognised rather than guessing: a lane
 * called `bass` is a kick, a lane called `lead` is not a drum at all, and
 * silently mapping it to one would be worse than leaving it where it was.
 */
export function drumForLabel(label) {
  if (typeof label !== "string") return null;
  const k = label.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (KIT[label]) return label;
  for (const name of Object.keys(KIT)) if (name.toLowerCase() === k) return name;
  return ALIASES[k] ?? null;
}
