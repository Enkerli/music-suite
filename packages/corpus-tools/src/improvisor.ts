/**
 * Impro-Visor leadsheet (.ls) adapter — parses the imaginary-book corpus
 * format (https://github.com/Impro-Visor/Impro-Visor) into the same
 * LeadSheet shape as the Bunks-format parser, so the rest of the pipeline
 * (key inference, degree assertion, transitions, audit) is shared.
 *
 * Format notes:
 *   - S-expression headers: (title …) (composer …) (key -3) (meter 4 4)
 *     where key is the signature as a sharps count (negative = flats).
 *   - Chord grid lines contain '|' bar separators; melody lines (in later
 *     (part (type melody)) sections) use lowercase note/rest tokens and
 *     are rejected by token shape, not by section tracking.
 *   - '/' repeats the previous chord; expanded here so bar contents stay
 *     faithful (transition extraction collapses repeats anyway).
 */

import { formatSpelled, parseSpelled, transposeSpelled } from "@enkerli/theory";
import type { LeadSheet } from "./leadsheet.js";

/** Major-key tonic for a signature given as a sharps count (negative = flats). */
export function keySigFromSharps(sharps: number): string | undefined {
  if (!Number.isInteger(sharps) || Math.abs(sharps) > 7) return undefined;
  const c = parseSpelled("C")!;
  // Each sharp = up a fifth (4 letters, 7 semitones); each flat = down a fifth.
  const steps = sharps >= 0 ? 4 * sharps : -4 * -sharps;
  const semis = sharps >= 0 ? 7 * sharps : -7 * -sharps;
  return formatSpelled(transposeSpelled(c, steps, semis));
}

const CHORD_TOKEN = /^([A-G](b|#)?[^|()\s]*|NC|\/)$/;

function isChordLine(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((t) => CHORD_TOKEN.test(t));
}

export function parseImproVisorLeadSheet(text: string): LeadSheet {
  const sheet: LeadSheet = { title: "", bars: [], issues: [] };

  const title = /\(title\s+([^)]*)\)/.exec(text);
  if (title) sheet.title = title[1]!.trim();
  const composer = /\(composer\s+([^)]*)\)/.exec(text);
  if (composer && composer[1]!.trim()) sheet.composer = composer[1]!.trim();
  const meter = /\(meter\s+(\d+)\s+(\d+)\)/.exec(text);
  if (meter) sheet.timeSig = `${meter[1]} ${meter[2]}`;
  const key = /\(key\s+(-?\d+)\)/.exec(text);
  if (key) {
    const tonic = keySigFromSharps(parseInt(key[1]!, 10));
    if (tonic) sheet.keySig = tonic;
    else sheet.issues.push(`unintelligible key signature: ${key[1]}`);
  }

  let previousChord: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("(") || !trimmed.includes("|")) continue;

    const cells = trimmed.split("|").map((c) => c.trim());
    if (cells.length > 0 && cells[0] === "") cells.shift();
    if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();

    const allTokens = cells.flatMap((c) => (c === "" ? [] : c.split(/\s+/)));
    if (!isChordLine(allTokens)) continue; // melody or other content

    for (const cell of cells) {
      const tokens = cell === "" ? [] : cell.split(/\s+/);
      const bar: string[] = [];
      for (const token of tokens) {
        if (token === "/") {
          if (previousChord) bar.push(previousChord);
          continue;
        }
        bar.push(token);
        previousChord = token;
      }
      sheet.bars.push(bar);
    }
  }

  if (!sheet.title) sheet.issues.push("missing title");
  if (!sheet.keySig) sheet.issues.push("missing key signature");
  if (sheet.bars.length === 0) sheet.issues.push("no bars");
  return sheet;
}

/** Quick sniff: is this text an Impro-Visor leadsheet? */
export function looksLikeImproVisor(text: string): boolean {
  return /\(title\s/.test(text) && /\(key\s/.test(text);
}
