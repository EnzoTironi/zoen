import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    "node_modules/**",
    "**/node_modules/**",
    "**/dist/**",
    "reference/**",
    "archives/**",
    "pnpm-lock.yaml",
    "playwright-report/**",
    "test-results/**",
  ],
  overrides: [
    {
      files: [
        "tests/integration/sharing/independent/durable-permit-snapshot.review.md",
      ],
      // The embedded original experiment is immutable evidence with a recorded byte hash.
      options: { embeddedLanguageFormatting: "off" },
    },
  ],
});
