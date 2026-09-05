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
});
