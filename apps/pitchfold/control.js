/**
 * PitchFold's control-plane adoption (docs/CONTROL_PLANE.md §3) — the receive
 * half of the PickPCS → PitchFold pair over the in-browser bus. A `scale`
 * message on the shared `enkerli-workspace` bus lands on the SAME `onScale`
 * handler PitchFold already uses for MIDI-SysEx scale pushes (webmidi-bridge.js
 * makeScaleIngest), so the engine, pads context, and JUCE param all follow
 * exactly as before — one handler, two transports.
 */
import { validateMessage } from "@enkerli/protocol";

/**
 * Route a bus message to PitchFold's scale handler if it is a valid `scale`
 * addressed to pitchfold (or broadcast). Pure over `onScale`; returns whether
 * it acted. Never throws on foreign/invalid data.
 */
export function applyScaleMessage(onScale, msg) {
  if (!validateMessage(msg).ok) return false;
  if (msg.type !== "scale" || (msg.to !== "*" && msg.to !== "pitchfold")) return false;
  onScale(msg.body, msg.from);
  return true;
}

/** Listen on the shared bus and feed scale pushes to `onScale`. Returns a disconnect fn. */
export function connectPitchFold({ onScale, channelName = "enkerli-workspace" }) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (e) => applyScaleMessage(onScale, e.data);
  return () => channel.close();
}
