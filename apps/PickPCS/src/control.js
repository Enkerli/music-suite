/**
 * PickPCS's control-plane adoption (docs/CONTROL_PLANE.md §3) — the THIRD app
 * wired in, and the first to prove the pattern for a **data** message (`scale`)
 * rather than param/command. PickPCS is a *source*: it broadcasts its current
 * pitch-class set onto the shared `enkerli-workspace` bus, so PitchFold (or the
 * workspace, or any same-origin tab) can act on it — the canonical PickPCS →
 * PitchFold pair, now over the in-browser bus in addition to MIDI SysEx
 * (scale-push.js). Same message, one more transport.
 */
import { makeMessage } from "@enkerli/protocol";

let channel = null;
function bus(channelName) {
  if (typeof BroadcastChannel === "undefined") return null;
  return (channel ??= new BroadcastChannel(channelName));
}

/** Build the suite `scale` message for a selection (mask leftmost = LSB). */
export function scaleMessage(scale) {
  return makeMessage("pickpcs", "scale", scale, { to: "*" });
}

/** Broadcast the selected scale onto the bus. Returns false where the bus is unavailable. */
export function broadcastScale(scale, channelName = "enkerli-workspace") {
  const ch = bus(channelName);
  if (!ch) return false;
  ch.postMessage(scaleMessage(scale));
  return true;
}
