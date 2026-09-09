import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const generated = [
  "**/node_modules/**",
  "**/dist/**",
  ".local/**",
  "reference/**",
  "archives/**",
];

// EX25 basis compatibility + withLegacyBasisHarness consumers. Keep serial: parallel
// legacy harnesses contend on disposable DB/storage past it.live timeouts.
const integrationLegacyInclude = [
  "tests/integration/subject-identity/basis/**/*.integration.test.{ts,tsx}",
  "tests/integration/subject-identity/independent/audience.review.integration.test.ts",
  "tests/integration/subject-identity/independent/concurrency.review.integration.test.ts",
  "tests/integration/subject-identity/independent/legacy-bases.review.integration.test.ts",
] as const;

export default defineConfig({
  resolve: {
    alias: {
      "@zoen/application-client": fileURLToPath(
        new URL("packages/application-client/src", import.meta.url)
      ),
      "@zoen/contracts": fileURLToPath(
        new URL("packages/contracts/src", import.meta.url)
      ),
      "@zoen/ontology": fileURLToPath(
        new URL("packages/ontology/src", import.meta.url)
      ),
      "@zoen/oms": fileURLToPath(new URL("packages/oms/src", import.meta.url)),
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
          include: [...integrationLegacyInclude],
          maxWorkers: 1,
          name: "integration-legacy",
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          exclude: [...generated, ...integrationLegacyInclude],
          hookTimeout: 30_000,
          include: ["**/*.integration.test.{ts,tsx}"],
          // Non-legacy suites: modest parallelism against shared Postgres/S3.
          maxWorkers: 2,
          name: "integration",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
