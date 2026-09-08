import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

/**
 * Structural oracle: ops/fly all-in-one hosting (not MPG/Tigris).
 * Does not call fly CLI; does not prove cloud /ready by itself.
 */
const root = fileURLToPath(new URL("../../../../", import.meta.url));

it.effect(
  "fly all-in-one Dockerfile + volume mount; no MPG/Tigris cutover",
  () =>
    Effect.gen(function* flyAllInOne() {
      const fs = yield* FileSystem.FileSystem;
      const tomlPath = `${root}ops/fly/fly.toml`;
      const readmePath = `${root}ops/fly/README.md`;
      const dockerfilePath = `${root}ops/containers/all-in-one.Dockerfile`;
      const entrypointPath = `${root}ops/containers/all-in-one-entrypoint.sh`;
      expect(yield* fs.exists(tomlPath)).toBeTruthy();
      expect(yield* fs.exists(readmePath)).toBeTruthy();
      expect(yield* fs.exists(dockerfilePath)).toBeTruthy();
      expect(yield* fs.exists(entrypointPath)).toBeTruthy();
      const toml = yield* fs.readFileString(tomlPath);
      const readme = yield* fs.readFileString(readmePath);
      const dockerfile = yield* fs.readFileString(dockerfilePath);
      expect(toml).toContain('app = "zoen-rebuild"');
      expect(toml).toContain("all-in-one.Dockerfile");
      expect(toml).toContain('source = "zoen_data"');
      expect(toml).toContain('destination = "/data"');
      expect(toml).toContain('path = "/ready"');
      // Forbid real MPG/Tigris provisioning keys — not English words in rejection comments.
      const tomlNoComments = toml
        .split("\n")
        .map((line) => {
          const hash = line.indexOf("#");
          return hash === -1 ? line : line.slice(0, hash);
        })
        .join("\n")
        .toLowerCase();
      expect(/\bmpg\b/u.test(tomlNoComments)).toBeFalsy();
      expect(/\btigris\b/u.test(tomlNoComments)).toBeFalsy();
      expect(tomlNoComments.includes("[tigris]")).toBeFalsy();
      expect(tomlNoComments.includes("fly_tigris")).toBeFalsy();
      expect(readme).toContain("zoen-rebuild");
      expect(readme.toLowerCase()).toContain("all-in-one");
      expect(readme.includes("Managed Postgres")).toBeTruthy();
      expect(dockerfile).toContain("postgres:18.6-trixie");
      expect(dockerfile).toContain("rustfs/rustfs");
      expect(dockerfile).toContain("worlds-hosted-retained-v1");
    }).pipe(Effect.provide(NodeServices.layer))
);
