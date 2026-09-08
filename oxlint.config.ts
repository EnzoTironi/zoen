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
      files: [
        "tests/integration/subject-identity/**",
        "apps/cli/test/subject-identity/**",
        "apps/web/test/integration/subject-identity/**",
        "packages/ontology/test/knowledge/subject-identity/**",
      ],
      rules: {
        "effecttsgo/any-unknown-in-error-context": "off",
        "effecttsgo/async-function": "off",
        "effecttsgo/global-fetch-in-effect": "off",
        "effecttsgo/global-random-in-effect": "off",
        "effecttsgo/global-timers": "off",
        "effecttsgo/lazy-effect": "off",
        "effecttsgo/new-promise": "off",
        "effecttsgo/node-builtin-import": "off",
        "effecttsgo/prefer-schema-over-json": "off",
        "effecttsgo/prefer-typed-schema-decoder": "off",
        "effecttsgo/process-env": "off",
        "effecttsgo/schema-number": "off",
        "effecttsgo/schema-sync-in-effect": "off",
        "promise/avoid-new": "off",
      },
    },
    {
      files: [
        "tests/integration/erasure/**",
        "apps/cli/test/erasure/**",
        "apps/web/test/integration/erasure/**",
        "packages/ontology/test/ports/erasure/**",
        "packages/contracts/test/erasure/**",
        "apps/server/test/adapters/object-storage/erasure/**",
        "apps/server/src/adapters/object-storage/erasure/**",
        "apps/server/src/adapters/erasure/**",
        "apps/server/test/adapters/erasure/**",
      ],
      rules: {
        "effecttsgo/async-function": "off",
        "effecttsgo/global-date": "off",
        "effecttsgo/global-date-in-effect": "off",
        "effecttsgo/global-error-in-effect-catch": "off",
        "effecttsgo/lazy-effect": "off",
        "effecttsgo/node-builtin-import": "off",
        "effecttsgo/prefer-schema-over-json": "off",
        "effecttsgo/prefer-typed-schema-decoder": "off",
        "effecttsgo/schema-sync-in-effect": "off",
      },
    },
    {
      files: [
        "tests/integration/hosted/**",
        "packages/ontology/test/hosted/**",
        "packages/ontology/test/ports/hosted/**",
        "packages/contracts/test/hosted/**",
        "ops/local/**",
      ],
      rules: {
        "effecttsgo/prefer-schema-over-json": "off",
        "effecttsgo/prefer-typed-schema-decoder": "off",
        "effecttsgo/schema-sync-in-effect": "off",
      },
    },
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
      files: ["apps/server/scripts/all-in-one-bootstrap.ts"],
      rules: {
        "effecttsgo/any-unknown-in-error-context": "off",
        "promise/no-promise-in-callback": "off",
        "promise/prefer-await-to-callbacks": "off",
        "promise/prefer-await-to-then": "off",
      },
    },
    {
      files: [
        "packages/ontology/src/ports/eve/**",
        "packages/ontology/test/ports/eve/**",
        "packages/contracts/test/eve/**",
        "apps/cli/src/eve/**",
        "apps/web/src/features/eve/**",
        "apps/web/test/integration/eve/**",
        "apps/server/test/composition/eve/**",
      ],
      plugins: ["vitest"],
      rules: {
        "effecttsgo/abort-controller-in-effect": "off",
        "effecttsgo/async-function": "off",
        "effecttsgo/node-builtin-import": "off",
        "effecttsgo/prefer-schema-over-json": "off",
        "effecttsgo/process-env": "off",
        "effecttsgo/process-env-in-effect": "off",
        "effecttsgo/schema-sync-in-effect": "off",
        "eslint/complexity": "off",
        "eslint/require-await": "off",
        "typescript/no-unsafe-type-assertion": "off",
        "unicorn/prefer-response-static-json": "off",
        "vitest/max-expects": "off",
      },
    },
    {
      files: [
        "packages/ontology/src/semantic/executor.ts",
        "apps/cli/src/worlds/transport.ts",
        "apps/web/src/features/worlds/client.ts",
      ],
      rules: {
        "eslint/complexity": ["error", { max: 28 }],
      },
    },
    {
      files: [
        "apps/web/src/features/eve/web-speech.ts",
        "apps/web/test/features/eve/**",
      ],
      rules: {
        "effecttsgo/async-function": "off",
        "effecttsgo/new-promise": "off",
        "promise/avoid-new": "off",
        "typescript/prefer-for-of": "off",
        "unicorn/prefer-add-event-listener": "off",
      },
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
      files: ["packages/contracts/src/**", "packages/ontology/src/ports/**"],
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
              "@zoen/ontology",
              "@zoen/ontology/*",
              "**/ontology/**",
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
              "@zoen/ontology",
              "@zoen/ontology/*",
              "**/ontology/**",
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
