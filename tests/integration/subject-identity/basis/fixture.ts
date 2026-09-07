import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import { ErasureAttemptRegister } from "@zoen/authority/ports/erasure/attempt-register";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/worlds/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { intentDigest } from "@zoen/authority/values/canonical";
import { decodeSemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import {
  Cookies,
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import type { HttpClientResponse } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { layer as s3EvidenceLayer } from "../../../../apps/server/src/adapters/object-storage/worlds/s3.ts";
import type { IdentityAuth } from "../../../../apps/server/src/identity/worlds/identity.ts";
import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import type { WorldsTestDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { makeTestIdentityLayer } from "../../../../apps/server/test/identity/worlds/database.ts";
import {
  applyDisclosureMigrations,
  applyIdentityBasisMigrations,
} from "../../../../ops/migrations/run.ts";
import { verifyLegacyBuild } from "./legacy-build.ts";
import type { LegacyBuild } from "./legacy-build.ts";

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const repoLocal = fileURLToPath(
  new URL("../../../../.local/", import.meta.url)
);

/** HTTP + request wire understood by the frozen pre-identity executable. */
export const legacyWire = {
  correctionsPath: "/api/d01/corrections",
  csvFormat: "d01.csv.v1",
  envelope: { purpose: "personal-records", schemaVersion: "d01.v1" },
  executePath: "/api/d01/execute",
} as const;

/**
 * Map a legacy request body to current worlds wire for post-transition
 * SemanticExecutor decode/replay. Does not dual-read in product code.
 */
export const asCurrentWire = (request: object): Record<string, unknown> => {
  const rewritten = JSON.stringify(request)
    .replaceAll('"schemaVersion":"d01.v1"', '"schemaVersion":"worlds.v1"')
    .replaceAll('"schemaVersion": "d01.v1"', '"schemaVersion": "worlds.v1"')
    .replaceAll(
      '\\"schemaVersion\\":\\"d01.v1\\"',
      '\\"schemaVersion\\":\\"worlds.v1\\"'
    )
    .replaceAll('"format":"d01.csv.v1"', '"format":"worlds.csv.v1"')
    .replaceAll('"format": "d01.csv.v1"', '"format": "worlds.csv.v1"')
    .replaceAll('"format":"d01.json.v1"', '"format":"worlds.json.v1"')
    .replaceAll('"format": "d01.json.v1"', '"format": "worlds.json.v1"')
    .replaceAll("\\nd01.csv.v1,", "\\nworlds.csv.v1,")
    .replaceAll("\\rd01.csv.v1,", "\\rworlds.csv.v1,");
  return Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(
    JSON.parse(rewritten)
  );
};

/** Map legacy zoen-d01 cookie names to current zoen-worlds (test harness only). */
export const asCurrentCredential = (credential: Redacted.Redacted) =>
  Redacted.make(
    Redacted.value(credential).replaceAll("zoen-d01.", "zoen-worlds.")
  );

/**
 * Pre-launch rename replaced zoen:d01 intent digests with zoen:worlds (no dual-hash).
 * Realign stored digests for a known legacy request so current idempotent replay works.
 */

export const realignIntentDigest = Effect.fn("basis.realignIntentDigest")(
  function* realignIntentDigest(
    principalId: string,
    request: object,
    worldRef?: { readonly realm: string; readonly worldId: string }
  ) {
    const wired = asCurrentWire(request);
    const { operation, operationId } = wired;
    if (typeof operationId !== "string" || typeof operation !== "string") {
      return yield* Effect.die(
        "realignIntentDigest requires operationId and operation"
      );
    }
    const decoded = yield* decodeSemanticRequest(wired).pipe(
      Effect.catchTag("SchemaError", (error) => Effect.die(error))
    );
    const digest = yield* intentDigest(decoded);
    const sql = yield* SqlClient.SqlClient;
    if (operation === "CreatePersonalWorld") {
      yield* sql`UPDATE authority.bootstrap_operations
        SET intent_digest = ${digest}
        WHERE principal_id = ${principalId}::uuid
          AND operation_id = ${operationId}::uuid`;
      return digest;
    }
    if (worldRef === undefined) {
      return yield* Effect.die(
        "realignIntentDigest requires worldRef for non-bootstrap ops"
      );
    }
    yield* sql`UPDATE authority.operations
      SET intent_digest = ${digest}
      WHERE world_id = ${worldRef.worldId}::uuid
        AND realm = ${worldRef.realm}
        AND principal_id = ${principalId}::uuid
        AND semantic_operation = ${operation}
        AND operation_id = ${operationId}::uuid`;
    return digest;
  }
);

const childHasExited = (child: ChildProcess) =>
  child.exitCode !== null || child.signalCode !== null;

const reservePort = Effect.sync(
  () => 45_000 + Math.floor(Math.random() * 10_000)
);

/** Resolve when the OS reports the child has exited (DB clients released). */
const awaitProcessExit = (child: ChildProcess) =>
  Effect.callback<null>((resume, abort) => {
    if (childHasExited(child)) {
      resume(Effect.succeed(null));
      return;
    }
    const onExit = () => {
      resume(Effect.succeed(null));
    };
    child.once("exit", onExit);
    abort.addEventListener(
      "abort",
      () => {
        child.off("exit", onExit);
      },
      { once: true }
    );
  });

/** Wait until the legacy child has fully exited (releases DB clients) before migrating. */
const awaitChildExit = (
  child: ChildProcess,
  signal: NodeJS.Signals,
  graceMs: number
) =>
  Effect.gen(function* waitForExit() {
    if (childHasExited(child)) {
      return;
    }
    yield* Effect.sync(() => {
      child.kill(signal);
    });
    yield* awaitProcessExit(child).pipe(
      Effect.timeout(`${graceMs} millis`),
      Effect.catchTag("TimeoutError", () => Effect.succeed(null))
    );
    if (childHasExited(child)) {
      return;
    }
    yield* Effect.sync(() => {
      child.kill("SIGKILL");
    });
    // Fail closed: never start migrations unless the OS observed exit.
    // Bound wait after SIGKILL; still fail closed — never migrate while locks may remain.
    yield* awaitProcessExit(child).pipe(
      Effect.timeout("10 seconds"),
      Effect.catchTag("TimeoutError", () =>
        Effect.die(
          new Error(
            `Legacy child did not exit after SIGKILL pid=${String(child.pid)}`
          )
        )
      )
    );
  });

export const http = Effect.fn("basis.http")(function* send(
  origin: string,
  routePath: string,
  body?: string,
  credential?: Redacted.Redacted
) {
  const base = HttpClientRequest.make(body === undefined ? "GET" : "POST")(
    `${origin}${routePath}`
  ).pipe(
    HttpClientRequest.setHeaders({
      ...(credential === undefined
        ? {}
        : { cookie: Redacted.value(credential) }),
      origin,
    })
  );
  return yield* (
    body === undefined
      ? base
      : HttpClientRequest.bodyText(base, body, "application/json")
  ).pipe(
    HttpClient.execute,
    // Legacy emission handlers can leave the socket open if the child is wedged;
    // stay below the 30s integration testTimeout so this die runs first.
    Effect.timeout("20 seconds"),
    Effect.catchTag("TimeoutError", () =>
      Effect.die(
        new Error(`Legacy HTTP timed out ${routePath} origin=${origin}`)
      )
    )
  );
});

export const jsonBody = (response: HttpClientResponse.HttpClientResponse) =>
  response.json;

export const responseCookie = (
  response: HttpClientResponse.HttpClientResponse
) => Redacted.make(Cookies.toCookieHeader(response.cookies));

export interface CurrentComponent {
  readonly identity: ReturnType<typeof makeTestIdentityLayer>;
  readonly runtime: Layer.Layer<IdentityAuth | SemanticExecutor, unknown>;
}

export interface BasisHarness {
  readonly database: WorldsTestDatabase;
  readonly installation: typeof AuthorityInstallationSchema.Type;
  readonly legacy: LegacyBuild;
  readonly origin: string;
  readonly policy: DataPolicySchema;
  readonly secret: Redacted.Redacted;
  readonly storage: Parameters<typeof s3EvidenceLayer>[0];
  readonly transitionToCurrentComponent: () => Effect.Effect<
    CurrentComponent,
    unknown
  >;
}

export const withLegacyBasisHarness = <A, E, R>(
  run: (harness: BasisHarness) => Effect.Effect<A, E, R>
) =>
  withWorldsDatabase(
    (database) =>
      withStorage(({ client, config: storage }) =>
        Effect.gen(function* basisHarness() {
          const fs = yield* FileSystem.FileSystem;
          const legacy = yield* Effect.tryPromise(() => verifyLegacyBuild());
          yield* sdk((signal) =>
            client.send(
              new PutBucketVersioningCommand({
                Bucket: storage.bucket,
                VersioningConfiguration: { Status: "Enabled" },
              }),
              { abortSignal: signal }
            )
          );
          const policy = yield* Schema.decodeEffect(DataPolicySchema)({
            dataScope: "admitted-non-sensitive",
            enabledRealm: "live",
            erasure: false,
            legalHold: false,
            licensedExpiry: false,
            profileId: "worlds-local-retained-v1",
            restoreAfterErasure: false,
            retention: "while-pinned",
          });
          // Frozen baseline (legacy-build revision) only admits d01-local-retained-v1.
          // Write that literal into the installation file the legacy process reads;
          // current-component policy after transition stays worlds-local-retained-v1.
          const legacyInstallationPolicy = {
            ...policy,
            profileId: "d01-local-retained-v1" as const,
          };
          const installation = yield* Schema.decodeEffect(
            AuthorityInstallationSchema
          )({
            cellEpoch: "1",
            cellId: randomUUID(),
            generationId: randomUUID(),
            releaseDigest: legacy.releaseDigest,
          });
          const secret = Redacted.make(randomBytes(32).toString("hex"));
          const port = yield* reservePort;
          const origin = `http://127.0.0.1:${port}`;
          const directory = path.join(
            repoLocal,
            `basis-compat-${randomBytes(6).toString("hex")}`
          );
          yield* fs.makeDirectory(directory, { mode: 0o700, recursive: true });
          const installationPath = path.join(directory, "installation.json");
          yield* fs.writeFileString(
            installationPath,
            encodeJson({ installation, policy: legacyInstallationPolicy }),
            { flag: "wx", mode: 0o600 }
          );
          const mainJs = path.join(legacy.root, "apps/server/dist/main.js");
          const logs: string[] = [];
          const child = yield* Effect.acquireRelease(
            Effect.sync(() => {
              const processChild = spawn(process.execPath, [mainJs], {
                cwd: legacy.root,
                env: {
                  ...process.env,
                  ZOEN_AUTHORITY_DATABASE_URL: Redacted.value(
                    database.urls.authority
                  ),
                  ZOEN_AUTH_SECRET: Redacted.value(secret),
                  ZOEN_IDENTITY_DATABASE_URL: Redacted.value(
                    database.urls.identity
                  ),
                  ZOEN_INSTALLATION_FILE: installationPath,
                  ZOEN_LISTEN_HOST: "127.0.0.1",
                  ZOEN_PORT: String(port),
                  ZOEN_PUBLIC_URL: origin,
                  ZOEN_S3_ACCESS_KEY: Redacted.value(
                    storage.credentials.accessKeyId
                  ),
                  ZOEN_S3_BUCKET: storage.bucket,
                  ZOEN_S3_ENDPOINT: storage.endpoint.href,
                  ZOEN_S3_REGION: storage.region,
                  ZOEN_S3_SECRET_KEY: Redacted.value(
                    storage.credentials.secretAccessKey
                  ),
                },
                stdio: ["ignore", "pipe", "pipe"],
              });
              processChild.stdout?.on("data", (chunk: Buffer) => {
                logs.push(chunk.toString("utf-8"));
              });
              processChild.stderr?.on("data", (chunk: Buffer) => {
                logs.push(chunk.toString("utf-8"));
              });
              return processChild;
            }),
            (processChild) =>
              Effect.sync(() => {
                try {
                  processChild.kill("SIGKILL");
                } catch {
                  // already exited
                }
              })
          );
          yield* Effect.gen(function* awaitReady() {
            let ready = false;
            for (let attempt = 0; attempt < 120 && !ready; attempt += 1) {
              if (child.exitCode !== null) {
                return yield* Effect.die(
                  new Error(
                    `Legacy server exited before ready code=${String(child.exitCode)} logs=${logs.join("")}`
                  )
                );
              }
              ready = yield* Effect.tryPromise(() =>
                fetch(`${origin}/ready`, {
                  signal: AbortSignal.timeout(1000),
                }).then((response) => response.status === 200)
              ).pipe(Effect.orElseSucceed(() => false));
              if (!ready) {
                yield* Effect.sleep("250 millis");
              }
            }
            if (!ready) {
              return yield* Effect.die(
                new Error(`Legacy server ready timeout logs=${logs.join("")}`)
              );
            }
            return ready;
          });
          let transitioned = false;
          const transitionToCurrentComponent = () =>
            Effect.gen(function* applyTransition() {
              if (transitioned) {
                return yield* Effect.die("Basis transition already applied");
              }
              transitioned = true;
              // Must observe exit before migrations: resolving after SIGKILL without
              // waiting left PG sessions alive and blocked 007/011 under CI load.
              yield* awaitChildExit(child, "SIGTERM", 2000);
              yield* applyIdentityBasisMigrations(database.names).pipe(
                Effect.provide(
                  Layer.mergeAll(database.migration, NodeServices.layer)
                )
              );
              // 011 stays on erasure migrator IDs for production; basis tests apply it here
              // so legacy d01.* rows/policy ids are rewritten before current component runs.
              yield* Effect.gen(function* applyRenameAlignment() {
                const filesystem = yield* FileSystem.FileSystem;
                const sql = yield* SqlClient.SqlClient;
                const rename = yield* filesystem.readFileString(
                  fileURLToPath(
                    new URL(
                      "../../../../ops/migrations/011_worlds_rename_alignment.sql",
                      import.meta.url
                    )
                  )
                );
                yield* sql.withTransaction(sql.unsafe(rename));
              }).pipe(
                Effect.provide(
                  Layer.mergeAll(database.migration, NodeServices.layer)
                )
              );
              const identity = makeTestIdentityLayer(
                {
                  baseUrl: origin,
                  databaseUrl: database.urls.identity,
                  secret,
                  sessionSeconds: 3600,
                },
                database
              );
              const runtime = Layer.provideMerge(
                SemanticExecutor.layer,
                Layer.mergeAll(
                  Layer.succeed(AuthorityInstallation, installation),
                  Layer.succeed(DataPolicy, policy),
                  ErasureAttemptRegister.unqualifiedLayer,
                  database.authority,
                  identity,
                  s3EvidenceLayer(storage)
                )
              );
              return { identity, runtime };
            });
          return yield* run({
            database,
            installation,
            legacy,
            origin,
            policy,
            secret,
            storage,
            transitionToCurrentComponent,
          });
        }).pipe(
          Effect.provide(
            Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)
          )
        )
      ),
    undefined,
    (database) =>
      Effect.gen(function* installLegacyCompatibleSchema() {
        yield* applyDisclosureMigrations(database.names);
        // Fresh 004 is worlds-only; frozen legacy executable still inserts d01.*.
        // Keep d01 CHECK until applyIdentityBasisMigrations runs 011 on transition.
        const sql = yield* SqlClient.SqlClient;
        yield* sql.unsafe(`
ALTER TABLE jobs.captures
  DROP CONSTRAINT IF EXISTS captures_document_format_check;
ALTER TABLE jobs.captures
  ALTER COLUMN document_format SET DEFAULT 'd01.json.v1';
ALTER TABLE jobs.captures
  ADD CONSTRAINT captures_document_format_check
    CHECK (document_format IN ('d01.json.v1', 'd01.csv.v1'));
`);
      }).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );
