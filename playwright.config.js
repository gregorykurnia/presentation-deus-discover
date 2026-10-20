import { defineConfig } from '@playwright/test';
import { DRAFT_FILE, UPLOAD_DIR } from './tests/e2e/helpers/draft.js';

// One browser at a time (low-memory machine); chromium only.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5180', browserName: 'chromium' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite --port 5180 --strictPort',
    url: 'http://localhost:5180/present.html',
    reuseExistingServer: false,
    timeout: 60_000,
    // The editor specs save to a temp copy of the deck, never to content/deck.json,
    // and upload pictures to a temp dir, never to assets/uploads/.
    env: { DECK_FILE: DRAFT_FILE, UPLOAD_DIR },
  },
});
