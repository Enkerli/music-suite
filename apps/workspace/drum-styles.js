/**
 * The styles that ship with @enkerli/drumsynth, bundled for the browser.
 *
 * Imported explicitly rather than globbed: esbuild resolves these at build time
 * and a glob would silently bundle whatever happened to be in the folder,
 * including a style someone dropped there mid-session.
 */
import jazzWaltz90 from "@enkerli/drumsynth/styles/jazz-waltz-90.json";
import jazzWaltz100 from "@enkerli/drumsynth/styles/jazz-waltz-100.json";
import jazzWaltz120 from "@enkerli/drumsynth/styles/jazz-waltz-120.json";
import jazzWaltz138 from "@enkerli/drumsynth/styles/jazz-waltz-138.json";
import jazzWaltz152 from "@enkerli/drumsynth/styles/jazz-waltz-152.json";
import jazzWaltz180 from "@enkerli/drumsynth/styles/jazz-waltz-180.json";
import jazzWaltz200 from "@enkerli/drumsynth/styles/jazz-waltz-200.json";

export const DRUM_STYLES = {
  "jazz-waltz-90": jazzWaltz90, "jazz-waltz-100": jazzWaltz100,
  "jazz-waltz-120": jazzWaltz120, "jazz-waltz-138": jazzWaltz138,
  "jazz-waltz-152": jazzWaltz152, "jazz-waltz-180": jazzWaltz180,
  "jazz-waltz-200": jazzWaltz200,
};
