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
        files: ["**/*.test.{ts,tsx,js,jsx}"],
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
  overrides: [
    {
      files: ["**/adapters/http.ts"],
      rules: { "effecttsgo/node-builtin-import": "off" },
    },
    {
      files: ["**/*.integration.test.ts", "**/*.integration.test.tsx"],
      plugins: ["vitest"],
      rules: { "vitest/max-expects": "off" },
    },
    {
      files: ["**/adapters/posix.ts"],
      rules: {
        "effecttsgo/node-builtin-import": "off",
        "no-bitwise": "off",
      },
    },
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      rules: {
        "no-redeclare": "off",
        "typescript/promise-function-async": [
          "error",
          { checkArrowFunctions: false, checkFunctionExpressions: false },
        ],
        "unicorn/throw-new-error": "off",
      },
    },
    {
      files: ["packages/contracts/src/**", "packages/authority/src/ports/**"],
      rules: { "max-classes-per-file": ["error", { max: 16 }] },
    },
    {
      files: ["**/*.spec.ts"],
      rules: { "effecttsgo/async-function": "off" },
    },
    {
      files: [
        "packages/contracts/src/**",
        "apps/web/src/**",
        "apps/cli/src/**",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              "@zoen/authority",
              "@zoen/authority/*",
              "**/authority/**",
              "**/apps/server/**",
              "@zoen/server",
              "@zoen/server/*",
              "@effect/sql-*",
              "effect/unstable/sql",
              "effect/unstable/sql/*",
              "pg",
              "@aws-sdk/*",
              "better-auth",
            ],
          },
        ],
      },
    },
    {
      files: ["packages/contracts/src/**", "apps/web/src/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              "@zoen/authority",
              "@zoen/authority/*",
              "**/authority/**",
              "**/apps/server/**",
              "@zoen/server",
              "@zoen/server/*",
              "@effect/sql-*",
              "effect/unstable/sql",
              "effect/unstable/sql/*",
              "pg",
              "@aws-sdk/*",
              "better-auth",
              "@effect/platform-node",
              "@effect/platform-node/*",
              "node:*",
            ],
          },
        ],
      },
    },
  ],
});
