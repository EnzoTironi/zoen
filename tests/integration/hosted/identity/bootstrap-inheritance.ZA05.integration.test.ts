import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem } from "effect";

import type { loadConfiguration as ConfigurationEffect } from "../../../../apps/server/src/configuration.js";
import {
  canonicalJson,
  digestBytes,
} from "../../../../packages/authority/src/values/canonical.js";

const baseEnv = (installationPath: string) => ({
  ZOEN_AUTHORITY_DATABASE_URL: "postgres://fixture:fixture@localhost/authority",
  ZOEN_AUTH_SECRET: "fixture-secret-used-only-for-configuration-reading",
  ZOEN_IDENTITY_DATABASE_URL: "postgres://fixture:fixture@localhost/identity",
  ZOEN_INSTALLATION_FILE: installationPath,
  ZOEN_PORT: "3000",
  ZOEN_PUBLIC_URL: "http://localhost:3000",
  ZOEN_S3_ACCESS_KEY: "fixture-app",
  ZOEN_S3_BUCKET: "fixture-bucket",
  ZOEN_S3_ENDPOINT: "http://localhost:9000",
  ZOEN_S3_REGION: "us-east-1",
  ZOEN_S3_SECRET_KEY: "fixture-app-secret",
});

it.live(
  "ZA-05-03 loadConfiguration rejects inherited bootstrap admin URL",
  () =>
    Effect.scoped(
      Effect.gen(function* rejectBootstrapAdminUrl() {
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
          prefix: "zoen-za05-config-",
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
              profileId: "d04-hosted-retained-v1",
              restoreAfterErasure: false,
              retention: "while-pinned",
            },
          })
        );
        const rejected = yield* loadConfiguration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({
              ...baseEnv(installationPath),
              ZOEN_BOOTSTRAP_ADMIN_URL:
                "postgresql://zoen_infra:secret@127.0.0.1:5432/postgres",
            })
          ),
          Effect.result
        );
        expect(rejected._tag).toBe("Failure");

        const rejectedAdminKey = yield* loadConfiguration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({
              ...baseEnv(installationPath),
              ZOEN_S3_ADMIN_ACCESS_KEY: "rustfs-root",
            })
          ),
          Effect.result
        );
        expect(rejectedAdminKey._tag).toBe("Failure");

        const rejectedAdminSecret = yield* loadConfiguration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord({
              ...baseEnv(installationPath),
              ZOEN_S3_ADMIN_SECRET_KEY: "rustfs-root-secret",
            })
          ),
          Effect.result
        );
        expect(rejectedAdminSecret._tag).toBe("Failure");

        const accepted = yield* loadConfiguration.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnvRecord(baseEnv(installationPath))
          ),
          Effect.as("loaded")
        );
        expect(accepted).toBe("loaded");
      })
    ).pipe(Effect.provide(NodeFileSystem.layer))
);
