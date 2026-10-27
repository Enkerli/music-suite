// Twirl in French: what's still in English, after going through the page's
// states (the drawer at Everything, every shelf, a loop's settings, the key
// list, messages from toggles). Used by the French test (twirl.test.js), and
// on its own while translating:
//   node apps/twirl/test/french-left.mjs     (prints what's left, one a line)
export async function frenchLeft(page) {
  return page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const left = new Set();
    const look = () => {
      const seen = (s) => {
        const t = s.replace(/[ \t\n\r]+/g, " ").trim();
        if (!/[A-Za-z]{3}/.test(t) || FR_SEEN.has(t)) return;
        if (/^https?:|^[\w.-]+\.(json|webm|wav)$|^enkerli\.github\.io/.test(t)) return;
        left.add(t);
      };
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest("script, style, [data-i18n='no'], textarea, [data-i18n='html']")) continue;
        seen(n.nodeValue);
      }
      for (const el of document.body.querySelectorAll("*")) {
        if (el.closest("script, style, [data-i18n='no']")) continue;
        for (const a of I18N_ATTRS) if (el.hasAttribute(a)) seen(el.getAttribute(a));
      }
      for (const el of document.querySelectorAll("[data-i18n='html']")) {
        const h = el.innerHTML.replace(/[ \t\n\r]+/g, " ").replace(/&nbsp;/g, "\u00a0").trim();
        if (!FR_SEEN.has(h)) left.add("[html] " + h.slice(0, 120));
      }
      seen(document.title);
    };
    look();
    setLevel(3); await wait(50); look();
    for (const tab of ["toybox", "mytoys", "scenes", "takes"]) { openShelf(tab); await wait(50); look(); }
    closeShelf();
    openInspector(loops[0]); await wait(50); look();
    for (const v of ["bloom", "swell", "fade", "brief"]) { loops[0].life = v; syncInspector(); await wait(20); look(); }
    loops[0].generation = 2; loops[0].clock = "ahead"; loops[0].muted = true; loops[0].life = "bloom"; loops[0].age = 3;
    syncInspector(); renderLoopList(); await wait(20); look();
    for (const v of ["swell", "fade", "brief"]) { loops[0].life = v; loops[0].age = 5; syncInspector(); await wait(20); look(); }
    loops[0].muted = false; loops[0].clock = "step";
    closeInspector();
    for (const key of ["l", "m", "e", "r"]) { document.dispatchEvent(new KeyboardEvent("keydown", { key })); await wait(20); look(); document.dispatchEvent(new KeyboardEvent("keydown", { key })); await wait(20); look(); }
    $("keysBtn").click(); await wait(50); look(); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    for (const id of ["lockBtn", "meetBtn", "evolveBtn", "varyBtn", "diceBtn", "walkBtn", "droneBtn", "beatsBtn", "smoothBtn", "grpMuteA"]) { $(id).click(); await wait(20); look(); $(id).click(); await wait(20); look(); }
    $("msgBtn").click?.(); await wait(50); look();
    for (const m of FR_MISSES) left.add("[part] " + m);
    return [...left].sort();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import("playwright");
  const { PAGE } = await import("./harness.js");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE + "?lang=fr");
  await page.waitForFunction(() => typeof loops !== "undefined" && loops.length > 0);
  const left = await frenchLeft(page);
  console.log(left.join("\n"));
  console.error(`${left.length} left${errors.length ? " · errors: " + errors.join(" | ") : ""}`);
  await browser.close();
}
