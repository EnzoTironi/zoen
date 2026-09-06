import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

/**
 * EX39 structural oracle: ops/fly stubs exist and still forbid deploy/spend.
 * Does not call fly CLI; does not prove cloud operation.
 */
const root = fileURLToPath(new URL("../../../../", import.meta.url));

it.effect(
  "EX39 fly stubs present; README and toml forbid apps create/deploy spend",
  () =>
    Effect.gen(function* flyStubs() {
      const fs = yield* FileSystem.FileSystem;
      const tomlPath = `${root}ops/fly/fly.toml`;
      const readmePath = `${root}ops/fly/README.md`;
      expect(yield* fs.exists(tomlPath)).toBeTruthy();
      expect(yield* fs.exists(readmePath)).toBeTruthy();
      const toml = yield* fs.readFileString(tomlPath);
      const readme = yield* fs.readFileString(readmePath);
      expect(toml).toContain("STUB ONLY");
      expect(toml).toContain('app = "zoen-rebuild"');
      expect(toml.includes("fly deploy")).toBeTruthy();
      expect(readme.includes("fly apps create")).toBeTruthy();
      expect(readme.includes("fly deploy")).toBeTruthy();
      expect(readme).toContain("zoen-rebuild");
      expect(
        readme.toLowerCase().includes("deployed successfully")
      ).toBeFalsy();
    }).pipe(Effect.provide(NodeServices.layer))
);
