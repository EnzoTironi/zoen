import { defineConfig, devices } from "@playwright/test";
import { Clock, Effect } from "effect";

export default defineConfig({
  forbidOnly: true,
  outputDir: `test-results/components-${Effect.runSync(Clock.currentTimeMillis)}`,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  retries: 0,
  testDir: "apps/web/test/components/d01",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec vite --config vite.config.ts",
    reuseExistingServer: false,
    url: "http://127.0.0.1:4174/ex03",
  },
});
