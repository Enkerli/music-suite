/**
 * exquisite-fingerings' control-plane adoption (docs/CONTROL_PLANE.md §3) — a
 * source of the `scale` data message, closing the fingering → pitch-collection
 * hop (use case U2). The highlighted pitch classes of the current fingering are
 * broadcast on the shared `enkerli-workspace` bus, so PitchFold quantizes to
 * them, PickPCS names them, or the workspace reflects them — no MIDI needed.
 */
import { makeMessage } from "@enkerli/protocol";

let channel = null;
function bus(channelName) {
  if (typeof BroadcastChannel === "undefined") return null;
  return (channel ??= new BroadcastChannel(channelName));
}

/** A suite `scale` message from a set/iterable of pitch classes (mask leftmost = LSB). */
export function scaleMessageFromPcs(pcs, name) {
  const mask = [...pcs].reduce((m, pc) => m | (1 << (((pc % 12) + 12) % 12)), 0);
  return makeMessage("exquisite-fingerings", "scale", { mask, ...(name ? { name } : {}) }, { to: "*" });
}

/** Broadcast the highlighted collection. Returns false where the bus is unavailable. */
export function broadcastFingering(pcs, name, channelName = "enkerli-workspace") {
  const ch = bus(channelName);
  if (!ch) return false;
  ch.postMessage(scaleMessageFromPcs(pcs, name));
  return true;
}
