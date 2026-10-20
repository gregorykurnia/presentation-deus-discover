import { defineConfig } from 'vite';
import { devApiPlugin } from './scripts/lib/dev-api-plugin.js';
import { devStorePlugin } from './scripts/lib/dev-store-plugin.js';

// Multi-page ready: later tasks add build.rollupOptions.input (present.html, deck.html).
export default defineConfig({
  // GET/PUT /__deck and POST /__upload for the editor's local store (dev server only), and
  // /api/* on PGlite when VITE_STORE=server (npm run dev:server).
  plugins: [devStorePlugin(), devApiPlugin()],
  test: {
    environment: 'jsdom',
    // Server tests start PGlite (a few seconds each); three files at once on a busy machine take longer.
    hookTimeout: 30_000,
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
