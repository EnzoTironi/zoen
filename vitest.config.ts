import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const generated = [
  "**/node_modules/**",
  "**/dist/**",
  ".local/**",
  "reference/**",
  "archives/**",
];

export default defineConfig({
  resolve: {
    alias: {
      "@zoen/authority": fileURLToPath(
        new URL("packages/authority/src", import.meta.url)
      ),
      "@zoen/contracts": fileURLToPath(
        new URL("packages/contracts/src", import.meta.url)
      ),
    },
  },
  test: {
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          exclude: [...generated, "**/*.integration.test.{ts,tsx}"],
          include: ["**/*.test.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          exclude: generated,
          hookTimeout: 30_000,
          include: ["**/*.integration.test.{ts,tsx}"],
          // These workers share real PostgreSQL/S3 and launch additional native processes.
          // Keep one worker: parallel legacy-basis harnesses can contend on disposable
          // DB/storage long enough to hit it.live timeouts before container acceptance.
          maxWorkers: 1,
          name: "integration",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
