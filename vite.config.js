import { defineConfig } from 'vite';

// Relative base ('./') keeps the build working under any GitHub Pages path
// (https://<user>.github.io/<repo>/) without hard-coding the repository name.
// If you prefer absolute paths, set base to '/<repo>/' instead.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
});
