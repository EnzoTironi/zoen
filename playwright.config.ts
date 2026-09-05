import { defineConfig } from '@playwright/test';

/**
 * ZN-0004 Playwright config — browser journeys.
 * Journeys remain gated until an admitted browser profile is provided.
 * No placeholder success projects.
 */
export default defineConfig({
  testDir: 'journeys',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  // Empty projects until a journey ticket admits a browser target.
  projects: [],
});
