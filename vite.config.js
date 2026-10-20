import { defineConfig } from 'vite';

// Multi-page ready: later tasks add build.rollupOptions.input (present.html, deck.html).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
