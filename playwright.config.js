import { defineConfig } from '@playwright/test';

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
  },
});
