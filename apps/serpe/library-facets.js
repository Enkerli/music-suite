/**
 * What the library knows about a saved pattern.
 *
 * Lifted out of main.jsx 2026-08-02 so it can be tested: the library predates
 * poly, and the bug it hid was not cosmetic — `saveToLibrary` gated on a
 * `parseUPI` result, so a poly pattern, a scene chain and a progressive
 * pattern could not be saved AT ALL. The button silently did nothing for three
 * whole classes of notation Serpe plays.
 */
import { parsePolyUPI, analyse, identify, longShort } from '@enkerli/upi';

export function upiFamily(u) {
  // A labelled pattern is named by its family, not by the label: a lane called
  // `kick=E(3,8)` starts with a letter and used to land in "Other", so every
  // labelled or multi-lane pattern was unfindable by family.
  //
  // Stripping the label is enough — the rest of the string starts at lane 1's
  // expression either way. An explicit split on `/` was here too and turned out
  // to be dead: removing it broke no test, and no input reaches it that the
  // label strip has not already handled.
  const s = (u || '').trim().replace(/^[A-Za-z_][\w-]*\s*=\s*/, '');
  if (/^E\(/i.test(s)) return 'Euclidean';
  if (/^P\(/i.test(s)) return 'Polygon';
  if (/^R\(/i.test(s)) return 'Random';
  if (/^[BWD]\(/i.test(s)) return 'Barlow';
  if (/^0x|:\d/.test(s)) return 'Numeric';
  if (/^[[{]/.test(s)) return 'Explicit';
  return 'Other';
}

/**
 * Recognition, durational reading and the layers present — all PER LANE.
 *
 * A 3-against-4 is two different rhythms; calling the pair "tresillo" would be
 * worse than saying nothing, so readings and feet are collected per lane and
 * de-duplicated. The layers that only exist in the fuller notation (lanes,
 * scenes, progression, accents, durations, offsets, microtiming) each become
 * their own facet, so the browser can filter by them.
 */
export function patternFacets(u) {
  // Every layer the notation carries becomes a tag, so the browser can
  // filter by it and nothing is silently dropped. Poly-aware since
  // 2026-08-02: recognition and durational reading run PER LANE (a
  // 3-against-4 is two different rhythms and saying "tresillo" for the
  // pair would be worse than saying nothing), and the layers that only
  // exist in the fuller notation — lanes, scenes, progression, accents,
  // durations, per-lane offsets — get their own facets.
  const layers = [];
  let readings = [], feet = [];
  try {
    const p = parsePolyUPI(u, { n: 16 });
    if (p.ok) {
      if (p.lanes.length > 1) layers.push(`poly ${p.lanes.length}`);
      for (const l of p.lanes) {
        const st = l.steps.map(Boolean);
        const id = identify(st);
        if (id.best) readings.push(id.best.formula);
        const f = longShort(st).foot;
        if (f && f !== 'none' && f !== 'mixed' && f !== 'complex') feet.push(f);
      }
      const scenes = Math.max(...p.lanes.map((l) => l.sceneCount ?? 1));
      if (scenes > 1) layers.push(`scenes ${scenes}`);
      if (p.lanes.some((l) => l.progressive)) layers.push('progressive');
      if (p.lanes.some((l) => l.accents?.some(Boolean))) layers.push('accents');
      if (p.lanes.some((l) => l.longShort)) layers.push('durations');
      if (p.lanes.some((l) => l.offset != null)) layers.push('offset');
      if (p.lanes.some((l) => l.microtiming?.depth > 0)) layers.push('microtiming');
    }
  } catch { /* unparseable entries still list, just without analysis */ }
  // Distinct, so a 4-lane pattern of four Euclideans does not repeat itself.
  const uniq = (a) => [...new Set(a)];
  return { readings: uniq(readings), feet: uniq(feet), layers };
}
