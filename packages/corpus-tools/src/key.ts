/**
 * Key/mode inference. Corpus lead sheets carry only a major key
 * SIGNATURE (DBKeySig); whether a tune is in the major key or its
 * relative minor was guessed implicitly by the old pipeline. Here the
 * rule is explicit and each decision carries its evidence:
 *
 *   1. Candidate tonics: the signature root (major) and its relative
 *      minor (two letters down, three semitones down — properly spelled:
 *      E♭ → C, G♭ → E♭, F♯ → D♯).
 *   2. The LAST chord is the strongest witness; the FIRST chord is the
 *      tie-breaker. A candidate wins a witness when the chord root
 *      matches its tonic pitch class AND the quality agrees with the
 *      mode (minor-family quality for the minor candidate, otherwise
 *      the major candidate).
 *   3. No witness for the minor candidate → major (the signature's own
 *      reading).
 */

import {
  parseChordSymbol,
  parseSpelled,
  formatSpelled,
  spelledToPc,
  transposeSpelled,
  type KeyContext,
} from "@enkerli/theory";

export interface KeyInference {
  key: KeyContext;
  /** "last-chord", "first-chord", or "default-major". */
  evidence: string;
}

const MINOR_FAMILY = /^(m($|[^a-z])|m[0-9]|mi$|min|m7|m6|m9|m11|m13|mM|dim|o(7)?$|h7)/;

function isMinorFamily(suffix: string): boolean {
  return MINOR_FAMILY.test(suffix);
}

/** Relative minor tonic of a major key signature, properly spelled. */
export function relativeMinorTonic(keySigRoot: string): string | undefined {
  const root = parseSpelled(keySigRoot);
  if (!root) return undefined;
  // Down a minor third = up a major sixth: 5 letter steps, 9 semitones.
  return formatSpelled(transposeSpelled(root, 5, 9));
}

export function inferKey(
  keySigRoot: string,
  firstChordSymbol: string | undefined,
  lastChordSymbol: string | undefined,
): KeyInference | undefined {
  const majorTonic = parseSpelled(keySigRoot);
  if (!majorTonic) return undefined;
  const minorTonicName = relativeMinorTonic(keySigRoot)!;
  const minorPc = spelledToPc(parseSpelled(minorTonicName)!);

  const witness = (symbol: string | undefined): "minor" | "major" | undefined => {
    if (!symbol) return undefined;
    const chord = parseChordSymbol(symbol);
    if (!chord) return undefined;
    const pc = spelledToPc(chord.root);
    if (pc === minorPc && isMinorFamily(chord.suffix)) return "minor";
    if (pc === spelledToPc(majorTonic)) return "major";
    return undefined;
  };

  const last = witness(lastChordSymbol);
  if (last) {
    return {
      key: last === "minor"
        ? { tonic: minorTonicName, mode: "minor" }
        : { tonic: formatSpelled(majorTonic), mode: "major" },
      evidence: "last-chord",
    };
  }
  const first = witness(firstChordSymbol);
  if (first) {
    return {
      key: first === "minor"
        ? { tonic: minorTonicName, mode: "minor" }
        : { tonic: formatSpelled(majorTonic), mode: "major" },
      evidence: "first-chord",
    };
  }
  return {
    key: { tonic: formatSpelled(majorTonic), mode: "major" },
    evidence: "default-major",
  };
}
