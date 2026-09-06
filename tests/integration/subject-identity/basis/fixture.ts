/* oxlint-disable effecttsgo/node-builtin-import */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/d01/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import {
  Cookies,
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import type { HttpClientResponse } from "effect/unstable/http";

import { layer as s3EvidenceLayer } from "../../../../apps/server/src/adapters/object-storage/d01/s3.ts";
import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/d01/fixture.ts";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.ts";
import type { D01TestDatabase } from "../../../../apps/server/test/adapters/postgres/d01/database.ts";
import { makeTestIdentityLayer } from "../../../../apps/server/test/identity/d01/database.ts";
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
const reservePort = Effect.sync(
  () => 45_000 + Math.floor(Math.random() * 10_000)
);

export const http = Effect.fn("basis.http")(function* send(
  origin: string,
  path: string,
  body?: string,
  credential?: Redacted.Redacted
) {
  const base = HttpClientRequest.make(body === undefined ? "GET" : "POST")(
    `${origin}${path}`
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
  ).pipe(HttpClient.execute);
});

export const jsonBody = (response: HttpClientResponse.HttpClientResponse) =>
  response.json;

export const responseCookie = (
  response: HttpClientResponse.HttpClientResponse
) => Redacted.make(Cookies.toCookieHeader(response.cookies));

export interface CurrentComponent {
  readonly identity: ReturnType<typeof makeTestIdentityLayer>;
  readonly runtime: Layer.Layer<SemanticExecutor>;
}

export interface BasisHarness {
  readonly database: D01TestDatabase;
  readonly installation: typeof AuthorityInstallationSchema.Type;
  readonly legacy: LegacyBuild;
  readonly origin: string;
  readonly policy: DataPolicySchema;
  readonly secret: Redacted.Redacted;
  readonly storage: Parameters<typeof s3EvidenceLayer>[0];
  readonly transitionToCurrentComponent: () => Effect.Effect<CurrentComponent>;
}

export const withLegacyBasisHarness = <A, E, R>(
  run: (harness: BasisHarness) => Effect.Effect<A, E, R>
) =>
  withD01Database(
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
            profileId: "d01-local-retained-v1",
            restoreAfterErasure: false,
            retention: "while-pinned",
          });
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
          const directory = join(
            repoLocal,
            `basis-compat-${randomBytes(6).toString("hex")}`
          );
          yield* fs.makeDirectory(directory, { mode: 0o700, recursive: true });
          const installationPath = join(directory, "installation.json");
          yield* fs.writeFileString(
            installationPath,
            encodeJson({ installation, policy }),
            { flag: "wx", mode: 0o600 }
          );
          const mainJs = join(legacy.root, "apps/server/dist/main.js");
          const logs: string[] = [];
          const child = yield* Effect.acquireRelease(
            Effect.sync(() => {
              const processChild = spawn(process.execPath, [mainJs], {
                cwd: legacy.root,
                env: {
                  ...process.env,
                  ZOEN_AUTH_SECRET: Redacted.value(secret),
                  ZOEN_AUTHORITY_DATABASE_URL: Redacted.value(
                    database.urls.authority
                  ),
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
                logs.push(chunk.toString("utf8"));
              });
              processChild.stderr?.on("data", (chunk: Buffer) => {
                logs.push(chunk.toString("utf8"));
              });
              return processChild;
            }),
            (processChild) =>
              Effect.sync(() => {
                if (!processChild.killed) {
                  processChild.kill("SIGKILL");
                }
              })
          );
          yield* Effect.gen(function* awaitReady() {
            for (let attempt = 0; attempt < 120; attempt += 1) {
              if (child.exitCode !== null) {
                return yield* Effect.die(
                  new Error(
                    `Legacy server exited before ready code=${String(child.exitCode)} logs=${logs.join("")}`
                  )
                );
              }
              const ok = yield* Effect.tryPromise(() =>
                fetch(`${origin}/ready`).then(
                  (response) => response.status === 200
                )
              ).pipe(Effect.orElseSucceed(() => false));
              if (ok) {
                return;
              }
              yield* Effect.sleep("250 millis");
            }
            return yield* Effect.die(
              new Error(`Legacy server ready timeout logs=${logs.join("")}`)
            );
          });
          let transitioned = false;
          const transitionToCurrentComponent = () =>
            Effect.gen(function* applyTransition() {
              if (transitioned) {
                return yield* Effect.die("Basis transition already applied");
              }
              transitioned = true;
              if (!child.killed) {
                child.kill("SIGTERM");
              }
              yield* Effect.tryPromise(
                () =>
                  new Promise<void>((resolve) => {
                    if (child.exitCode !== null) {
                      resolve();
                      return;
                    }
                    child.once("exit", () => resolve());
                    setTimeout(() => {
                      child.kill("SIGKILL");
                      resolve();
                    }, 2000);
                  })
              );
              yield* applyIdentityBasisMigrations(database.names).pipe(
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
      applyDisclosureMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );
