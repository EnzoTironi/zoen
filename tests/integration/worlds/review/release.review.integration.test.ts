import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem } from "effect";

import type { loadConfiguration as ConfigurationEffect } from "../../../../apps/server/src/configuration.js";
import {
  canonicalJson,
  digestBytes,
} from "../../../../packages/ontology/src/values/canonical.js";

it.live(
  "independent EX10 rejects executable bytes that no longer match the installed build manifest",
  () =>
    Effect.scoped(
      Effect.gen(function* installedBuildIntegrity() {
        const moduleUrl = new URL(
          "../../../../apps/server/dist/configuration.js",
          import.meta.url
        ).href;
        const { loadConfiguration } = yield* Effect.promise<{
          readonly loadConfiguration: typeof ConfigurationEffect;
        }>(() => import(moduleUrl));
        const fs = yield* FileSystem.FileSystem;
        const root = fileURLToPath(new URL("../../../../", import.meta.url));
        const release = yield* fs.readFile(
          `${root}apps/server/dist/release.json`
        );
        const temporary = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-release-review-",
        });
        const installationPath = `${temporary}/installation.json`;
        yield* fs.writeFileString(
          installationPath,
          yield* canonicalJson({
            installation: {
              cellEpoch: "1",
              cellId: randomUUID(),
              generationId: randomUUID(),
              releaseDigest: digestBytes(release),
            },
            policy: {
              dataScope: "admitted-non-sensitive",
              enabledRealm: "live",
              erasure: false,
              legalHold: false,
              licensedExpiry: false,
              profileId: "worlds-local-retained-v1",
              restoreAfterErasure: false,
              retention: "while-pinned",
            },
          })
        );
        const provider = ConfigProvider.fromEnvRecord({
          ZOEN_AUTHORITY_DATABASE_URL:
            "postgres://fixture:fixture@localhost/authority",
          ZOEN_AUTH_SECRET:
            "fixture-secret-used-only-for-configuration-reading",
          ZOEN_IDENTITY_DATABASE_URL:
            "postgres://fixture:fixture@localhost/identity",
          ZOEN_INSTALLATION_FILE: installationPath,
          ZOEN_PORT: "3000",
          ZOEN_PUBLIC_URL: "http://localhost:3000",
          ZOEN_S3_ACCESS_KEY: "fixture",
          ZOEN_S3_BUCKET: "fixture-bucket",
          ZOEN_S3_ENDPOINT: "http://localhost:9000",
          ZOEN_S3_REGION: "us-east-1",
          ZOEN_S3_SECRET_KEY: "fixture",
        });
        const load = loadConfiguration.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        );
        expect(yield* load.pipe(Effect.as("loaded"))).toBe("loaded");
        const target = `${root}packages/ontology/dist/knowledge/selection.js`;
        const original = yield* fs.readFileString(target);
        yield* Effect.acquireRelease(
          fs.writeFileString(
            target,
            `${original}\n// Independent review: bytes differ from the installed manifest.\n`
          ),
          () => fs.writeFileString(target, original).pipe(Effect.orDie)
        );
        expect(
          digestBytes(
            new TextEncoder().encode(yield* fs.readFileString(target))
          )
        ).not.toBe(digestBytes(new TextEncoder().encode(original)));
        const result = yield* load.pipe(Effect.result);
        expect(result._tag).toBe("Failure");
      })
    ).pipe(Effect.provide(NodeFileSystem.layer))
);
