// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLibraryBrowser } from "./library-browser.js";

const FACETS = [
  { key: "favorite", label: "Favorites", kind: "bool" },
  { key: "category", label: "Category", kind: "multi", badge: true,
    values: ["Pad", "Lead", "Bass"], accessor: (it) => it.category },
  { key: "dims", label: "Expression", kind: "multi", multi: true, dot: true, pip: true,
    values: [{ value: "breath", label: "Breath" }, { value: "pressure", label: "Pressure" }],
    accessor: (it) => it.dims },
  { key: "tags", label: "Tags", kind: "multi", multi: true, tag: true, accessor: (it) => it.tags, limit: 14 },
  { key: "rating", label: "Rating", kind: "min" },
];

function mk(n, over = {}) {
  return {
    id: "i" + n, name: `Preset ${n}`, category: "Pad", dims: ["breath"],
    tags: ["warm"], source: "Factory", rating: 0, favorite: false,
    modified: Date.now() - n * 86400000, ...over,
  };
}
// 15 items → above the facet threshold (12)
function dense() {
  const a = [];
  for (let i = 0; i < 15; i++) {
    a.push(mk(i, {
      category: ["Pad", "Lead", "Bass"][i % 3],
      dims: i % 2 ? ["breath", "pressure"] : ["breath"],
      tags: i < 5 ? ["warm"] : ["bright"],
      rating: i % 4, favorite: i < 3,
      name: i === 7 ? "Velvet Choir" : `Preset ${i}`,
    }));
  }
  return a;
}

let host;
beforeEach(() => { document.body.innerHTML = ""; host = document.createElement("div"); document.body.appendChild(host); });

describe("createLibraryBrowser — structure & scaling", () => {
  it("shows the facet rail above the count threshold", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    expect(host.classList.contains("lib")).toBe(true);
    expect(host.querySelector(".lib-facets").hidden).toBe(false);
    expect(host.querySelectorAll(".lib-row").length).toBe(15);
  });

  it("hides the facet rail and shows suggestions below the threshold", () => {
    createLibraryBrowser(host, { items: [mk(0), mk(1), mk(2)], facets: FACETS, facetMin: 12 });
    expect(host.classList.contains("no-facets")).toBe(true);
    expect(host.querySelector(".lib-facets").hidden).toBe(true);
    expect(host.querySelector(".suggest").hidden).toBe(false);
    expect(host.querySelectorAll(".sg-item").length).toBe(3);
  });

  it("renders per-facet row meta: badge, dimension pips, tags, stars", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const row = host.querySelector('.lib-row[data-id="i7"]'); // Velvet Choir, cat Lead, rating 3
    expect(row.querySelector(".cat-badge").textContent).toBe("Lead");
    expect(row.querySelectorAll(".dim-pip").length).toBe(2); // breath + pressure
    expect(row.querySelector(".es-dot.breath")).toBeTruthy();
    expect(row.querySelector(".row-tag").textContent).toBe("bright");
    expect(row.querySelectorAll(".row-stars span:not(.off)").length).toBe(3);
  });
});

describe("faceting & search", () => {
  it("a category facet filters the list; counts reflect other facets", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const bass = [...host.querySelectorAll(".facet-row")].find((b) => b.textContent.includes("Bass"));
    bass.click();
    const rows = host.querySelectorAll(".lib-row");
    expect(rows.length).toBe(5); // i2,5,8,11,14
    expect([...rows].every((r) => r.querySelector(".cat-badge").textContent === "Bass")).toBe(true);
    // an active chip appears
    expect(host.querySelector(".fchip").textContent).toContain("Bass");
  });

  it("multi-value facet (dims) requires ALL selected values", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const pressure = [...host.querySelectorAll(".facet-row")].find((b) => b.textContent.includes("Pressure"));
    pressure.click();
    // only odd-index items carry pressure → 7 of 15
    expect(host.querySelectorAll(".lib-row").length).toBe(7);
  });

  it("search matches names and narrows the list", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const input = host.querySelector(".search-input");
    input.value = "velvet";
    input.dispatchEvent(new Event("input"));
    const rows = host.querySelectorAll(".lib-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("mark").textContent.toLowerCase()).toBe("velvet");
  });

  it("Clear all resets every active filter", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    [...host.querySelectorAll(".facet-row")].find((b) => b.textContent.includes("Bass")).click();
    expect(host.querySelectorAll(".lib-row").length).toBe(5);
    host.querySelector(".chips-clear").click();
    expect(host.querySelectorAll(".lib-row").length).toBe(15);
    expect(host.querySelector(".fchip")).toBeNull();
  });
});

describe("row actions & callbacks", () => {
  it("favorite toggles and fires onFavorite", () => {
    const onFavorite = vi.fn();
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, onFavorite });
    const fav = host.querySelector('.lib-row[data-id="i5"] .fav-btn');
    expect(fav.getAttribute("aria-pressed")).toBe("false");
    fav.click();
    expect(host.querySelector('.lib-row[data-id="i5"] .fav-btn').getAttribute("aria-pressed")).toBe("true");
    expect(onFavorite).toHaveBeenCalledOnce();
  });

  it("delete is optimistic and offers undo via the toast callback (Q4)", () => {
    let undo = null;
    const toast = vi.fn((o) => { undo = o.undo; });
    const onDelete = vi.fn();
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, toast, onDelete });
    host.querySelector('.lib-row[data-id="i4"] .kebab').click();
    host.querySelector('.lib-row[data-id="i4"] [data-act="delete"]').click();
    expect(host.querySelector('.lib-row[data-id="i4"]')).toBeNull(); // gone immediately
    expect(onDelete).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledOnce();
    undo(); // restore
    expect(host.querySelector('.lib-row[data-id="i4"]')).toBeTruthy(); // back
  });

  it("New fires onNew; Import fires onImport", () => {
    const onNew = vi.fn(), onImport = vi.fn();
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, onNew, onImport });
    host.querySelector(".fd.primary").click();
    host.querySelector(".front-doors .fd:not(.primary)").click();
    expect(onNew).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledOnce();
  });

  it("empty state appears when filters match nothing", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const input = host.querySelector(".search-input");
    input.value = "zzzznope";
    input.dispatchEvent(new Event("input"));
    expect(host.querySelector(".empty .em-title").textContent).toBe("Nothing matches");
  });
});

describe("sort & setItems", () => {
  it("sorts by name A–Z", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    const sel = host.querySelector(".sort-sel");
    sel.value = "name";
    sel.dispatchEvent(new Event("change"));
    const names = [...host.querySelectorAll(".row-name")].map((n) => n.textContent);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("favorites:false hides the fav column; ISO date strings sort & format", () => {
    const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
    const items = [
      { id: "a", title: "Older", key: "C major", source: "saved", savedAt: iso(10) },
      { id: "b", title: "Newer", key: "F major", source: "edited", savedAt: iso(1) },
    ];
    const facets = [{ key: "key", label: "Key", kind: "multi", badge: true, accessor: (it) => it.key }];
    createLibraryBrowser(host, { items, facets, facetMin: 1, favorites: false,
      keys: { name: "title", date: "savedAt" } });
    expect(host.classList.contains("no-fav")).toBe(true);
    expect(host.querySelector(".fav-btn")).toBeNull();
    // recent sort puts the newer ISO date first, and dates render (not blank)
    const names = [...host.querySelectorAll(".row-name")].map((n) => n.textContent);
    expect(names).toEqual(["Newer", "Older"]);
    expect(host.querySelector(".row-date").textContent).toMatch(/ago|yesterday|today/);
  });

  it("compact mode: single column, facets in a collapsible bar (not a side rail)", () => {
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, compact: true });
    expect(host.classList.contains("compact")).toBe(true);
    expect(host.querySelector("aside.lib-facets")).toBeNull(); // no side rail
    const filters = host.querySelector(".lib-filters .lib-filters-body");
    expect(filters).toBeTruthy();
    expect(filters.querySelectorAll(".facet-group").length).toBeGreaterThan(0);
    // clicking a facet inside the compact bar still filters
    const bass = [...filters.querySelectorAll(".facet-row")].find((b) => b.textContent.includes("Bass"));
    bass.click();
    expect(host.querySelectorAll(".lib-row").length).toBe(5);
    // summary reflects the active-filter count
    expect(host.querySelector(".lib-filters > summary").textContent).toContain("1");
  });

  it("rowActionsFor gives per-row actions; no actions → no kebab", () => {
    const items = [mk(0, { id: "ro", source: "Factory" }), mk(1, { id: "rw", source: "User" })];
    createLibraryBrowser(host, {
      items, facets: FACETS, facetMin: 1,
      rowActionsFor: (it) => (it.source === "User" ? ["open", "delete"] : []),
    });
    expect(host.querySelector('.lib-row[data-id="ro"] .kebab')).toBeNull(); // read-only, no menu
    const kebab = host.querySelector('.lib-row[data-id="rw"] .kebab');
    expect(kebab).toBeTruthy();
    kebab.click();
    const acts = [...host.querySelectorAll('.lib-row[data-id="rw"] [data-act]')].map((b) => b.getAttribute("data-act"));
    expect(acts).toEqual(["open", "delete"]);
  });

  it("openOnRowClick loads on a single row click (quick-pick surfaces)", () => {
    const onOpen = vi.fn();
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, openOnRowClick: true, onOpen });
    host.querySelector('.lib-row[data-id="i3"] .row-name').click();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen.mock.calls[0][0].id).toBe("i3");
  });

  it("without openOnRowClick, a row click only selects (default)", () => {
    const onOpen = vi.fn();
    createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12, onOpen });
    host.querySelector('.lib-row[data-id="i3"] .row-name').click();
    expect(onOpen).not.toHaveBeenCalled();
    expect(host.querySelector('.lib-row[data-id="i3"]').classList.contains("sel")).toBe(true);
  });

  it("setItems replaces the stream", () => {
    const h = createLibraryBrowser(host, { items: dense(), facets: FACETS, facetMin: 12 });
    h.setItems([mk(99, { name: "Only One" })]);
    expect(host.querySelectorAll(".lib-row").length).toBe(1);
    expect(host.classList.contains("no-facets")).toBe(true); // 1 < threshold
  });
});
