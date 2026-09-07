import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { applyErasureMigrations } from "../migrations/run.ts";
import { resolveLocalWorldPolicy } from "./world-policy.ts";

class ProvisionError extends Schema.TaggedError<ProvisionError>()(
  "ProvisionError",
  { code: Schema.String }
) {}

const s3ErrorName = (error: unknown): string => {
  if (error !== null && typeof error === "object" && "name" in error) {
    const { name } = error as { readonly name?: unknown };
    return typeof name === "string" ? name : "";
  }
  return "";
};

const isHeldStorageError = (error: unknown): boolean => {
  const message = String(error);
  return (
    message.includes("AccessDenied") ||
    message.includes("ObjectLocked") ||
    message.includes("retention") ||
    message.includes("WORM")
  );
};

const heldOrFailed = (error: unknown, failed: string): ProvisionError =>
  new ProvisionError({
    code: isHeldStorageError(error) ? "RESET_BUCKET_HELD_BLOCKED" : failed,
  });

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
  // F02/H01: erasable/hosted retained only for NEW installs; default remains local retained.
  // No rebind of existing Worlds. Hosted profile is local compose stand-in (no Fly deploy).
  const worldPolicy = yield* Config.string("ZOEN_LOCAL_WORLD_POLICY").pipe(
    Config.withDefault("worlds-local-retained-v1")
  );
  const policy = resolveLocalWorldPolicy(worldPolicy);
  if (policy === null) {
    return yield* new ProvisionError({ code: "INVALID_LOCAL_WORLD_POLICY" });
  }
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
  // Ownership inventory for scoped local reset (ZA-04). Never implies volume wipe.
  yield* fs.writeFileString(
    `${directory}/resources.json`,
    yield* encodeJson({
      bucket,
      checkout: root.replace(/\/$/u, ""),
      composeFile: "ops/compose.yaml",
      composeProject: "zoen-rebuild",
      databaseName,
      profile,
      roleNames: Object.values(names),
      schemaVersion: "local-profile-resources.v1",
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
  yield* applyErasureMigrations(names).pipe(
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
      // Erasable installs require Object Lock at CreateBucket (S3-compatible).
      // Retained installs stay without Object Lock — no dual-mode on one bucket.
      yield* Effect.tryPromise((signal) =>
        client.send(
          new CreateBucketCommand({
            Bucket: bucket,
            ...(policy.erasure ? { ObjectLockEnabledForBucket: true } : {}),
          }),
          { abortSignal: signal }
        )
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

const isLocalHostname = (hostname: string): boolean =>
  hostname === "127.0.0.1" || hostname === "localhost";

const resetOwnedProgram = Effect.gen(function* resetOwnedLocalProfile() {
  const fs = yield* FileSystem.FileSystem;
  const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
  const endpoint = yield* Config.url("ZOEN_TEST_S3_ENDPOINT");
  const accessKeyId = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
  const secretAccessKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
  const profile = yield* Config.string("ZOEN_LOCAL_PROFILE");
  if (profile !== "staging") {
    return yield* new ProvisionError({ code: "RESET_PROFILE_NOT_STAGING" });
  }
  if (!isLocalHostname(endpoint.hostname) || endpoint.protocol !== "http:") {
    return yield* new ProvisionError({ code: "RESET_HOSTED_ENDPOINT_REFUSED" });
  }
  const adminParsed = new URL(Redacted.value(adminUrl));
  if (!isLocalHostname(adminParsed.hostname)) {
    return yield* new ProvisionError({ code: "RESET_HOSTED_DATABASE_REFUSED" });
  }
  const databaseName = yield* Config.string("ZOEN_LOCAL_RESET_DATABASE");
  const bucket = yield* Config.string("ZOEN_LOCAL_RESET_BUCKET");
  const rolesCsv = yield* Config.string("ZOEN_LOCAL_RESET_ROLES");
  if (!/^zoen_local_[0-9a-f]{24}$/u.test(databaseName)) {
    return yield* new ProvisionError({ code: "RESET_DATABASE_NAME_INVALID" });
  }
  if (!/^zoen-local-[0-9a-f]{24}$/u.test(bucket)) {
    return yield* new ProvisionError({ code: "RESET_BUCKET_NAME_INVALID" });
  }
  const roleNames = rolesCsv.split(",").filter((value) => value.length > 0);
  if (roleNames.length === 0) {
    return yield* new ProvisionError({ code: "RESET_ROLES_MISSING" });
  }
  for (const role of roleNames) {
    if (
      !/^zoen_(?:authority|identity|migration|progress)_[0-9a-f]{24}$/u.test(
        role
      )
    ) {
      return yield* new ProvisionError({ code: "RESET_ROLE_NAME_INVALID" });
    }
  }
  yield* Effect.gen(function* dropOwnedDatabase() {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`
    );
    yield* sql.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    for (const role of roleNames) {
      yield* sql.unsafe(`DROP ROLE IF EXISTS "${role}"`);
    }
  }).pipe(Effect.provide(PgClient.layer({ maxConnections: 1, url: adminUrl })));
  yield* Effect.scoped(
    Effect.gen(function* deleteOwnedBucket() {
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
      const listing = yield* Effect.tryPromise({
        catch: (error) => heldOrFailed(error, "RESET_BUCKET_LIST_FAILED"),
        try: async (signal) => {
          try {
            return await client.send(
              new ListObjectVersionsCommand({ Bucket: bucket }),
              { abortSignal: signal }
            );
          } catch (error) {
            const name = s3ErrorName(error);
            if (name === "NoSuchBucket" || name === "NotFound") {
              return null;
            }
            throw error;
          }
        },
      });
      if (listing === null) {
        return yield* Effect.void;
      }
      if (listing.IsTruncated === true) {
        return yield* new ProvisionError({
          code: "RESET_BUCKET_LIST_TRUNCATED",
        });
      }
      const entries = [
        ...(listing.Versions ?? []),
        ...(listing.DeleteMarkers ?? []),
      ];
      for (const object of entries) {
        if (object.Key === undefined) {
          return yield* new ProvisionError({
            code: "RESET_BUCKET_ENTRY_INVALID",
          });
        }
        const objectKey = object.Key;
        yield* Effect.tryPromise({
          catch: (error) =>
            heldOrFailed(error, "RESET_BUCKET_DELETE_OBJECT_FAILED"),
          try: (signal) =>
            client.send(
              new DeleteObjectCommand({
                Bucket: bucket,
                Key: objectKey,
                VersionId: object.VersionId,
              }),
              { abortSignal: signal }
            ),
        });
      }
      yield* Effect.tryPromise({
        catch: (error) => heldOrFailed(error, "RESET_BUCKET_DELETE_FAILED"),
        try: (signal) =>
          client.send(new DeleteBucketCommand({ Bucket: bucket }), {
            abortSignal: signal,
          }),
      });
      return yield* Effect.void;
    })
  );
  // Touch fs so the dependency remains meaningful for interrupted resumes.
  yield* fs.exists(`${root}.local/${profile}/provision.json`);
  return yield* Effect.logInfo({
    event: "local.profile.reset_owned",
    profile,
  });
}).pipe(
  Effect.provide(Layer.mergeAll(NodeServices.layer)),
  Effect.tapCause(() =>
    Effect.logError({ event: "local.profile.reset.failed" })
  )
);

if (process.argv.includes("--reset-owned")) {
  NodeRuntime.runMain(resetOwnedProgram, { disableErrorReporting: true });
} else {
  NodeRuntime.runMain(program, { disableErrorReporting: true });
}
