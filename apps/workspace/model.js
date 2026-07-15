/**
 * Workspace module model — the non-DOM logic (unit-tested in node): turning a
 * tool manifest into control-surface messages, and mapping a normalized slider
 * position to a param's native value. Reuses the plane's own pieces so the
 * workspace is genuinely a *thin adapter*: @enkerli/protocol builds the
 * messages, @enkerli/control does the scale-aware normalization (so a log Vane
 * cutoff slider behaves exactly like a log Vane cutoff CC binding).
 */
import { makeParam, makeCommand } from "@enkerli/protocol";
import { ccToNative, nativeToCc } from "@enkerli/control";

/** Slider resolution: 14-bit gives fine continuous control (16384 positions). */
const RES_BITS = 14;
const RES_MAX = (1 << RES_BITS) - 1;

/** Normalized slider position (0..1) → the param's native value, honoring scale/step. */
export function sliderToNative(u01, spec) {
  return ccToNative(Math.round(Math.max(0, Math.min(1, u01)) * RES_MAX), spec, { bits: RES_BITS });
}
/** Native value → normalized slider position (0..1), the inverse (for redraw). */
export function nativeToSlider(value, spec) {
  return nativeToCc(value, spec, { bits: RES_BITS }) / RES_MAX;
}

/** A `param` set message from a control-surface knob (sender defaults to the workspace's "external"). */
export function paramSet(from, app, id, value) {
  return makeParam(from, { mode: "set", id, value }, { to: app });
}
/** A `command` message from a control-surface button. */
export function commandInvoke(from, app, name, args) {
  return makeCommand(from, { name, ...(args ? { args } : {}) }, { to: app });
}

/** Human-readable value for a param, by unit — the readout under a knob. */
export function formatValue(spec, value) {
  switch (spec.unit) {
    case "hz": return value >= 1000 ? (value / 1000).toFixed(2) + " kHz" : Math.round(value) + " Hz";
    case "bpm": return Math.round(value) + " bpm";
    case "ms": return Math.round(value) + " ms";
    case "cents": return (value > 0 ? "+" : "") + Math.round(value) + " ¢";
    case "count": return String(Math.round(value));
    case "percent": return Math.round(value) + " %";
    case "ratio": return value.toFixed(3);
    case "bool": return value >= 0.5 ? "on" : "off";
    default: return String(value);
  }
}
