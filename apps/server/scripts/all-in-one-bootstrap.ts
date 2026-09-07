import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import {
  Config,
  Effect,
  FileSystem,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { SqlClient } from "effect/unstable/sql";

import { resolveLocalWorldPolicy } from "../../../ops/local/world-policy.ts";
import { applyErasureMigrations } from "../../../ops/migrations/run.ts";
import {
  digestReleaseBytes,
  planReleaseAlign,
} from "../src/all-in-one-release-align.ts";

class BootstrapError extends Schema.TaggedError<BootstrapError>()(
  "BootstrapError",
  { code: Schema.String }
) {}

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const root = fileURLToPath(new URL("../../../", import.meta.url));

const names = {
  authority: "zoen_authority",
  identity: "zoen_identity",
  migration: "zoen_migration",
  progress: "zoen_progress",
} as const;

const databaseName = "zoen";

const alignExistingHostedRelease = (input: {
  readonly encodeInstallation: typeof encodeJson;
  readonly fs: FileSystem.FileSystem;
  readonly installationPath: string;
  readonly releaseFile: string;
  readonly runtimeEnvPath: string;
}) =>
  Effect.gen(function* alignRelease() {
    const {
      encodeInstallation,
      fs,
      installationPath,
      releaseFile,
      runtimeEnvPath,
    } = input;
    const plan = planReleaseAlign(
      yield* fs.readFileString(installationPath),
      yield* fs.readFile(releaseFile),
      yield* fs.readFileString(runtimeEnvPath)
    );
    if (plan.kind === "error") {
      return yield* new BootstrapError({ code: plan.code });
    }
    if (plan.kind === "skip") {
      return yield* Effect.logInfo({ event: "all-in-one.bootstrap.skip" });
    }
    const { authorityUrl, next, previousDigest, releaseDigest } = plan;
    const { cellId, generationId } = next.installation;
    yield* Effect.gen(function* rewriteWorldsReleaseDigest() {
      const sql = yield* SqlClient.SqlClient;
      // Pre-launch: force cell/generation onto the image digest (no dual-read).
      yield* sql`
        UPDATE authority.worlds
        SET release_digest = ${releaseDigest}
        WHERE cell_id = ${cellId}::uuid
          AND generation_id = ${generationId}::uuid
      `;
    }).pipe(
      Effect.provide(
        PgClient.layer({
          maxConnections: 1,
          url: Redacted.make(authorityUrl),
        })
      )
    );
    const encoded = yield* encodeInstallation(next);
    const tmpPath = `${installationPath}.tmp`;
    if (yield* fs.exists(tmpPath)) {
      yield* fs.remove(tmpPath);
    }
    yield* fs.writeFileString(tmpPath, encoded, { flag: "wx", mode: 0o600 });
    yield* fs.rename(tmpPath, installationPath);
    return yield* Effect.logInfo({
      event: "all-in-one.bootstrap.release-aligned",
      from: previousDigest,
      to: releaseDigest,
    });
  });

const program = Effect.gen(function* bootstrapAllInOne() {
  const fs = yield* FileSystem.FileSystem;
  const adminUrl = yield* Config.redacted("ZOEN_BOOTSTRAP_ADMIN_URL");
  const endpoint = yield* Config.url("ZOEN_S3_ENDPOINT");
  const accessKeyId = yield* Config.redacted("ZOEN_S3_ACCESS_KEY");
  const secretAccessKey = yield* Config.redacted("ZOEN_S3_SECRET_KEY");
  const bucket = yield* Config.string("ZOEN_S3_BUCKET").pipe(
    Config.withDefault("zoen")
  );
  const installationPath = yield* Config.string("ZOEN_INSTALLATION_FILE");
  const runtimeEnvPath = yield* Config.string("ZOEN_RUNTIME_ENV_FILE");
  const releaseFile = yield* Config.string("ZOEN_RELEASE_FILE").pipe(
    Config.withDefault(`${root}apps/server/dist/release.json`)
  );
  const worldPolicyId = yield* Config.string("ZOEN_WORLD_POLICY").pipe(
    Config.withDefault("d04-hosted-retained-v1")
  );
  const policy = resolveLocalWorldPolicy(worldPolicyId);
  if (policy === null) {
    return yield* new BootstrapError({ code: "INVALID_WORLD_POLICY" });
  }

  const stateDir = installationPath.includes("/")
    ? installationPath.slice(0, installationPath.lastIndexOf("/"))
    : ".";
  const markerPath = `${stateDir}/.bootstrap-complete`;
  if (yield* fs.exists(markerPath)) {
    if (
      !(yield* fs.exists(runtimeEnvPath)) ||
      !(yield* fs.exists(installationPath))
    ) {
      return yield* new BootstrapError({
        code: "BOOTSTRAP_MARKER_INCONSISTENT",
      });
    }
    return yield* alignExistingHostedRelease({
      encodeInstallation: encodeJson,
      fs,
      installationPath,
      releaseFile,
      runtimeEnvPath,
    });
  }

  const authSecret = yield* Config.redacted("ZOEN_AUTH_SECRET").pipe(
    Config.option
  );
  if (Option.isNone(authSecret)) {
    return yield* new BootstrapError({ code: "MISSING_ZOEN_AUTH_SECRET" });
  }

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

  const release = yield* fs.readFile(releaseFile);
  const installation = {
    cellEpoch: "1",
    cellId: randomUUID(),
    generationId: randomUUID(),
    releaseDigest: digestReleaseBytes(release),
  };

  yield* fs.makeDirectory(stateDir, { mode: 0o700, recursive: true });

  // Create-or-resume: reset passwords if roles already exist from a crashed boot.
  yield* Effect.gen(function* ensureDatabaseAndRoles() {
    const sql = yield* SqlClient.SqlClient;
    for (const role of [
      "migration",
      "authority",
      "identity",
      "progress",
    ] as const) {
      const rows = yield* sql<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = ${names[role]}
        ) AS exists
      `;
      yield* rows[0]?.exists === true
        ? sql.unsafe(
            `ALTER ROLE "${names[role]}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${passwords[role]}'`
          )
        : sql.unsafe(
            `CREATE ROLE "${names[role]}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${passwords[role]}'`
          );
    }
    const dbRows = yield* sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM pg_database WHERE datname = ${databaseName}
      ) AS exists
    `;
    if (dbRows[0]?.exists !== true) {
      yield* sql`CREATE DATABASE ${sql(databaseName)} OWNER ${sql(names.migration)}`;
    }
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
    Effect.gen(function* ensureBucket() {
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
      const exists = yield* Effect.tryPromise((signal) =>
        client.send(new HeadBucketCommand({ Bucket: bucket }), {
          abortSignal: signal,
        })
      ).pipe(
        Effect.as(true),
        Effect.orElseSucceed(() => false)
      );
      if (!exists) {
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
      }
    })
  );

  if (!(yield* fs.exists(installationPath))) {
    yield* fs.writeFileString(
      installationPath,
      yield* encodeJson({ installation, policy }),
      { flag: "wx", mode: 0o600 }
    );
  }

  const environment: Record<string, string> = {
    ZOEN_AUTHORITY_DATABASE_URL: roleUrl("authority"),
    ZOEN_IDENTITY_DATABASE_URL: roleUrl("identity"),
    ZOEN_INSTALLATION_FILE: installationPath,
    ZOEN_S3_ACCESS_KEY: Redacted.value(accessKeyId),
    ZOEN_S3_BUCKET: bucket,
    ZOEN_S3_ENDPOINT: endpoint.href,
    ZOEN_S3_REGION: "us-east-1",
    ZOEN_S3_SECRET_KEY: Redacted.value(secretAccessKey),
  };
  const lines: string[] = [];
  for (const [key, value] of Object.entries(environment)) {
    if (/[\r\n"\\]/u.test(value)) {
      return yield* new BootstrapError({
        code: "UNSUPPORTED_ENVIRONMENT_ENCODING",
      });
    }
    lines.push(`${key}="${value}"`);
  }
  // Always rewrite runtime.env on incomplete boots so passwords match ALTER ROLE.
  if (yield* fs.exists(runtimeEnvPath)) {
    yield* fs.remove(runtimeEnvPath);
  }
  yield* fs.writeFileString(runtimeEnvPath, `${lines.join("\n")}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  yield* fs.writeFileString(markerPath, "ok\n", { flag: "wx", mode: 0o600 });
  return yield* Effect.logInfo({ event: "all-in-one.bootstrap.ready" });
}).pipe(
  Effect.provide(Layer.mergeAll(NodeServices.layer)),
  Effect.catch((error) =>
    Effect.gen(function* reportAndRethrow() {
      const fs = yield* FileSystem.FileSystem;
      let code = "UNKNOWN";
      if (typeof error === "object" && error !== null && "code" in error) {
        const candidate: unknown = Reflect.get(error, "code");
        if (typeof candidate === "string") {
          code = candidate;
        }
      }
      const message = String(error);
      // Durable diagnosis on the volume (no secrets).
      yield* fs
        .makeDirectory("/data/zoen", { mode: 0o700, recursive: true })
        .pipe(Effect.ignore);
      yield* fs
        .writeFileString(
          "/data/zoen/bootstrap-error.txt",
          `${code}\n${message}\n`,
          { mode: 0o600 }
        )
        .pipe(Effect.ignore);
      yield* Effect.logError({
        code,
        event: "all-in-one.bootstrap.failed",
        message,
      });
      return yield* Effect.fail(error);
    }).pipe(Effect.provide(NodeServices.layer))
  )
);

NodeRuntime.runMain(program, { disableErrorReporting: false });
