import { recommended as effectRecommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [
    { ...core, ignorePatterns: [] },
    react,
    {
      ...vitest,
      overrides: (vitest.overrides ?? []).map((override) => ({
        ...override,
        rules: {
          ...override.rules,
          "vitest/no-standalone-expect": [
            "error",
            {
              additionalTestBlockFunctions: [
                "it.effect",
                "it.live",
                "it.effect.each",
                "it.live.each",
              ],
            },
          ],
        },
      })),
    },
    effectRecommended,
  ],
  ignorePatterns: [
    "node_modules/**",
    "**/node_modules/**",
    "**/dist/**",
    "reference/**",
    "archives/**",
    "playwright-report/**",
    "test-results/**",
  ],
  options: {
    denyWarnings: true,
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
});
