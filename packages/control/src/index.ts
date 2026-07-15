/**
 * @enkerli/control — the binding layer (docs/CONTROL_PLANE.md §4).
 *
 * Maps an input event (keystroke, MIDI CC, MIDI note) to a control-plane
 * action (`param` set or `command`) on a target app, and produces the
 * `SuiteMessage` to put on the transport. Framework-agnostic and stateless:
 * the browser wires DOM `keydown` / WebMIDI to `resolveEvent`; the CLI feeds
 * simulated events; both get the same messages.
 *
 * It reads the target's **manifest** — bindings can only address ids the
 * manifest declares, and the manifest supplies the range/scale for CC
 * normalization (a log-scaled Vane cutoff auto-maps correctly without the
 * binding restating it). Suite conventions carry through
 * (@enkerli/protocol's AppId vocabulary, leftmost = LSB masks).
 *
 * A set of bindings is a **control-map** — a library item
 * (docs/LIBRARY_SPEC.md), the shape a performer saves/recalls/shares; it is
 * where the accessibility-first persona's switch/key layout becomes
 * first-class content.
 */
import {
  makeParam, makeCommand, type SuiteMessage, type AppId,
  type ManifestBody, type ParamSpec,
} from "@enkerli/protocol";

// ── Bindings (the saved, serializable shape) ─────────────────────────────────

export interface KeyTrigger { kind: "key"; combo: string }
export interface CcTrigger { kind: "midi-cc"; cc: number; channel?: number; bits?: 7 | 14 }
export interface NoteTrigger { kind: "midi-note"; note: number; channel?: number }
export type Trigger = KeyTrigger | CcTrigger | NoteTrigger;

/** How a continuous input maps to a param's native range. Defaults to the
 *  param's own manifest `scale` (linear/log); `toggle` snaps to min/max. */
export type Curve = "linear" | "log" | "toggle";

export interface ParamAction {
  app: AppId;
  param: string;
  /** Fixed value (a pad/key sets a constant); omit for a continuous CC to
   *  normalize the incoming value through the manifest range. */
  value?: number;
  curve?: Curve;
}
export interface CommandAction {
  app: AppId;
  command: string;
  args?: Record<string, number>;
}
export type Action = ParamAction | CommandAction;

export interface Binding { trigger: Trigger; action: Action }

/** A named, identified set of bindings — the library-item shape. */
export interface ControlMap {
  id: string;
  kind: "control-map";
  label?: string;
  bindings: Binding[];
}

// ── Input events (what a runtime feeds in) ───────────────────────────────────

export interface KeyEvent { kind: "key"; combo: string }
export interface CcEvent { kind: "midi-cc"; cc: number; channel: number; value: number }
export interface NoteEvent { kind: "midi-note"; note: number; channel: number; velocity: number }
export type InputEvent = KeyEvent | CcEvent | NoteEvent;

function isParamAction(a: Action): a is ParamAction {
  return (a as ParamAction).param !== undefined;
}

// ── Key-combo canonicalization ───────────────────────────────────────────────

const MOD_ALIAS: Record<string, string> = {
  control: "ctrl", ctrl: "ctrl",
  option: "alt", alt: "alt",
  shift: "shift",
  cmd: "mod", command: "mod", meta: "mod", mod: "mod", super: "mod", win: "mod",
};
const MOD_ORDER = ["mod", "ctrl", "alt", "shift"];

/** "Mod+Shift+M" → "mod+shift+m"; modifiers sorted, aliases folded, key last. */
export function canonicalCombo(combo: string): string {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  const mods: string[] = [];
  let key = "";
  for (const p of parts) {
    if (MOD_ALIAS[p]) { const m = MOD_ALIAS[p]; if (!mods.includes(m)) mods.push(m); }
    else key = p;
  }
  mods.sort((a, b) => MOD_ORDER.indexOf(a) - MOD_ORDER.indexOf(b));
  return [...mods, ...(key ? [key] : [])].join("+");
}

// ── Normalization (CC/note ↔ native param value) ─────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Quantize to the spec's `step` (if any) and clamp to [min, max]. */
export function quantize(value: number, spec: ParamSpec): number {
  let v = value;
  if (spec.step && spec.step > 0) v = spec.min + Math.round((v - spec.min) / spec.step) * spec.step;
  return clamp(v, spec.min, spec.max);
}

/**
 * Map a raw MIDI value (0..2^bits−1) to the param's native value, honoring the
 * effective scale — the binding `curve` if given, else the manifest `scale`,
 * else linear. `toggle` (or a bool unit) snaps at the midpoint.
 */
export function ccToNative(raw: number, spec: ParamSpec, opts: { bits?: 7 | 14; curve?: Curve } = {}): number {
  const bits = opts.bits ?? 7;
  const maxRaw = (1 << bits) - 1;
  const u = clamp(raw / maxRaw, 0, 1);
  if (opts.curve === "toggle" || spec.unit === "bool") return u >= 0.5 ? spec.max : spec.min;
  const scale: "linear" | "log" =
    opts.curve === "log" ? "log" : opts.curve === "linear" ? "linear" : (spec.scale ?? "linear");
  const native = scale === "log" && spec.min > 0
    ? spec.min * Math.pow(spec.max / spec.min, u)
    : spec.min + u * (spec.max - spec.min);
  return quantize(native, spec);
}

/** Inverse of {@link ccToNative} — native value → raw MIDI (for LED feedback). */
export function nativeToCc(value: number, spec: ParamSpec, opts: { bits?: 7 | 14; curve?: Curve } = {}): number {
  const bits = opts.bits ?? 7;
  const maxRaw = (1 << bits) - 1;
  const v = clamp(value, spec.min, spec.max);
  if (opts.curve === "toggle" || spec.unit === "bool") return v >= (spec.min + spec.max) / 2 ? maxRaw : 0;
  const scale: "linear" | "log" =
    opts.curve === "log" ? "log" : opts.curve === "linear" ? "linear" : (spec.scale ?? "linear");
  const u = scale === "log" && spec.min > 0
    ? Math.log(v / spec.min) / Math.log(spec.max / spec.min)
    : (v - spec.min) / (spec.max - spec.min);
  return Math.round(clamp(u, 0, 1) * maxRaw);
}

// ── Manifest lookup ──────────────────────────────────────────────────────────

export type ManifestSet = Partial<Record<AppId, ManifestBody>>;

function indexManifests(manifests: ManifestBody[] | ManifestSet): ManifestSet {
  if (Array.isArray(manifests)) {
    const set: ManifestSet = {};
    for (const m of manifests) set[m.app] = m;
    return set;
  }
  return manifests;
}

function paramSpec(set: ManifestSet, app: AppId, id: string): ParamSpec | undefined {
  return set[app]?.params.find((p) => p.id === id);
}

// ── Matching ─────────────────────────────────────────────────────────────────

function matches(trigger: Trigger, event: InputEvent): boolean {
  if (trigger.kind !== event.kind) return false;
  if (trigger.kind === "key" && event.kind === "key")
    return canonicalCombo(trigger.combo) === canonicalCombo(event.combo);
  if (trigger.kind === "midi-cc" && event.kind === "midi-cc")
    return trigger.cc === event.cc && (trigger.channel === undefined || trigger.channel === event.channel);
  if (trigger.kind === "midi-note" && event.kind === "midi-note")
    return trigger.note === event.note && (trigger.channel === undefined || trigger.channel === event.channel);
  return false;
}

/** CC threshold above which a CC bound to a *command* (a switch) fires. */
const CC_SWITCH_THRESHOLD = 64;

// ── Resolution: event → SuiteMessage(s) ──────────────────────────────────────

export interface ResolveOptions {
  /** Sender id stamped on emitted messages (the control surface). Default "external". */
  from?: AppId;
}

/**
 * Resolve one input event against a control-map and the target manifests,
 * returning the SuiteMessage(s) to send (one per matching binding). Stateless:
 * unknown targets/params and unmatched events yield no message — never throws.
 */
export function resolveEvent(
  map: ControlMap, event: InputEvent, manifests: ManifestBody[] | ManifestSet, opts: ResolveOptions = {},
): SuiteMessage[] {
  const set = indexManifests(manifests);
  const from = opts.from ?? "external";
  const out: SuiteMessage[] = [];

  for (const b of map.bindings) {
    if (!matches(b.trigger, event)) continue;
    const a = b.action;

    if (isParamAction(a)) {
      const spec = paramSpec(set, a.app, a.param);
      if (!spec) continue; // binding addresses an id the manifest doesn't declare
      let value: number;
      if (a.value !== undefined) value = quantize(a.value, spec);
      else if (event.kind === "midi-cc") {
        const bits = b.trigger.kind === "midi-cc" ? b.trigger.bits : undefined;
        value = ccToNative(event.value, spec, { ...(bits && { bits }), ...(a.curve && { curve: a.curve }) });
      }
      else if (event.kind === "midi-note")
        value = quantize(spec.default, spec); // a pad with no fixed value falls back to default
      else value = quantize(spec.default, spec); // a key with no fixed value
      out.push(makeParam(from, { mode: "set", id: a.param, value }, { to: a.app }));
    } else {
      // command: a CC (continuous) only fires a discrete command above threshold
      if (event.kind === "midi-cc" && event.value < CC_SWITCH_THRESHOLD) continue;
      if (set[a.app] && !set[a.app]!.commands.some((c) => c.name === a.command)) continue;
      out.push(makeCommand(from, { name: a.command, ...(a.args && { args: a.args }) }, { to: a.app }));
    }
  }
  return out;
}

// ── Validation (bindings against manifests — the editor's guard) ─────────────

export interface ValidationResult { ok: boolean; errors: string[] }

/**
 * Validate a control-map against the available manifests: every action must
 * target a param/command the manifest declares, fixed values must be in range,
 * command args must exist. Unlike `resolveEvent` (lenient at runtime), this is
 * strict — the binding editor's guard against unaddressable targets.
 */
export function validateControlMap(map: ControlMap, manifests: ManifestBody[] | ManifestSet): ValidationResult {
  const set = indexManifests(manifests);
  const errors: string[] = [];
  if (map.kind !== "control-map") errors.push('kind: must be "control-map"');
  if (!map.id) errors.push("id: required");
  if (!Array.isArray(map.bindings)) return { ok: false, errors: [...errors, "bindings: array required"] };

  map.bindings.forEach((b, i) => {
    const where = `bindings[${i}]`;
    const a = b.action;
    const manifest = set[a.app];
    if (!manifest) { errors.push(`${where}: no manifest available for app "${a.app}"`); return; }
    if (isParamAction(a)) {
      const spec = manifest.params.find((p) => p.id === a.param);
      if (!spec) { errors.push(`${where}: param "${a.param}" not in ${a.app}'s manifest`); return; }
      if (a.value !== undefined && (a.value < spec.min || a.value > spec.max))
        errors.push(`${where}: value ${a.value} out of range [${spec.min}, ${spec.max}] for ${a.param}`);
    } else {
      const cmd = manifest.commands.find((c) => c.name === a.command);
      if (!cmd) { errors.push(`${where}: command "${a.command}" not in ${a.app}'s manifest`); return; }
      for (const k of Object.keys(a.args ?? {}))
        if (!(cmd.args ?? []).some((arg) => arg.id === k))
          errors.push(`${where}: arg "${k}" not declared by command "${a.command}"`);
    }
  });
  return { ok: errors.length === 0, errors };
}

// ── Live engine (thin wrapper for browser/host use) ──────────────────────────

export interface BindingEngine {
  handle(event: InputEvent): SuiteMessage[];
  setMap(map: ControlMap): void;
}

/**
 * A stateful convenience over `resolveEvent`: holds the map + manifests + a
 * `send` sink, so a runtime just forwards input events. `handle` returns the
 * emitted messages too (for logging/tests).
 */
export function createBindingEngine(config: {
  map: ControlMap;
  manifests: ManifestBody[] | ManifestSet;
  send?: (msg: SuiteMessage) => void;
  from?: AppId;
}): BindingEngine {
  let map = config.map;
  return {
    setMap(next) { map = next; },
    handle(event) {
      const msgs = resolveEvent(map, event, config.manifests, config.from !== undefined ? { from: config.from } : {});
      if (config.send) for (const m of msgs) config.send(m);
      return msgs;
    },
  };
}
