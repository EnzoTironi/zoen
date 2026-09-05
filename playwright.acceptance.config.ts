import { defineConfig, devices } from "@playwright/test";
import { Clock, Effect } from "effect";

export default defineConfig({
  forbidOnly: true,
  outputDir: `test-results/acceptance-${Effect.runSync(Clock.currentTimeMillis)}`,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  testDir: "apps/web/test",
  testMatch: [
    "features/**/*.browser.spec.ts",
    "integration/**/*.browser.spec.ts",
  ],
  timeout: 30_000,
  use: { screenshot: "only-on-failure", trace: "off" },
  workers: 1,
});
