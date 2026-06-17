/**
 * Canonical pitch-class colours — Alex's hardware-validated Exquis
 * "Chromeful" identity (from Intuitive Instruments Exquis layout
 * Chromeful.xqilayout; verified on the device, screenshot + firmware).
 *
 * This is the JS source of truth for "what colour is each pitch class" in
 * the suite. `pad` is the exact vivid LED colour (for dark / pad / LED
 * surfaces); `ink` is the per-pad label colour (black or white, picked
 * for legibility exactly as the Exquis does). For chips on the theme
 * surfaces, use the CSS tokens --es-pc-N (tone-mapped to ≥3:1 per theme);
 * --es-pc-pad-N / --es-pc-pad-ink-N mirror this table.
 *
 * Bit/index convention: pc 0 = C (CONVENTIONS.md).
 */

export const PITCH_CLASS_COLORS = [
  { name: "C",  pad: "#f2f20d", ink: "#0d0d0d" },
  { name: "C♯", pad: "#7f0df2", ink: "#ffffff" },
  { name: "D",  pad: "#0df20d", ink: "#0d0d0d" },
  { name: "D♯", pad: "#f24060", ink: "#0d0d0d" },
  { name: "E",  pad: "#0df2f2", ink: "#0d0d0d" },
  { name: "F",  pad: "#f27f0d", ink: "#0d0d0d" },
  { name: "F♯", pad: "#0d0df2", ink: "#ffffff" },
  { name: "G",  pad: "#40f2a0", ink: "#0d0d0d" },
  { name: "G♯", pad: "#f20df2", ink: "#0d0d0d" },
  { name: "A",  pad: "#0dbf40", ink: "#0d0d0d" },
  { name: "A♯", pad: "#f20d0d", ink: "#0d0d0d" },
  { name: "B",  pad: "#0d7ff2", ink: "#0d0d0d" },
];

/** Exact Exquis pad colour for a pitch class (0–11). */
export const padColor = (pc) => PITCH_CLASS_COLORS[((pc % 12) + 12) % 12].pad;

/** Legible label colour (black/white) for a pitch class's pad. */
export const padInk = (pc) => PITCH_CLASS_COLORS[((pc % 12) + 12) % 12].ink;
