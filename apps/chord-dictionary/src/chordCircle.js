// Chromatic-circle chord view — a faithful port of MIDIsplainer's
// createChordCircle (Chord-Dictionary branch): note-name bubbles around a
// chromatic rim (C at top, clockwise), coloured by circle-of-fifths, with the
// chord's intervals drawn as a spiral of nodes inside — root innermost,
// extensions outermost — connected in order. Returns an SVG string.
//
// Structural strokes use suite tokens so it reads in light and dark; the note
// colours stay the circle-of-fifths rainbow because here the colour *is* the
// information (it places each note on the cycle of fifths).

const fifthsColors = {
  F: "#00FF00", C: "#FFFF00", G: "#FFC000", D: "#FF8000", A: "#FF0000",
  E: "#FF00FF", B: "#8000FF", "F♯": "#0000FF", "C♯": "#0080FF", "G♯": "#00C0FF",
  "D♯": "#00FFFF", "A♯": "#40FFC0", "B♭": "#40FFC0", "E♭": "#00FFFF",
  "A♭": "#00C0FF", "D♭": "#0080FF", "G♭": "#0000FF",
};
const pitchClassColors = {
  "B♯": fifthsColors.C, "E♯": fifthsColors.F, "F♭": fifthsColors.E, "C♭": fifthsColors.B,
};

// Where each interval sits around the chromatic circle (0 = C at top).
const intervalToPosition = {
  R: 0, "♭2": 1, 2: 2, "♯2": 3, "♭3": 3, 3: 4, 4: 5, "♯4": 6,
  "♭5": 6, 5: 7, "♯5": 8, "♭6": 8, 6: 9, "𝄫7": 9, "♭7": 10, 7: 11,
  "♭9": 1, 9: 2, "♯9": 3, 11: 5, "♯11": 6, "♭13": 8, 13: 9,
};
// How far in from the rim each interval node sits (root deepest, tensions out).
const intervalRadialPosition = {
  R: 0, 2: 0.1, "♭2": 0.05, "♯2": 0.15, 3: 0.2, "♭3": 0.15,
  4: 0.25, "♯4": 0.3, 5: 0.35, "♭5": 0.3, "♯5": 0.4, 6: 0.45, "♭6": 0.4,
  7: 0.55, "♭7": 0.5, "𝄫7": 0.45, 9: 0.65, "♭9": 0.6, "♯9": 0.7,
  11: 0.8, "♯11": 0.85, 13: 0.95, "♭13": 0.9,
};
const rootPositions = {
  C: 0, "C♯": 1, "D♭": 1, D: 2, "D♯": 3, "E♭": 3, E: 4, F: 5, "F♯": 6,
  "G♭": 6, G: 7, "G♯": 8, "A♭": 8, A: 9, "A♯": 10, "B♭": 10, B: 11, "C♭": 11,
};
const allSpellings = [
  ["C"], ["C♯", "D♭"], ["D"], ["D♯", "E♭"], ["E"], ["F"],
  ["F♯", "G♭"], ["G"], ["G♯", "A♭"], ["A"], ["A♯", "B♭"], ["B"],
];

function isColorDark(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

const radius = 100, centerX = 150, centerY = 150, noteRadius = 12;
const minRadius = -90, maxRadius = -10;

function notePosition(hour, radiusOffset = 0) {
  const angle = (hour * 30 - 90) * (Math.PI / 180); // C at top, clockwise
  return {
    x: centerX + (radius + radiusOffset) * Math.cos(angle),
    y: centerY + (radius + radiusOffset) * Math.sin(angle),
  };
}

/**
 * @param {object} a
 * @param {string} a.root spelled root, e.g. "E♭"
 * @param {string[]} a.intervals interval tokens, e.g. ["R","3","5","♭7"]
 * @param {string[]} a.notes spelled chord tones aligned to intervals
 * @param {boolean} [a.showOnlyChordTones] rim shows only chord tones (default true)
 * @returns {string} SVG markup
 */
export function chordCircleSVG({ root, intervals, notes, showOnlyChordTones = true }) {
  const chordNotes = new Set(notes);
  const rootPos = rootPositions[root] ?? 0;

  const intervalNodes = intervals.map((interval, i) => {
    const position = ((intervalToPosition[interval] ?? 0) + rootPos) % 12;
    const radialPos = intervalRadialPosition[interval] ?? 0;
    const radiusOffset = minRadius + (maxRadius - minRadius) * radialPos;
    return { ...notePosition(position, radiusOffset), interval, note: notes[i] };
  });

  let svg = `<svg viewBox="0 0 300 300" style="width:100%;max-width:300px;height:auto;">`;

  // Reference spokes + main rim, using theme tokens so dark mode works.
  svg += allSpellings.map((_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    return `<line x1="${centerX}" y1="${centerY}" x2="${centerX + radius * Math.cos(a)}" y2="${centerY + radius * Math.sin(a)}" stroke="var(--es-border)" stroke-width="1" stroke-dasharray="2,2"/>`;
  }).join("");
  svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="var(--es-border-strong)" stroke-width="1"/>`;

  // Rim note bubbles — chord tones outlined; extra spellings faded (or hidden).
  allSpellings.forEach((spellings, i) => {
    const sorted = [...spellings].sort((a, b) => {
      const ac = chordNotes.has(a), bc = chordNotes.has(b);
      if (ac === bc) return a.includes("♭") ? -1 : 1;
      return ac ? 1 : -1;
    });
    sorted.forEach((note, spellIndex) => {
      const isChordTone = chordNotes.has(note);
      if (showOnlyChordTones && !isChordTone) return;
      const xOffset = sorted.length > 1 ? (spellIndex === 0 ? -8 : 8) : 0;
      const base = notePosition(i, 20);
      const x = base.x + xOffset, y = base.y;
      const color = fifthsColors[note] || pitchClassColors[note] || "#888";
      const textColor = isColorDark(color) ? "#fff" : "#000";
      svg += `<g><circle cx="${x}" cy="${y}" r="${noteRadius}" fill="${color}" stroke="${isChordTone ? "var(--es-fg)" : "none"}" stroke-width="${isChordTone ? 2.5 : 0}" opacity="${isChordTone ? 0.95 : 0.4}"/>`;
      svg += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="${textColor}">${note}</text></g>`;
    });
  });

  // Spiral: connect interval nodes in order, then draw the nodes.
  for (let i = 0; i < intervalNodes.length - 1; i++) {
    const c = intervalNodes[i], n = intervalNodes[i + 1];
    svg += `<line x1="${c.x}" y1="${c.y}" x2="${n.x}" y2="${n.y}" stroke="var(--es-fg-muted)" stroke-width="2"/>`;
  }
  intervalNodes.forEach((node) => {
    const color = fifthsColors[node.note] || pitchClassColors[node.note] || "#888";
    const textColor = isColorDark(color) ? "#fff" : "#000";
    svg += `<g><circle cx="${node.x}" cy="${node.y}" r="${noteRadius}" fill="${color}" stroke="var(--es-fg)" stroke-width="2"/>`;
    svg += `<text x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central" font-size="12" font-weight="bold" fill="${textColor}">${node.interval}</text></g>`;
  });

  svg += `</svg>`;
  return svg;
}
