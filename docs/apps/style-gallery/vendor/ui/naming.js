/**
 * Filename naming — avoid the "Untitled 1" / "export 2.mid" problem.
 * A compact local timestamp keeps every generated file unique and
 * chronologically sortable (Alex's preference; the OS never has to
 * de-duplicate). Suite-wide so every app names exports the same way.
 */

/** Compact local timestamp: "20260613-200815" (YYYYMMDD-HHMMSS). */
export function timestamp(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** "<base>_<timestamp>.<ext>", e.g. "progression_C_major_20260613-200815.mid". */
export function timestampedName(base, ext) {
  return `${base}_${timestamp()}.${String(ext).replace(/^\./, "")}`;
}
