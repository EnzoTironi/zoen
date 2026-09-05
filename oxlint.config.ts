import { recommended as effectRecommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, vitest, effectRecommended],
  ignorePatterns: [
    ...core.ignorePatterns,
    "archives/**",
    "**/*.plan.md",
    "**/FILE-MAP.md",
    "backlog.html",
    "DELIVERY-MANIFEST.json",
    "planning/**",
    "docs/**",
    "contracts/**/*.plan.md",
    "admissions/**/*.plan.md",
    // stub placeholders reserved by workspace assembly
    "runners/types.ts",
    "runners/ports.ts",
    "runners/index.ts",
  ],
});
