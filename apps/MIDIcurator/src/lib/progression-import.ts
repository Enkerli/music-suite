/**
 * Recover a leadsheet from a ProgGenie-exported SMF. ProgGenie embeds the
 * canonical theory Progression (MCURATOR:v1 PROG payload); on import we
 * realize it to absolute spelled chord symbols and lay them out as
 * bar-notation text, which MIDIcurator's own parseLeadsheet then turns
 * into its Leadsheet annotation. This is the read half of the first
 * horizontal suite link (SUITE_AUDIT_AND_PLAN §7 step 4).
 */

import { progressionFromSMF } from '@enkerli/midi';
import { realizeLeadsheet, type Progression } from '@enkerli/theory';

/** The embedded Progression, or null if the SMF carries none. */
export function readEmbeddedProgression(midiBuffer: ArrayBuffer): Progression | null {
  return progressionFromSMF(new Uint8Array(midiBuffer));
}

/**
 * Realize a Progression to absolute bar-notation text, distributing its
 * chords across `numBars` bars so the sequence aligns with the imported
 * clip's meter. Returns null when there is nothing to lay out.
 */
export function leadsheetTextFromProgression(prog: Progression, numBars: number): string | null {
  const symbols = realizeLeadsheet(prog).flat().map((c) => c.symbol);
  if (symbols.length === 0) return null;
  const bars = Math.max(1, numBars);
  const perBar = Math.max(1, Math.ceil(symbols.length / bars));
  const out: string[] = [];
  for (let i = 0; i < symbols.length; i += perBar) {
    out.push(symbols.slice(i, i + perBar).join(' '));
  }
  return out.join(' | ');
}
