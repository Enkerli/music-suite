#!/usr/bin/env node
/**
 * Bridge audit — find WebView events that are only half-wired.
 *
 * WHY THIS EXISTS. On 2026-07-29 Serpe's poly lane panel sat frozen on each
 * lane's first scene, and per-lane playheads had never moved at all. The C++
 * emitted `polyState` correctly and `main.jsx` handled `ev.type === 'polyState'`
 * — but `juce-bridge.js` had no `juceOn('polyState', …)`, so every one of those
 * events was dropped. It took three rounds of fixing the producer and the
 * consumer before anyone looked at the wire.
 *
 * The failure mode is the point: **a bridge has three parts, and any two of them
 * compile perfectly.** Nothing fails, nothing warns, and the feature is simply
 * inert. The doc for that feature even said "Verified: esbuild bundles clean and
 * the plugin builds" — both true, and neither says the event arrives.
 *
 * WHAT IT CHECKS, in both directions:
 *
 *   C++ → JS   emitEventIfBrowserIsVisible("x")   must have a JS subscription
 *   JS  → C++  backend.emitEvent("y")             must have a C++ withEventListener
 *
 * and the reverse of each, which finds dead ends rather than dropped events:
 * a subscription for something never emitted, a C++ listener nothing sends.
 *
 * HOW TO READ A FINDING. A drop means "nothing receives this NAME" — not that
 * the feature is broken. DrawnQurve's `setDirection` was reported dropped and
 * genuinely was, yet direction worked fine, because the same choice also went
 * out as the `playbackDirection` parameter. The drop was redundancy, and the
 * fix was to delete the extra emit. So confirm what a name carries before
 * concluding anything about behaviour.
 *
 * WHAT IT IS NOT. Grep, not a type system. It cannot see an event id built at
 * runtime (`emitEvent('lane' + i)`), and it does not claim the payload SHAPES
 * agree — only that both ends use the same name. Treat a finding as a lead to
 * confirm, exactly like the code census. False positives are expected for
 * dynamic ids and are listed separately rather than mixed in with real gaps.
 *
 * Usage:  node tools/bridge-audit.mjs [--json] [--quiet]
 * Exit:   0 = no dropped events, 1 = at least one drop (dead ends do not fail)
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The plugin repos are expected BESIDE this one. That assumption is why the
// audit spent its life skipping: a plain clone does not produce that layout,
// and neither does any checkout that puts the repos in different trees — so
// the check quietly reported "no sibling checkout" and passed. $BRIDGE_SIBLINGS
// overrides the search root, which is how to run it without symlinking.
const SIBLINGS = process.env.BRIDGE_SIBLINGS
  ? resolve(process.env.BRIDGE_SIBLINGS)
  : resolve(SUITE, "..");

/** Each plugin repo and the app whose JS it embeds. */
const PLUGINS = [
  { repo: "rhythm_pattern_explorer", app: "serpe", name: "Serpe" },
  { repo: "PitchFold", app: "pitchfold", name: "PitchFold" },
  { repo: "Vane", app: "vane", name: "Vane" },
  { repo: "DrawnQurve", app: "drawnqurve", name: "DrawnQurve" },
  { repo: "midicurator-plugin", app: "MIDIcurator", name: "MIDIcurator" },
  { repo: "workspace-plugin", app: "workspace", name: "Suite Workspace" },
  { repo: "progression-studio-plugin", app: "progression-studio", name: "Progression Studio" },
];

const walk = (dir, exts, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === "build" || e === "build-ios" || e === "node_modules" || e === "JUCE" ||
        e === "enkerli-juce" || e === "clap-juce-extensions" || e.startsWith(".")) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
};

const readAll = (files) => files.map((f) => readFileSync(f, "utf8")).join("\n");
const grabAll = (text, re) => {
  const out = new Set();
  for (const m of text.matchAll(re)) out.add(m[1]);
  return out;
};
/** Event ids that are assembled at runtime — reported apart, never as drops. */
const dynamic = (text, re) => [...text.matchAll(re)].filter((m) => !m[1]).length;

function auditPlugin({ repo, app, name }) {
  const repoDir = join(SIBLINGS, repo);
  const appDir = join(SUITE, "apps", app);
  if (!existsSync(repoDir)) return { name, skipped: `no sibling checkout at ../${repo}` };
  if (!existsSync(appDir)) return { name, skipped: `no app at apps/${app}` };

  const cpp = readAll(walk(join(repoDir, "Source"), [".cpp", ".h", ".mm"]));
  // .html too: Vane and MIDIcurator keep their whole UI inline in index.html,
  // so a .js-only scan reported 26 "dropped" events that are wired there.
  // .ts/.tsx as well: MIDIcurator is a TypeScript app, and a scan limited to
  // .js/.jsx/.html read NONE of it — reporting zero sends and eight dead
  // listeners for a plugin whose wiring had simply not been looked at.
  const js = readAll(walk(appDir, [".js", ".jsx", ".ts", ".tsx", ".html"]));

  // C++ side
  const cppEmits = new Set([
    ...grabAll(cpp, /emitEvent[A-Za-z]*\s*\(\s*"([A-Za-z_]\w*)"/g),
    // The shared EnkerliWebView wraps it as emit(id, payload); MIDIcurator,
    // Workspace and Progression Studio push everything through that, so a
    // scan for emitEvent* alone reported them as emitting nothing at all and
    // every one of their subscriptions as dead.
    ...grabAll(cpp, /\bemit\s*\(\s*"([A-Za-z_]\w*)"/g),
  ]);
  const cppListens = grabAll(cpp, /withEventListener\s*\(\s*"([A-Za-z_]\w*)"/g);
  // The shared EnkerliWebView takes its listener ids from a table of pairs.
  for (const v of grabAll(cpp, /\{\s*"([A-Za-z_]\w*)"\s*,\s*\[/g)) cppListens.add(v);

  // JS side. Two bridge styles: a per-app juce-bridge.js (juceOn/juceEmit) and
  // the shared enkerli-bridge (bridge.on / bridge.emit).
  const jsSubs = new Set([
    ...grabAll(js, /juceOn\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    ...grabAll(js, /\.on\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    ...grabAll(js, /addEventListener\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    // Vane/MIDIcurator style: a Bridge object with .on()/.send().
    ...grabAll(js, /Bridge\.on\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
  ]);
  // JS→C++ sends are scanned in the BRIDGE files plus any standalone-host
  // shim, not app-wide. App code is full of send/emit-shaped calls that have
  // nothing to do with the bridge — PitchFold's PARAM_MAP entries (`pcsMask`,
  // `pcsRoot` are parameter ids carried as payload, not event ids) and
  // DrawnQurve's local `setDirection` callback both read as dropped events
  // otherwise. Precision matters more than reach here: the reason the real
  // polyState gap went unnoticed is that nobody trusts a noisy report.
  const jsForEmits = readAll(walk(appDir, [".js", ".jsx", ".ts", ".tsx", ".html"])
    .filter((f) => /bridge/i.test(f) || /(^|\/)main\.[jt]sx?$|-main\.js$|index\.html$|App\.tsx$/.test(f)));
  const jsEmits = new Set([
    ...grabAll(jsForEmits, /juceEmit\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    ...grabAll(jsForEmits, /backend\.emitEvent\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    ...grabAll(jsForEmits, /\bemit\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    ...grabAll(jsForEmits, /Bridge\.send\s*\(\s*['"]([A-Za-z_]\w*)['"]/g),
    // NOT a generic /\bsend\(/: that captures the first argument of any
    // sendSomething() helper, and `sendParamActual('pcsMask', v)` carries a
    // PARAMETER id there, not an event id. Every real send in this suite goes
    // through juceEmit, backend.emitEvent, emit or Bridge.send above, so the
    // generic pattern only ever added PitchFold's pcsMask/pcsRoot as phantom
    // dropped events.
  ]);
  const jsHandles = grabAll(js, /(?:ev|e|msg)\.type\s*===\s*['"]([A-Za-z_]\w*)['"]/g);
  // The helpers' own parameter name, picked up from their generic definitions.
  // The helpers' own generic parameter names, picked up from their definitions
  // and docs rather than from any real call site.
  for (const set of [jsSubs, jsEmits, cppEmits, cppListens])
    for (const n of ["eventId", "id", "name", "type"]) set.delete(n);

  const dyn = dynamic(js, /juceEmit\s*\(\s*([`'"]?)/g);

  // DOM events and browser APIs share these names; they are not bridge ids.
  // Names that belong to browser or Web MIDI APIs, not to this bridge. Without
  // this, `midimessage`/`statechange`/`opened` from @enkerli/webmidi read as
  // events the C++ fails to listen for.
  const NOT_BRIDGE = new Set([
    // DOM
    "message", "keydown", "keyup", "click", "dblclick", "resize", "change",
    "input", "load", "error", "focus", "blur", "scroll", "pointerdown",
    "pointerup", "pointermove", "pointercancel", "pointerleave", "mousedown",
    "mouseup", "mousemove", "wheel", "contextmenu", "visibilitychange",
    "beforeunload", "drop", "dragover", "DOMContentLoaded", "submit", "close",
    // Web MIDI / WEBMIDI.js
    "midimessage", "midiaccessgranted", "statechange", "opened", "closed",
    "connected", "disconnected", "enabled", "disabled", "portschanged",
    "noteon", "noteoff", "controlchange", "pitchbend",
  ]);
  for (const set of [jsSubs, jsEmits]) for (const s of [...set]) if (NOT_BRIDGE.has(s)) set.delete(s);

  // A sender the app never calls is not a dropped event — it is dead code.
  // Serpe exports sendToggleStep('toggleStep') and nothing calls it, because
  // step edits re-send the whole pattern as UPI text instead. Reporting that
  // as a silently-dropped event would be crying wolf, and a check that cries
  // wolf gets ignored — which is how the real polyState gap survived.
  const bridgeFiles = walk(appDir, [".js", ".ts"]).filter((f) => /bridge/i.test(f));
  const bridgeText = readAll(bridgeFiles);
  const appText = readAll(walk(appDir, [".js", ".jsx", ".ts", ".tsx", ".html"]).filter((f) => !/bridge/i.test(f)));
  // A standalone host shim EMULATES the native side: Vane's synth-main.js runs
  // the WASM voice when there is no JUCE host and emits the very events the C++
  // would. Those are not JS→C++ sends. The tell is general — an app does not
  // subscribe to its own outgoing messages — so an id that is subscribed AND
  // emitted in JS while the C++ also emits it is a shim echo.
  const shimEcho = [...jsEmits].filter((e) => jsSubs.has(e) && cppEmits.has(e)).sort();
  for (const e of shimEcho) jsEmits.delete(e);

  const unusedSender = [];
  for (const ev of [...jsEmits]) {
    // The exported helper whose body emits this id, if that is where it lives.
    const m = new RegExp(`function\\s+(\\w+)[^]*?['"]${ev}['"]`).exec(bridgeText);
    const holder = new RegExp(`export function (\\w+)[^{]*\\{[^}]*['"]${ev}['"]`).exec(bridgeText);
    const fn = holder?.[1] ?? m?.[1];
    if (fn && !new RegExp(`\\b${fn}\\b`).test(appText)) {
      unusedSender.push(ev);
      jsEmits.delete(ev);
    }
  }

  const droppedToJs = [...cppEmits].filter((e) => !jsSubs.has(e)).sort();
  const droppedToCpp = [...jsEmits].filter((e) => !cppListens.has(e) && !NOT_BRIDGE.has(e)).sort();
  const deadSub = [...jsSubs].filter((e) => !cppEmits.has(e)).sort();
  const deadListener = [...cppListens].filter((e) => !jsEmits.has(e)).sort();
  // Subscribed and mapped to a {type} the app never branches on. Only
  // meaningful for the type-mapping bridge style, so require some handling.
  const unhandled = jsHandles.size
    ? [...jsSubs].filter((e) => cppEmits.has(e) && !jsHandles.has(e)).sort()
    : [];

  return { name, repo, app, counts: { cppEmits: cppEmits.size, cppListens: cppListens.size,
             jsSubs: jsSubs.size, jsEmits: jsEmits.size },
           droppedToJs, droppedToCpp, deadSub, deadListener, unhandled,
           unusedSender: unusedSender.sort(), shimEcho, dynamicEmits: dyn };
}

const results = PLUGINS.map(auditPlugin);
const asJson = process.argv.includes("--json");
const quiet = process.argv.includes("--quiet");
const drops = results.reduce((n, r) => n + (r.droppedToJs?.length || 0) + (r.droppedToCpp?.length || 0), 0);

if (asJson) {
  console.log(JSON.stringify({ results, drops }, null, 2));
} else if (!quiet) {
  console.log("Bridge audit — WebView events wired at only one end\n");
  for (const r of results) {
    if (r.skipped) { console.log(`  ${r.name.padEnd(20)} skipped (${r.skipped})`); continue; }
    const c = r.counts;
    console.log(`  ${r.name}  —  C++ emits ${c.cppEmits}, listens ${c.cppListens} · JS subscribes ${c.jsSubs}, emits ${c.jsEmits}`);
    const line = (label, arr, why) => {
      if (!arr.length) return;
      console.log(`      ${label} ${arr.join(", ")}`);
      if (why) console.log(`          ${why}`);
    };
    line("DROPPED C++→JS :", r.droppedToJs, "emitted by C++, no JS subscription — the event never arrives");
    line("DROPPED JS→C++ :", r.droppedToCpp, "sent by JS, no C++ withEventListener — the event never arrives");
    line("dead subscribe :", r.deadSub, "JS listens for something C++ never emits");
    line("dead listener  :", r.deadListener, "C++ listens for something JS never sends");
    line("unhandled      :", r.unhandled, "subscribed, but no ev.type branch handles it");
    line("unused sender  :", r.unusedSender, "a bridge helper emits this, but nothing calls the helper");
    if (r.shimEcho.length) console.log(`      (${r.shimEcho.length} standalone-host echo(es) ignored: ${r.shimEcho.join(", ")})`);
    if (!r.droppedToJs.length && !r.droppedToCpp.length && !r.deadSub.length
        && !r.deadListener.length && !r.unhandled.length
        && !r.unusedSender.length) console.log("      clean");
    console.log("");
  }
  console.log(drops === 0
    ? "No dropped events. (Dead ends above, if any, are tidiness — not silent breakage.)"
    : `${drops} DROPPED event(s) — each is a feature that compiles and does nothing.`);
}
process.exit(drops === 0 ? 0 : 1);
