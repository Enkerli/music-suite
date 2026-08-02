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
 *     crash  49 → pc 1      mid tom    45 → pc 9
 *     snare  38 → pc 2      open hat   46 → pc 10
 *     clap   39 → pc 3      low tom    41 → pc 5
 *
 * Eight sounds over eight distinct pitch classes {0,1,2,3,5,6,9,10} — which is
 * a pitch-class set like any other, and PickPCS will happily draw it.
 */

/** @typedef {"kick"|"snare"|"clap"|"closedHat"|"openHat"|"crash"|"lowTom"|"midTom"} DrumName */

export const KIT = {
  kick:      { note: 36, pc: 0,  label: "Kick" },
  crash:     { note: 49, pc: 1,  label: "Crash" },
  snare:     { note: 38, pc: 2,  label: "Snare" },
  clap:      { note: 39, pc: 3,  label: "Clap" },
  lowTom:    { note: 41, pc: 5,  label: "Low tom" },
  closedHat: { note: 42, pc: 6,  label: "Closed hat" },
  midTom:    { note: 45, pc: 9,  label: "Mid tom" },
  openHat:   { note: 46, pc: 10, label: "Open hat" },
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
