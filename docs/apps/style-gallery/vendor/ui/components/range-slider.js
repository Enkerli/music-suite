/**
 * Range slider — the suite's dual-thumb output-range control (the
 * DrawnQurve / PitchFold pattern; HANDOFF "slideable touch targets").
 * Framework-agnostic: createRangeSlider(el, opts) → handle, matching the
 * create*(el, opts) convention of the other shared components.
 *
 * Visual style lives in components.css (.es-range*); this module is
 * behavior only. Design notes:
 *  - 44px touch targets on every thumb (hit area 44px, visible knob
 *    smaller) so it stays comfortable on iPad.
 *  - Elastic rubber-band: drag a thumb past the track edge and it follows
 *    with damping, then springs back on release (iOS overscroll feel).
 *  - Drag the band to slide the whole range; shove it into a wall and the
 *    range compresses (pins that end), restoring width when pulled back.
 *  - Thumbs can meet but never cross; the band between them is the range.
 *  - Pointer (mouse + touch) AND keyboard (arrows / shift-arrows / Home /
 *    End), with role="slider" + aria-value* on each thumb.
 */

const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** MIDI note number → name, e.g. 60 → "C4" (handy default formatter). */
export function midiName(m) {
  return SHARP[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/**
 * @param {Element} el host element (emptied)
 * @param {object} [opts]
 * @param {number} [opts.min] @param {number} [opts.max] @param {number} [opts.step]
 * @param {[number, number]} [opts.values] [low, high]
 * @param {(v:number)=>string} [opts.format] value → label (track ends + aria)
 * @param {(lo:number, hi:number)=>void} [opts.onChange]
 */
export function createRangeSlider(el, opts = {}) {
  const s = {
    min: 0, max: 100, step: 1,
    values: [25, 75],
    format: (v) => String(v),
    onChange: null,
    ...opts,
  };
  s.values = [...s.values];

  const root = document.createElement("div");
  root.className = "es-range";
  const track = document.createElement("div");
  track.className = "es-range-track";
  const band = document.createElement("div");
  band.className = "es-range-band";
  const thumbs = [0, 1].map((i) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "es-range-thumb";
    t.dataset.i = String(i);
    t.setAttribute("role", "slider");
    t.setAttribute("aria-label", i === 0 ? "Range low" : "Range high");
    t.setAttribute("aria-valuemin", String(s.min));
    t.setAttribute("aria-valuemax", String(s.max));
    return t;
  });
  track.append(band, ...thumbs);
  const scale = document.createElement("div");
  scale.className = "es-range-scale";
  scale.innerHTML = `<span>${s.format(s.min)}</span><span>${s.format(s.max)}</span>`;
  root.append(track, scale);
  el.replaceChildren(root);

  const pct = (v) => ((v - s.min) / (s.max - s.min)) * 100;
  const snap = (v) => Math.round(v / s.step) * s.step;
  const clamp = (v) => Math.min(s.max, Math.max(s.min, v));

  function render() {
    const [lo, hi] = s.values;
    thumbs[0].style.left = pct(lo) + "%";
    thumbs[1].style.left = pct(hi) + "%";
    band.style.left = pct(lo) + "%";
    band.style.width = pct(hi) - pct(lo) + "%";
    thumbs.forEach((t, i) => {
      t.setAttribute("aria-valuenow", String(s.values[i]));
      t.setAttribute("aria-valuetext", s.format(s.values[i]));
    });
  }
  function commit() { render(); s.onChange?.(s.values[0], s.values[1]); }

  // ── Pointer drag with elastic edge ──────────────────────────────────
  thumbs.forEach((thumb, i) => {
    thumb.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try { thumb.setPointerCapture(e.pointerId); } catch { /* no-op */ }
      thumb.classList.remove("releasing");
      thumb.classList.add("grab");
      root.classList.add("dragging");

      const move = (ev) => {
        const r = track.getBoundingClientRect();
        const frac = (ev.clientX - r.left) / r.width;
        const raw = s.min + frac * (s.max - s.min);
        // neighbour limit so thumbs don't cross
        const loLimit = i === 1 ? s.values[0] : s.min;
        const hiLimit = i === 0 ? s.values[1] : s.max;
        s.values[i] = snap(Math.min(hiLimit, Math.max(loLimit, raw)));
        // elastic overshoot only at the OUTER track edges
        let ovr = 0;
        if (raw < s.min) ovr = ((raw - s.min) / (s.max - s.min)) * r.width * 0.32;
        else if (raw > s.max) ovr = ((raw - s.max) / (s.max - s.min)) * r.width * 0.32;
        ovr = Math.max(-26, Math.min(26, ovr));
        thumb.style.setProperty("--ovr", ovr + "px");
        commit();
      };
      const up = () => {
        try { thumb.releasePointerCapture?.(e.pointerId); } catch { /* no-op */ }
        thumb.removeEventListener("pointermove", move);
        thumb.removeEventListener("pointerup", up);
        thumb.classList.remove("grab");
        root.classList.remove("dragging");
        // spring the overshoot back
        thumb.classList.add("releasing");
        thumb.style.setProperty("--ovr", "0px");
        setTimeout(() => thumb.classList.remove("releasing"), 520);
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", up);
    });

    // ── Keyboard ──────────────────────────────────────────────────────
    thumb.addEventListener("keydown", (e) => {
      const big = s.step * 12;
      let v = s.values[i];
      if (e.key === "ArrowRight" || e.key === "ArrowUp") v += e.shiftKey ? big : s.step;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= e.shiftKey ? big : s.step;
      else if (e.key === "Home") v = s.min;
      else if (e.key === "End") v = s.max;
      else return;
      e.preventDefault();
      const loLimit = i === 1 ? s.values[0] : s.min;
      const hiLimit = i === 0 ? s.values[1] : s.max;
      s.values[i] = snap(Math.min(hiLimit, Math.max(loLimit, clamp(v))));
      commit();
    });
  });

  // ── Band drag: slide the whole range; compress against either wall ──
  band.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try { band.setPointerCapture(e.pointerId); } catch { /* no-op */ }
    band.classList.add("grab");
    root.classList.add("dragging");
    const r = track.getBoundingClientRect();
    const startX = e.clientX;
    const [lo0, hi0] = s.values;

    const move = (ev) => {
      const dv = ((ev.clientX - startX) / r.width) * (s.max - s.min);
      // Recompute from the originals so pulling back off a wall restores
      // the original width; clamp BOTH ends so neither runs past a wall.
      let lo = clamp(snap(lo0 + dv));
      let hi = clamp(snap(hi0 + dv));
      lo = Math.min(lo, hi);
      hi = Math.max(lo, hi);
      s.values[0] = lo;
      s.values[1] = hi;
      commit();
    };
    const up = () => {
      try { band.releasePointerCapture?.(e.pointerId); } catch { /* no-op */ }
      band.removeEventListener("pointermove", move);
      band.removeEventListener("pointerup", up);
      band.classList.remove("grab");
      root.classList.remove("dragging");
    };
    band.addEventListener("pointermove", move);
    band.addEventListener("pointerup", up);
  });

  render();
  s.onChange?.(s.values[0], s.values[1]);

  return {
    get values() { return [...s.values]; },
    update(next) {
      Object.assign(s, next);
      if (next.values) s.values = [...next.values];
      render();
    },
    destroy() { root.remove(); },
  };
}
