import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  CreateBucketCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { applyD01Migrations } from "../migrations/run.ts";

class ProvisionError extends Schema.TaggedError<ProvisionError>()(
  "ProvisionError",
  { code: Schema.String }
) {}

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const root = fileURLToPath(new URL("../../", import.meta.url));

const program = Effect.gen(function* provisionLocalApplication() {
  const fs = yield* FileSystem.FileSystem;
  const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
  const endpoint = yield* Config.url("ZOEN_TEST_S3_ENDPOINT");
  const accessKeyId = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
  const secretAccessKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
  const publicUrl = yield* Config.url("ZOEN_LOCAL_PUBLIC_URL").pipe(
    Config.withDefault(new URL("http://127.0.0.1:4310"))
  );
  if (
    publicUrl.hostname !== "127.0.0.1" ||
    publicUrl.protocol !== "http:" ||
    publicUrl.port === ""
  ) {
    return yield* new ProvisionError({ code: "INVALID_LOCAL_ORIGIN" });
  }
  const profile = yield* Config.string("ZOEN_LOCAL_PROFILE").pipe(
    Config.withDefault("application")
  );
  if (!/^[a-z][a-z0-9-]{0,31}$/u.test(profile)) {
    return yield* new ProvisionError({ code: "INVALID_LOCAL_PROFILE" });
  }
  const environmentPath = `${root}.env.${profile}`;
  const directory = `${root}.local/${profile}`;
  if (yield* fs.exists(environmentPath)) {
    return yield* new ProvisionError({ code: "CONFIGURATION_EXISTS" });
  }
  const suffix = randomBytes(12).toString("hex");
  const databaseName = `zoen_local_${suffix}`;
  const bucket = `zoen-local-${suffix}`;
  const names = {
    authority: `zoen_authority_${suffix}`,
    identity: `zoen_identity_${suffix}`,
    migration: `zoen_migration_${suffix}`,
    progress: `zoen_progress_${suffix}`,
  };
  const passwords = {
    authority: randomBytes(32).toString("hex"),
    identity: randomBytes(32).toString("hex"),
    migration: randomBytes(32).toString("hex"),
    progress: randomBytes(32).toString("hex"),
  };
  const roleUrl = (role: keyof typeof names) => {
    const url = new URL(Redacted.value(adminUrl));
    url.pathname = `/${databaseName}`;
    url.username = names[role];
    url.password = passwords[role];
    return url.href;
  };
  const releaseFile = yield* Config.string("ZOEN_LOCAL_RELEASE_FILE").pipe(
    Config.withDefault(`${root}apps/server/dist/release.json`)
  );
  const release = yield* fs.readFile(releaseFile);
  const installation = {
    cellEpoch: "1",
    cellId: randomUUID(),
    generationId: randomUUID(),
    releaseDigest: createHash("sha256").update(release).digest("hex"),
  };
  const policy = {
    dataScope: "admitted-non-sensitive",
    enabledRealm: "live",
    erasure: false,
    legalHold: false,
    licensedExpiry: false,
    profileId: "d01-local-retained-v1",
    restoreAfterErasure: false,
    retention: "while-pinned",
  };
  yield* fs.makeDirectory(directory, { mode: 448, recursive: true });
  const installationPath = `${directory}/installation.json`;
  yield* fs.writeFileString(
    installationPath,
    yield* encodeJson({ installation, policy }),
    { flag: "wx", mode: 384 }
  );
  // Record generated resources before creation. Interrupted setup never deletes or silently replaces them.
  yield* fs.writeFileString(
    `${directory}/provision.json`,
    yield* encodeJson({
      bucket,
      databaseName,
      migrationUrl: roleUrl("migration"),
      names,
    }),
    { flag: "wx", mode: 384 }
  );
  const environment = {
    ZOEN_AUTHORITY_DATABASE_URL: roleUrl("authority"),
    ZOEN_AUTH_SECRET: randomBytes(32).toString("hex"),
    ZOEN_IDENTITY_DATABASE_URL: roleUrl("identity"),
    ZOEN_INSTALLATION_FILE: installationPath,
    ZOEN_LISTEN_HOST: "127.0.0.1",
    ZOEN_PORT: publicUrl.port,
    ZOEN_PUBLIC_URL: publicUrl.origin,
    ZOEN_S3_ACCESS_KEY: Redacted.value(accessKeyId),
    ZOEN_S3_BUCKET: bucket,
    ZOEN_S3_ENDPOINT: endpoint.href,
    ZOEN_S3_REGION: "us-east-1",
    ZOEN_S3_SECRET_KEY: Redacted.value(secretAccessKey),
  };
  const lines: string[] = [];
  for (const [key, value] of Object.entries(environment)) {
    if (/[\r\n"\\]/u.test(value)) {
      return yield* new ProvisionError({
        code: "UNSUPPORTED_ENVIRONMENT_ENCODING",
      });
    }
    lines.push(`${key}="${value}"`);
  }
  yield* fs.writeFileString(environmentPath, `${lines.join("\n")}\n`, {
    flag: "wx",
    mode: 384,
  });
  yield* Effect.gen(function* createIsolatedDatabase() {
    const sql = yield* SqlClient.SqlClient;
    for (const role of [
      "migration",
      "authority",
      "identity",
      "progress",
    ] as const) {
      // Utility PASSWORD cannot be bound. Both values are generated fixed-prefix/hex ASCII above.
      yield* sql.unsafe(
        `CREATE ROLE "${names[role]}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${passwords[role]}'`
      );
    }
    yield* sql`CREATE DATABASE ${sql(databaseName)} OWNER ${sql(names.migration)}`;
  }).pipe(Effect.provide(PgClient.layer({ maxConnections: 1, url: adminUrl })));
  yield* applyD01Migrations(names).pipe(
    Effect.provide(
      PgClient.layer({
        maxConnections: 1,
        url: Redacted.make(roleUrl("migration")),
      })
    )
  );
  yield* Effect.scoped(
    Effect.gen(function* createIsolatedStorage() {
      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new S3Client({
              credentials: {
                accessKeyId: Redacted.value(accessKeyId),
                secretAccessKey: Redacted.value(secretAccessKey),
              },
              endpoint: endpoint.href,
              forcePathStyle: true,
              maxAttempts: 1,
              region: "us-east-1",
              requestHandler: { connectionTimeout: 3000, requestTimeout: 5000 },
            })
        ),
        (resource) =>
          Effect.sync(() => {
            resource.destroy();
          })
      );
      yield* Effect.tryPromise((signal) =>
        client.send(new CreateBucketCommand({ Bucket: bucket }), {
          abortSignal: signal,
        })
      );
      yield* Effect.tryPromise((signal) =>
        client.send(
          new PutBucketVersioningCommand({
            Bucket: bucket,
            VersioningConfiguration: { Status: "Enabled" },
          }),
          { abortSignal: signal }
        )
      );
    })
  );
  return yield* Effect.logInfo({
    event: "local.provisioned",
    origin: publicUrl.origin,
  });
}).pipe(
  Effect.provide(Layer.mergeAll(NodeServices.layer)),
  Effect.tapCause(() => Effect.logError({ event: "local.provision.failed" }))
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
