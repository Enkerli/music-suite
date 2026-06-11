/**
 * Lead-sheet text parser for the corpus format:
 *
 *   Title = Misty
 *   ComposedBy = Erroll Garner
 *   DBKeySig = Eb
 *   TimeSig = 4 4
 *   Bars = 32
 *    EbM7 | Bbm7 Eb7 | AbM7 | ... |
 *
 * Grid lines start with whitespace; bars are separated by '|'; a bar cell
 * holds zero or more whitespace-separated chord symbols. The parser never
 * throws on content problems — it records issues for the audit.
 */

export interface LeadSheet {
  title: string;
  composer?: string;
  /** Key signature root as written (always notated as a major signature). */
  keySig?: string;
  timeSig?: string;
  barsDeclared?: number;
  /** Chord symbols per bar, in order. */
  bars: string[][];
  issues: string[];
}

export function parseLeadSheet(text: string): LeadSheet {
  const sheet: LeadSheet = { title: "", bars: [], issues: [] };

  for (const line of text.split(/\r?\n/)) {
    if (/^\s/.test(line) && line.includes("|")) {
      // Grid line: cells between pipes; drop empty edge cells.
      const cells = line.split("|").map((c) => c.trim());
      if (cells.length > 0 && cells[0] === "") cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
      for (const cell of cells) {
        sheet.bars.push(cell === "" ? [] : cell.split(/\s+/));
      }
      continue;
    }

    const header = /^(\w+)\s*=\s*(.*)$/.exec(line.trim());
    if (!header) continue;
    const value = header[2]!.trim();
    switch (header[1]) {
      case "Title": sheet.title = value; break;
      case "ComposedBy": sheet.composer = value; break;
      case "DBKeySig": sheet.keySig = value; break;
      case "TimeSig": sheet.timeSig = value; break;
      case "Bars": {
        const n = parseInt(value, 10);
        if (!Number.isNaN(n)) sheet.barsDeclared = n;
        break;
      }
    }
  }

  if (!sheet.title) sheet.issues.push("missing Title");
  if (!sheet.keySig) sheet.issues.push("missing DBKeySig");
  if (sheet.bars.length === 0) sheet.issues.push("no bars");
  if (sheet.barsDeclared !== undefined && sheet.bars.length !== sheet.barsDeclared) {
    sheet.issues.push(`bar count mismatch: declared ${sheet.barsDeclared}, found ${sheet.bars.length}`);
  }
  return sheet;
}

/** True when the text looks like a lead sheet at all (has the header). */
export function looksLikeLeadSheet(text: string): boolean {
  return /^Title = /m.test(text);
}
