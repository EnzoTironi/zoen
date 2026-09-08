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
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { resolveLocalWorldPolicy } from "../../../ops/local/world-policy.ts";
import { applyErasureMigrations } from "../../../ops/migrations/run.ts";
import {
  digestReleaseBytes,
  parseHostedInstallationFile,
  parseQuotedEnvFile,
} from "../src/all-in-one-release-align.ts";
import {
  applyHostedReleaseAlign,
  HostedReleaseAlignError,
} from "../src/all-in-one-release-apply.ts";

class BootstrapError extends Schema.TaggedError<BootstrapError>()(
  "BootstrapError",
  { code: Schema.String }
) {}

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));
const root = fileURLToPath(new URL("../../../", import.meta.url));

const names = {
  authority: "zoen_authority",
  identity: "zoen_identity",
  migration: "zoen_migration",
  progress: "zoen_progress",
} as const;

const databaseName = "zoen";

const requirePasswordInAdminUrl = (adminUrl: string) => {
  const url = new URL(adminUrl);
  if (url.password.length === 0) {
    return new BootstrapError({ code: "BOOTSTRAP_ADMIN_PASSWORD_REQUIRED" });
  }
  return null;
};

const ensureScopedObjectStoreUser = (input: {
  readonly adminAccessKey: string;
  readonly adminSecretKey: string;
  readonly appAccessKey: string;
  readonly appSecretKey: string;
  readonly bucket: string;
  readonly endpoint: string;
}) =>
  Effect.scoped(
    Effect.gen(function* runRustfsEnsureAppUser() {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const script = `${root}ops/containers/rustfs-ensure-app-user.py`;
      const child = yield* spawner.spawn(
        ChildProcess.make("python3", [script], {
          env: {
            ...process.env,
            ZOEN_S3_ADMIN_ACCESS_KEY: input.adminAccessKey,
            ZOEN_S3_ADMIN_SECRET_KEY: input.adminSecretKey,
            ZOEN_S3_APP_ACCESS_KEY: input.appAccessKey,
            ZOEN_S3_APP_SECRET_KEY: input.appSecretKey,
            ZOEN_S3_BUCKET: input.bucket,
            ZOEN_S3_ENDPOINT: input.endpoint,
          },
        })
      );
      const code = yield* child.exitCode;
      if (code !== 0) {
        return yield* new BootstrapError({ code: "OBJECT_STORE_IAM_FAILED" });
      }
      return yield* Effect.void;
    })
  ).pipe(
    Effect.mapError(
      () => new BootstrapError({ code: "OBJECT_STORE_IAM_FAILED" })
    )
  );

const writeAtomicString = (
  fs: FileSystem.FileSystem,
  targetPath: string,
  contents: string,
  mode: number
) =>
  Effect.gen(function* atomicWrite() {
    const tmpPath = `${targetPath}.tmp`;
    if (yield* fs.exists(tmpPath)) {
      yield* fs.remove(tmpPath);
    }
    yield* fs.writeFileString(tmpPath, contents, { flag: "wx", mode });
    yield* fs.rename(tmpPath, targetPath);
    return yield* Effect.void;
  });

const writeRuntimeEnv = (
  fs: FileSystem.FileSystem,
  runtimeEnvPath: string,
  environment: Record<string, string>
) =>
  Effect.gen(function* writeEnv() {
    if (Object.values(environment).some((value) => /[\r\n"\\]/u.test(value))) {
      return yield* new BootstrapError({
        code: "UNSUPPORTED_ENVIRONMENT_ENCODING",
      });
    }
    const lines = Object.entries(environment).map(
      ([key, value]) => `${key}="${value}"`
    );
    yield* writeAtomicString(
      fs,
      runtimeEnvPath,
      `${lines.join("\n")}\n`,
      0o600
    );
    return yield* Effect.void;
  });

/** Deterministic crash barriers for ZA-06-03 seam tests (never privilege). */
const maybeCrashAfter = (stage: string) =>
  Effect.gen(function* crashBarrier() {
    const configured = yield* Config.string("ZOEN_BOOTSTRAP_CRASH_AFTER").pipe(
      Config.option
    );
    if (Option.isNone(configured) || configured.value !== stage) {
      return yield* Effect.void;
    }
    return yield* new BootstrapError({
      code: `BOOTSTRAP_CRASH_AFTER_${stage.toUpperCase().replaceAll("-", "_")}`,
    });
  });

const alignExistingHostedRelease = (input: {
  readonly fs: FileSystem.FileSystem;
  readonly installationPath: string;
  readonly releaseFile: string;
  readonly runtimeEnvPath: string;
}) =>
  applyHostedReleaseAlign({
    fs: input.fs,
    installationPath: input.installationPath,
    reconcileWorlds: (step) =>
      Effect.gen(function* rewriteWorldsReleaseDigest() {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`
          UPDATE authority.worlds
          SET release_digest = ${step.releaseDigest}
          WHERE cell_id = ${step.cellId}::uuid
            AND generation_id = ${step.generationId}::uuid
        `;
      }).pipe(
        Effect.provide(
          PgClient.layer({
            maxConnections: 1,
            url: Redacted.make(step.authorityUrl),
          })
        ),
        Effect.orDie
      ),
    releaseFile: input.releaseFile,
    runtimeEnvPath: input.runtimeEnvPath,
  }).pipe(
    Effect.mapError((error) =>
      Schema.is(HostedReleaseAlignError)(error)
        ? new BootstrapError({ code: error.code })
        : new BootstrapError({ code: "RELEASE_ALIGN_FAILED" })
    ),
    Effect.tap((result) => Effect.logInfo(result))
  );

const admitIncompleteInstallation = (
  fs: FileSystem.FileSystem,
  installationPath: string,
  releaseDigest: string
) =>
  Effect.gen(function* admitIncomplete() {
    if (!(yield* fs.exists(installationPath))) {
      return yield* Effect.void;
    }
    const installedUnknown = yield* decodeJson(
      yield* fs.readFileString(installationPath)
    ).pipe(
      Effect.mapError(
        () => new BootstrapError({ code: "INVALID_INSTALLATION_FILE" })
      )
    );
    const hosted = parseHostedInstallationFile(installedUnknown);
    if (hosted === null) {
      return yield* new BootstrapError({ code: "INVALID_INSTALLATION_FILE" });
    }
    if (hosted.installation.releaseDigest !== releaseDigest) {
      return yield* new BootstrapError({ code: "RESET_REQUIRED" });
    }
    return yield* Effect.void;
  });

const loadOrMintPendingAppCredentials = (
  fs: FileSystem.FileSystem,
  pendingCredentialsPath: string
) =>
  Effect.gen(function* pendingCredentials() {
    if (yield* fs.exists(pendingCredentialsPath)) {
      const pending = parseQuotedEnvFile(
        yield* fs.readFileString(pendingCredentialsPath)
      );
      const access = pending?.ZOEN_S3_ACCESS_KEY;
      const secret = pending?.ZOEN_S3_SECRET_KEY;
      if (
        pending === null ||
        access === undefined ||
        secret === undefined ||
        access.length === 0 ||
        secret.length === 0
      ) {
        return yield* new BootstrapError({
          code: "PENDING_CREDENTIALS_MALFORMED",
        });
      }
      return { appAccessKey: access, appSecretKey: secret } as const;
    }
    const appAccessKey = `zoenapp${randomBytes(8).toString("hex")}`;
    const appSecretKey = randomBytes(32).toString("hex");
    yield* writeRuntimeEnv(fs, pendingCredentialsPath, {
      ZOEN_S3_ACCESS_KEY: appAccessKey,
      ZOEN_S3_SECRET_KEY: appSecretKey,
    });
    return { appAccessKey, appSecretKey } as const;
  });

const migrateExistingVolumeSchema = (adminUrl: Redacted.Redacted) =>
  Effect.gen(function* migrateExisting() {
    const migrationPassword = randomBytes(32).toString("hex");
    yield* Effect.gen(function* rotateMigrationPassword() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.unsafe(
        `ALTER ROLE "${names.migration}" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${migrationPassword}'`
      );
    }).pipe(
      Effect.provide(PgClient.layer({ maxConnections: 1, url: adminUrl }))
    );
    const migrationUrl = (() => {
      const url = new URL(Redacted.value(adminUrl));
      url.pathname = `/${databaseName}`;
      url.username = names.migration;
      url.password = migrationPassword;
      return url.href;
    })();
    yield* applyErasureMigrations(names).pipe(
      Effect.provide(
        PgClient.layer({
          maxConnections: 1,
          url: Redacted.make(migrationUrl),
        })
      )
    );
    return yield* Effect.void;
  });

const bootstrapSameReleaseRestart = (input: {
  readonly adminAccessKeyId: Redacted.Redacted;
  readonly adminSecretAccessKey: Redacted.Redacted;
  readonly adminUrl: Redacted.Redacted;
  readonly bucket: string;
  readonly endpoint: URL;
  readonly fs: FileSystem.FileSystem;
  readonly installationPath: string;
  readonly releaseFile: string;
  readonly runtimeEnvPath: string;
}) =>
  Effect.gen(function* sameReleaseRestart() {
    const {
      adminAccessKeyId,
      adminSecretAccessKey,
      adminUrl,
      bucket,
      endpoint,
      fs,
      installationPath,
      releaseFile,
      runtimeEnvPath,
    } = input;
    if (
      !(yield* fs.exists(runtimeEnvPath)) ||
      !(yield* fs.exists(installationPath))
    ) {
      return yield* new BootstrapError({
        code: "BOOTSTRAP_MARKER_INCONSISTENT",
      });
    }
    const existing = parseQuotedEnvFile(
      yield* fs.readFileString(runtimeEnvPath)
    );
    if (existing === null) {
      return yield* new BootstrapError({ code: "RUNTIME_ENV_MALFORMED" });
    }
    // Retain the bucket already bound to the app identity; refuse silent retarget.
    const runtimeBucket = existing.ZOEN_S3_BUCKET;
    if (runtimeBucket === undefined || runtimeBucket.length === 0) {
      return yield* new BootstrapError({ code: "RUNTIME_ENV_BUCKET_MISSING" });
    }
    if (runtimeBucket !== bucket) {
      return yield* new BootstrapError({ code: "BUCKET_MISMATCH_REFUSED" });
    }
    // ZA-06: same-release admission before any mutate. Digest mismatch →
    // RESET_REQUIRED (no silent rewrite). Leave a seam for ZA-08 admitted
    // same-release schema migrate on existing volumes AFTER this check.
    yield* alignExistingHostedRelease({
      fs,
      installationPath,
      releaseFile,
      runtimeEnvPath,
    });
    // --- ZA-08 seam (migrate on existing same-release volumes) ---
    // #92: rotate migration password via infra admin, then idempotent DDL.
    // Digest admission above must stay first; incompatible images refuse before DDL.
    yield* migrateExistingVolumeSchema(adminUrl);
    // --- end ZA-08 seam ---
    const adminAccess = Redacted.value(adminAccessKeyId);
    const adminSecret = Redacted.value(adminSecretAccessKey);
    let appAccess = existing.ZOEN_S3_ACCESS_KEY ?? "";
    let appSecret = existing.ZOEN_S3_SECRET_KEY ?? "";
    const inheritsAdmin =
      appAccess.length === 0 ||
      appSecret.length === 0 ||
      appAccess === adminAccess ||
      appSecret === adminSecret;
    if (inheritsAdmin) {
      appAccess = `zoenapp${randomBytes(8).toString("hex")}`;
      appSecret = randomBytes(32).toString("hex");
    }
    yield* ensureScopedObjectStoreUser({
      adminAccessKey: adminAccess,
      adminSecretKey: adminSecret,
      appAccessKey: appAccess,
      appSecretKey: appSecret,
      bucket: runtimeBucket,
      endpoint: endpoint.href,
    });
    if (inheritsAdmin) {
      yield* writeRuntimeEnv(fs, runtimeEnvPath, {
        ...existing,
        ZOEN_S3_ACCESS_KEY: appAccess,
        ZOEN_S3_BUCKET: runtimeBucket,
        ZOEN_S3_SECRET_KEY: appSecret,
      });
    }
    return yield* Effect.logInfo({
      event: "all-in-one.bootstrap.ready",
      mode: "same-release-restart",
    });
  });

const program = Effect.gen(function* bootstrapAllInOne() {
  const fs = yield* FileSystem.FileSystem;
  const adminUrl = yield* Config.redacted("ZOEN_BOOTSTRAP_ADMIN_URL");
  const adminPasswordError = requirePasswordInAdminUrl(
    Redacted.value(adminUrl)
  );
  if (adminPasswordError !== null) {
    return yield* adminPasswordError;
  }
  const endpoint = yield* Config.url("ZOEN_S3_ENDPOINT");
  const adminAccessKeyId = yield* Config.redacted("ZOEN_S3_ADMIN_ACCESS_KEY");
  const adminSecretAccessKey = yield* Config.redacted(
    "ZOEN_S3_ADMIN_SECRET_KEY"
  );
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
    return yield* bootstrapSameReleaseRestart({
      adminAccessKeyId,
      adminSecretAccessKey,
      adminUrl,
      bucket,
      endpoint,
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
  const releaseDigest = digestReleaseBytes(release);
  // Incomplete installs (installation present, marker absent) are not an
  // unconditionally reusable identity: refuse wrong-image resume before DDL.
  yield* admitIncompleteInstallation(fs, installationPath, releaseDigest);

  const installation = {
    cellEpoch: "1",
    cellId: randomUUID(),
    generationId: randomUUID(),
    releaseDigest,
  };

  yield* fs.makeDirectory(stateDir, { mode: 0o700, recursive: true });

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
  yield* maybeCrashAfter("schema-roles");

  yield* applyErasureMigrations(names).pipe(
    Effect.provide(
      PgClient.layer({
        maxConnections: 1,
        url: Redacted.make(roleUrl("migration")),
      })
    )
  );
  yield* maybeCrashAfter("schema");

  yield* Effect.scoped(
    Effect.gen(function* ensureBucket() {
      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new S3Client({
              credentials: {
                accessKeyId: Redacted.value(adminAccessKeyId),
                secretAccessKey: Redacted.value(adminSecretAccessKey),
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

  // Resume-safe: keep an existing installation identity across interrupted boots.
  // Digest was already admitted above when the file existed.
  if (!(yield* fs.exists(installationPath))) {
    yield* writeAtomicString(
      fs,
      installationPath,
      yield* encodeJson({ installation, policy }),
      0o600
    );
  }
  yield* maybeCrashAfter("installation");

  // Persist pending app credentials before provisioning so a crash between
  // IAM create and runtime.env does not orphan enabled RustFS users on retry.
  const pendingCredentialsPath = `${stateDir}/.pending-s3-app-credentials.env`;
  const { appAccessKey, appSecretKey } = yield* loadOrMintPendingAppCredentials(
    fs,
    pendingCredentialsPath
  );
  yield* ensureScopedObjectStoreUser({
    adminAccessKey: Redacted.value(adminAccessKeyId),
    adminSecretKey: Redacted.value(adminSecretAccessKey),
    appAccessKey,
    appSecretKey,
    bucket,
    endpoint: endpoint.href,
  });
  yield* maybeCrashAfter("credentials");

  const environment: Record<string, string> = {
    ZOEN_AUTHORITY_DATABASE_URL: roleUrl("authority"),
    ZOEN_IDENTITY_DATABASE_URL: roleUrl("identity"),
    ZOEN_INSTALLATION_FILE: installationPath,
    ZOEN_S3_ACCESS_KEY: appAccessKey,
    ZOEN_S3_BUCKET: bucket,
    ZOEN_S3_ENDPOINT: endpoint.href,
    ZOEN_S3_REGION: "us-east-1",
    ZOEN_S3_SECRET_KEY: appSecretKey,
  };
  yield* writeRuntimeEnv(fs, runtimeEnvPath, environment);
  yield* maybeCrashAfter("runtime-env");
  yield* writeAtomicString(fs, markerPath, "ok\n", 0o600);
  if (yield* fs.exists(pendingCredentialsPath)) {
    yield* fs.remove(pendingCredentialsPath);
  }
  return yield* Effect.logInfo({
    event: "all-in-one.bootstrap.ready",
    mode: "first-install",
  });
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
