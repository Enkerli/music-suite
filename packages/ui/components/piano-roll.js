/**
 * Piano roll — read-only clip/progression display with playhead.
 * Canvas-based (MIDIcurator's renderer informed the look); the layout is
 * a pure function so it tests without a canvas. Editing stays app-level
 * (MIDIcurator keeps its own interactive roll); this component is for
 * SHOWING shapes: ProgGenie's progression view, clip previews, gallery.
 *
 * Notes are in beats: { startBeat, lengthBeats, pitch, velocity? }.
 */

/** Pure layout: note rectangles in unit space (x: beats→px, y: pitch rows). */
export function layoutNotes(notes, { width, height, lengthBeats, padSemitones = 2 } = {}) {
  if (!notes.length) return { rects: [], lo: 48, hi: 72, pxPerBeat: 0, rowH: 0 };
  let lo = Math.min(...notes.map((n) => n.pitch)) - padSemitones;
  let hi = Math.max(...notes.map((n) => n.pitch)) + padSemitones;
  if (hi - lo < 12) {
    const extra = 12 - (hi - lo);
    lo -= Math.floor(extra / 2);
    hi += Math.ceil(extra / 2);
  }
  const span = lengthBeats || Math.max(...notes.map((n) => n.startBeat + n.lengthBeats));
  const pxPerBeat = width / span;
  const rowH = height / (hi - lo + 1);
  const rects = notes.map((n) => ({
    x: n.startBeat * pxPerBeat,
    y: (hi - n.pitch) * rowH,
    w: Math.max(2, n.lengthBeats * pxPerBeat - 1),
    h: Math.max(2, rowH - 1),
    velocity: n.velocity ?? 96,
    pitch: n.pitch,
  }));
  return { rects, lo, hi, pxPerBeat, rowH };
}

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {Array} [opts.notes]
 * @param {number} [opts.lengthBeats] clip length (0 = derive from notes)
 * @param {number} [opts.beatsPerBar]
 * @param {number} [opts.playheadBeat] negative = hidden
 * @param {number} [opts.height] CSS px
 */
export function createPianoRoll(el, opts = {}) {
  const state = {
    notes: [],
    lengthBeats: 0,
    beatsPerBar: 4,
    playheadBeat: -1,
    height: 160,
    ...opts,
  };

  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Piano roll");
  el.replaceChildren(canvas);

  function render() {
    const width = el.clientWidth || 480;
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = state.height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${state.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return; // non-browser environment: layout still testable
    ctx.scale(dpr, dpr);

    ctx.fillStyle = cssVar("--es-bg-sunken");
    ctx.fillRect(0, 0, width, state.height);
    if (!state.notes.length) return;

    const { rects, lo, hi, pxPerBeat, rowH } = layoutNotes(state.notes, {
      width,
      height: state.height,
      lengthBeats: state.lengthBeats,
    });

    // Octave guides (C rows) then bar/beat grid.
    ctx.fillStyle = cssVar("--es-border-soft");
    for (let p = lo; p <= hi; p++)
      if (p % 12 === 0) ctx.fillRect(0, (hi - p) * rowH, width, 1);
    const span = state.lengthBeats || Math.max(...state.notes.map((n) => n.startBeat + n.lengthBeats));
    for (let b = 0; b <= span; b++) {
      ctx.fillStyle = cssVar(b % state.beatsPerBar === 0 ? "--es-border-strong" : "--es-border");
      ctx.fillRect(b * pxPerBeat, 0, 1, state.height);
    }

    // Notes: accent fill, velocity → alpha.
    const accent = cssVar("--es-accent");
    for (const r of rects) {
      ctx.globalAlpha = 0.45 + 0.55 * (r.velocity / 127);
      ctx.fillStyle = accent;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.globalAlpha = 1;

    if (state.playheadBeat >= 0) {
      ctx.fillStyle = cssVar("--es-fg");
      ctx.fillRect(state.playheadBeat * pxPerBeat - 1, 0, 2, state.height);
    }
  }

  render();
  const onResize = () => render();
  globalThis.addEventListener?.("resize", onResize);

  return {
    update(next) {
      Object.assign(state, next);
      render();
    },
    /** Cheap path for 10 Hz transport streams. */
    setPlayhead(beat) {
      state.playheadBeat = beat;
      render();
    },
    destroy() {
      globalThis.removeEventListener?.("resize", onResize);
      canvas.remove();
    },
  };
}
