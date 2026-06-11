import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    // Plugin embedding (progression-studio-plugin WebUI/build.mjs) needs a
    // classic script: WKWebView under JUCE's custom URL scheme does not
    // reliably execute inline ES modules (BridgePilot's classic script
    // rendered on the same iPad while the module bundle stayed blank).
    // IIFE output with inlined dynamic imports keeps one chunk; the web
    // deploy is unaffected functionally.
    rollupOptions: {
      output: {
        format: process.env.PSP_SINGLEFILE ? "iife" : "es",
        inlineDynamicImports: true,
      },
    },
  },
});
