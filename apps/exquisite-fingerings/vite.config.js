import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './', // Use relative paths for GitHub Pages
  build: {
    outDir: '../docs',
    emptyOutDir: false, // Keep existing files in docs
    rollupOptions: {
      input: {
        main: 'src/index.html'
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    root: '.' // Run tests from project root
  }
});
