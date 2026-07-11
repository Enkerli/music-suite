/**
 * Render smoke — the regression class this guards: render-time crashes
 * (TDZ in hook dependency arrays, use-before-declare) that unit tests of
 * pure logic never execute. An iPad found the last one; this runs on
 * every test invocation instead.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";

describe("App render smoke", () => {
  it("renders without throwing and mounts the core UI", () => {
    const html = renderToString(React.createElement(App));
    expect(html).toContain("Progression Studio");
    expect(html).toContain("New take"); // grouped generator (was "Generate")
    expect(html).toContain("More like this"); // unified leadsheet + curation surface
    expect(html).toContain("es-shellbar"); // the shared frame's chrome bar (consistency pass)
    expect(html).toContain("Save patch"); // patch save/recall lives in the Library now
    expect(html).toContain("Your profile"); // curation summarized — profile-as-shape (Step 05)
    expect(html).toContain("Send to MIDIcurator"); // named destination (Step 06)
    // Q3 generator taxonomy — group headers (Context/Reharm/Modulation now live
    // behind the collapsed "Depth · advanced" group, so assert the labels).
    expect(html).toContain("Length &amp; pacing");
    expect(html).toContain("Voice"); // was "Sound"
    expect(html).toContain("Depth"); // advanced depth knobs
    expect(html).toContain("Channels"); // moved to the output row
  });
});
