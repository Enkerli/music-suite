/**
 * ProgGenie → suite bus: publish the current progression as a control-plane
 * `progression` message on the cross-tab BroadcastChannel the Workspace
 * listens on (apps/workspace/bus.js, channel "enkerli-workspace").
 *
 * The GloriArp module adopts it as its progression — if a groove is looping
 * there, the handoff lands at the next pass (docs/GLORIARP_NEXT.md slice B):
 * compose here, hear the bassline follow, no copy-paste.
 *
 * The channel opens lazily and stays open (opening per-send can drop the
 * message before the browser flushes it). No-ops where BroadcastChannel is
 * unavailable; returns false so the caller can say so.
 */
import { makeMessage } from "@enkerli/protocol";

let channel = null;

export function publishProgression(prog) {
  if (typeof BroadcastChannel === "undefined" || !prog) return false;
  if (!channel) channel = new BroadcastChannel("enkerli-workspace");
  channel.postMessage(makeMessage("proggenie", "progression", { prog }));
  return true;
}
