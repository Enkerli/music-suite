/**
 * Serpe's control-plane adoption (docs/CONTROL_PLANE.md §4–6) — the first app
 * wired to be a real citizen of the plane, and the pattern the others follow.
 *
 * Two halves:
 *   · RECEIVE — control-plane `command`/`param` messages addressed to serpe
 *     (from the workspace bus, another tab, or later a plugin) drive Serpe's
 *     own actions. This is what makes "send a message to change the pattern"
 *     literally true.
 *   · SEND — local keyboard input is resolved through a default control-map
 *     (via @enkerli/control) into the same messages, so a keystroke and an
 *     incoming message take the exact same path.
 *
 * The app supplies a small `api` of callbacks (its existing handlers); this
 * module owns none of Serpe's state. `applyControlMessage` is pure over that
 * api, so it unit-tests without a DOM.
 */
import { resolveEvent } from "@enkerli/control";
import { validateMessage } from "@enkerli/protocol";

/** Serpe's default keyboard layout — a control-map over its manifest. */
export const SERPE_KEYMAP = {
  id: "serpe-default-keys", kind: "control-map", label: "Serpe keys",
  bindings: [
    { trigger: { kind: "key", combo: "[" }, action: { app: "serpe", command: "rotate", args: { by: -1 } } },
    { trigger: { kind: "key", combo: "]" }, action: { app: "serpe", command: "rotate", args: { by: 1 } } },
    { trigger: { kind: "key", combo: "i" }, action: { app: "serpe", command: "invert" } },
    { trigger: { kind: "key", combo: "c" }, action: { app: "serpe", command: "complement" } },
    { trigger: { kind: "key", combo: "m" }, action: { app: "serpe", command: "mutate" } },
  ],
};

/** A KeyboardEvent → the combo string @enkerli/control matches on. */
export function comboFromEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.metaKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  parts.push(String(e.key).toLowerCase());
  return parts.join("+");
}

/**
 * Apply a control-plane message to Serpe via the app's `api` callbacks.
 * Handles `command` (rotate/invert/complement/mutate), `param`
 * (steps/tempo/swing) single or batch, and `pattern` (mask + step count,
 * leftmost = LSB → api.setPattern(steps)) — so the workspace Pattern (UPI)
 * module's send actually lands in Serpe. Returns true if it acted — messages
 * for other apps, other types, or unknown ids are ignored (returns false),
 * never thrown.
 */
export function applyControlMessage(api, msg) {
  if (!msg || (msg.to !== "serpe" && msg.to !== "*")) return false;
  const b = msg.body || {};
  if (msg.type === "pattern") {
    if (typeof api.setPattern !== "function") return false;
    if (!Number.isInteger(b.steps) || b.steps < 1 || !Number.isFinite(b.mask)) return false;
    // Decode by division (not >>) so patterns past 32 steps survive.
    const steps = Array.from({ length: b.steps }, (_, i) => Math.floor(b.mask / 2 ** i) % 2);
    api.setPattern(steps);
    return true;
  }
  if (msg.type === "command") {
    switch (b.name) {
      case "rotate": api.rotate(Number(b.args?.by ?? 1)); return true;
      case "invert": api.invert(); return true;
      case "complement": api.complement(); return true;
      case "mutate": api.mutate(b.args?.amount != null ? Number(b.args.amount) : undefined); return true;
      default: return false;
    }
  }
  if (msg.type === "param") {
    const set = (id, v) => {
      switch (id) {
        case "tempo": api.setTempo(Number(v)); return true;
        case "swing": api.setSwing(Number(v)); return true;
        case "steps": api.setSteps(Number(v)); return true;
        default: return false;
      }
    };
    if (Array.isArray(b.params)) return b.params.reduce((any, p) => set(p.id, p.value) || any, false);
    if (typeof b.id === "string") return set(b.id, b.value);
  }
  return false;
}

/**
 * Wire Serpe to the plane: a keyboard listener (send side) and a
 * BroadcastChannel listener (receive side, shared with the workspace bus).
 * `getApi` returns the current api each event, so it never goes stale across
 * React renders. Returns a disconnect function.
 */
export function connectSerpe({ getApi, manifests, channelName = "enkerli-workspace" }) {
  const onKey = (e) => {
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return; // don't hijack typing
    if (e.ctrlKey || e.metaKey || e.altKey) return;                // leave app/system chords alone
    const msgs = resolveEvent(SERPE_KEYMAP, { kind: "key", combo: comboFromEvent(e) }, manifests);
    let acted = false;
    for (const m of msgs) acted = applyControlMessage(getApi(), m) || acted;
    if (acted) e.preventDefault();
  };
  const target = typeof window !== "undefined" ? window : null;
  target?.addEventListener("keydown", onKey);

  let channel = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (e) => { if (validateMessage(e.data).ok) applyControlMessage(getApi(), e.data); };
  }
  return () => { target?.removeEventListener("keydown", onKey); channel?.close(); };
}
