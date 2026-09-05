import { defineConfig } from "vitest/config";

const generated = [
  "**/node_modules/**",
  "**/dist/**",
  "reference/**",
  "archives/**",
];

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      {
        test: {
          environment: "node",
          exclude: [...generated, "**/*.integration.test.{ts,tsx}"],
          include: ["**/*.test.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        test: {
          environment: "node",
          exclude: generated,
          hookTimeout: 30_000,
          include: ["**/*.integration.test.{ts,tsx}"],
          name: "integration",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
