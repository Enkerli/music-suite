/**
 * Chord Dictionary's control-plane adoption (docs/CONTROL_PLANE.md §3) — a
 * source of the `chord` data message. The currently displayed chord (its
 * pitch-class set, root, and symbol) is broadcast on the shared
 * `enkerli-workspace` bus, so a theory-explorer session can follow one chord
 * across tools with every representation agreeing (use case U3).
 */
import { makeMessage } from "@enkerli/protocol";

let channel = null;
function bus(channelName) {
  if (typeof BroadcastChannel === "undefined") return null;
  return (channel ??= new BroadcastChannel(channelName));
}

/** A suite `chord` message: pcs as a 12-bit mask (leftmost = LSB), plus root + symbol. */
export function chordMessage({ pcs, symbol, root }) {
  const mask = [...pcs].reduce((m, pc) => m | (1 << (((pc % 12) + 12) % 12)), 0);
  return makeMessage("chord-dictionary", "chord", {
    pcs: mask,
    ...(symbol ? { symbol } : {}),
    ...(Number.isInteger(root) ? { root } : {}),
  }, { to: "*" });
}

/** Broadcast the current chord. Returns false where the bus is unavailable. */
export function broadcastChord(chord, channelName = "enkerli-workspace") {
  const ch = bus(channelName);
  if (!ch) return false;
  ch.postMessage(chordMessage(chord));
  return true;
}
