import { defineConfig } from 'vite';
import { devStorePlugin } from './scripts/lib/dev-store-plugin.js';

// Multi-page ready: later tasks add build.rollupOptions.input (present.html, deck.html).
export default defineConfig({
  // GET/PUT /__deck and POST /__upload for the editor's local store (dev server only).
  plugins: [devStorePlugin()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
