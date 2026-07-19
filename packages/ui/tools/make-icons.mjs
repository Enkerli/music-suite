#!/usr/bin/env node
/**
 * Suite icon generator — one grammar, every app.
 *
 * Grammar: paper tile (cream, soft radius, hairline border), ink glyph,
 * exactly ONE accent hue per app drawn from the dimension palette so the
 * family reads as a set. Colors are literals (icons render outside any
 * CSS context) taken from tokens.css light theme — light is the suite's
 * default design target.
 *
 * Outputs SVG sources to packages/ui/icons/. PNGs for JUCE ICON_BIG are
 * rendered by tools/render-icon.swift. Regenerate after edits here:
 *   node packages/ui/tools/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAPER = "#f5f2eb", RAISED = "#fcfbf7", INK = "#2d2b27", BORDER = "#ddd6ca";
const ACCENT = {
  breath: "#3b79be",   // action blue (deepened breath)
  expr: "#2d9d8a",
  pressure: "#d28330",
  slide: "#a35bbf",
  bend: "#c39529",
  vel: "#7a4cff",
};

const tile = (glyph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="16" y="16" width="992" height="992" rx="208" fill="${PAPER}"/>
  <rect x="16" y="16" width="992" height="992" rx="208" fill="none" stroke="${BORDER}" stroke-width="12"/>
${glyph}
</svg>
`;

const dot = (x, y, r, fill, stroke = INK, sw = 14) =>
  `  <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

/** 12 dots on a ring; `filled` pcs get the accent. pc 0 at top, clockwise. */
function pcsRing(cx, cy, r, dotR, filled, accent) {
  const out = [];
  for (let pc = 0; pc < 12; pc++) {
    const a = (pc / 12) * Math.PI * 2;
    const x = (cx + r * Math.sin(a)).toFixed(1);
    const y = (cy - r * Math.cos(a)).toFixed(1);
    out.push(dot(x, y, dotR, filled.includes(pc) ? accent : RAISED));
  }
  return out.join("\n");
}

const icons = {
  // ProgGenie — a voice-leading path: chords as dot-columns, smooth steps.
  proggenie: tile(`
  <polyline points="240,672 460,560 686,604 814,432" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
${dot(240, 672, 56, ACCENT.breath)}
${dot(240, 520, 40, RAISED)}
${dot(460, 560, 56, ACCENT.breath)}
${dot(460, 408, 40, RAISED)}
${dot(686, 604, 56, ACCENT.breath)}
${dot(686, 452, 40, RAISED)}
${dot(814, 432, 56, ACCENT.breath)}
${dot(814, 280, 40, RAISED)}`),

  // MIDIcurator — curated clip bars (piano-roll grammar), one bar chosen.
  midicurator: tile(`
  <rect x="232" y="312" width="384" height="96" rx="48" fill="${RAISED}" stroke="${INK}" stroke-width="14"/>
  <rect x="312" y="464" width="480" height="96" rx="48" fill="${ACCENT.expr}" stroke="${INK}" stroke-width="14"/>
  <rect x="232" y="616" width="288" height="96" rx="48" fill="${RAISED}" stroke="${INK}" stroke-width="14"/>
  <path d="M 696 632 l 44 52 84 -104" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`),

  // PitchFold — an outlier note folds onto the scale ring.
  pitchfold: tile(`
${pcsRing(512, 512, 268, 42, [0, 2, 4, 5, 7, 9, 11], ACCENT.slide)}
${dot(512, 512, 30, INK, INK, 0)}
  <path d="M 776 240 Q 668 276 600 348" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round"/>
  <path d="M 596 296 L 600 348 L 652 350" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
${dot(800, 222, 34, RAISED)}`),

  // PickPCS — the ring itself, a set picked out.
  pickpcs: tile(`
${pcsRing(512, 512, 268, 46, [0, 3, 7, 10], ACCENT.pressure)}
${dot(512, 512, 96, RAISED)}`),

  // exquisite-fingerings — hex cluster, fingertip on one pad.
  "exquisite-fingerings": tile(`
  <g stroke="${INK}" stroke-width="16" stroke-linejoin="round">
    <polygon points="512,180 688,282 688,486 512,588 336,486 336,282" fill="${RAISED}"/>
    <polygon points="336,486 512,588 512,792 336,894 160,792 160,588" fill="${RAISED}" transform="translate(0,-102)"/>
    <polygon points="688,486 864,588 864,792 688,894 512,792 512,588" fill="${ACCENT.bend}" transform="translate(0,-102)"/>
  </g>
${dot(688, 690, 56, INK, INK, 0)}`),

  // Chord dictionary — the symbol on the page, serif voice.
  "chord-dictionary": tile(`
  <rect x="232" y="200" width="560" height="624" rx="40" fill="${RAISED}" stroke="${INK}" stroke-width="16"/>
  <line x1="312" y1="640" x2="712" y2="640" stroke="${BORDER}" stroke-width="14"/>
  <line x1="312" y1="720" x2="600" y2="720" stroke="${BORDER}" stroke-width="14"/>
  <text x="512" y="500" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="300" fill="${INK}">C<tspan fill="${ACCENT.vel}">∆</tspan></text>`),

  // Workspace — movable module tiles wired to one bus. (Glyph is a first
  // pass in the family grammar; flag for the design pass.)
  workspace: tile(`
  <g stroke="${INK}" stroke-width="16">
    <line x1="496" y1="332" x2="560" y2="332"/>
    <line x1="332" y1="432" x2="332" y2="496"/>
    <line x1="676" y1="552" x2="676" y2="616"/>
    <line x1="432" y1="704" x2="496" y2="704"/>
  </g>
  <g stroke="${INK}" stroke-width="16">
    <rect x="232" y="232" width="264" height="200" rx="40" fill="${RAISED}"/>
    <rect x="560" y="232" width="232" height="320" rx="40" fill="${RAISED}"/>
    <rect x="232" y="496" width="200" height="296" rx="40" fill="${ACCENT.breath}"/>
    <rect x="496" y="616" width="296" height="176" rx="40" fill="${RAISED}"/>
  </g>`),

  // Style gallery — the palette itself.
  "style-gallery": tile(`
  <g stroke="${INK}" stroke-width="14">
    <rect x="260" y="260" width="220" height="220" rx="48" fill="${ACCENT.breath}"/>
    <rect x="544" y="260" width="220" height="220" rx="48" fill="${ACCENT.pressure}"/>
    <rect x="260" y="544" width="220" height="220" rx="48" fill="${ACCENT.expr}"/>
    <rect x="544" y="544" width="220" height="220" rx="48" fill="${RAISED}"/>
  </g>`),
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "icons");
mkdirSync(outDir, { recursive: true });
for (const [name, svg] of Object.entries(icons)) {
  writeFileSync(join(outDir, `${name}.svg`), svg);
  console.log(`icons/${name}.svg`);
}
