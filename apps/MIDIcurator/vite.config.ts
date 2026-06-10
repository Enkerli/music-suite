import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Serve .wasm files from /public with the correct MIME type.
 * Vite's dev server may not set application/wasm automatically for
 * files in the public directory, causing WebAssembly streaming to fail.
 */
function wasmMimePlugin(): Plugin {
  return {
    name: 'wasm-mime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), wasmMimePlugin()],
  base: '/MIDIcurator/',
});
