import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { SharingMutationSuccess } from "@zoen/contracts/sharing/operations";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/ontology/commit/configuration";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/ontology/ports/worlds/context";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { canonicalJson } from "@zoen/ontology/values/canonical";
import {
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Path,
  Redacted,
  Schema,
  Schedule,
} from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { createAccount } from "../../../../apps/server/test/identity/worlds/http.ts";
import { makeProcessConfiguration } from "../../worlds-corrections-independent/process-configuration.ts";
import { configuration } from "../../worlds/commit/fixture.ts";
import { withSharingDatabase } from "./fixture.ts";

const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("8 seconds")
  );

it.live.each(["GrantWorldReadAccess", "RevokeWorldReadAccess"] as const)(
  "SH-09 %s survives SIGKILL before commit and replays a lost acknowledgement without partial membership, revision, receipt or outbox",
  (operation) =>
    withSharingDatabase((fixture) =>
      withStorage((storage) =>
        Effect.scoped(
          Effect.gen(function* processAtomicity() {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
            const sql = yield* SqlClient.SqlClient;
            const executor = yield* SemanticExecutor;
            const installation = yield* AuthorityInstallation;
            const policy = yield* DataPolicy;
            const account = yield* createAccount(fixture.config.baseUrl);
            const recipient = yield* createAccount(fixture.config.baseUrl);
            const envelope = {
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            };
            const created = yield* executor
              .execute(
                account.credential,
                new TextEncoder().encode(
                  yield* canonicalJson({
                    ...envelope,
                    input: {},
                    operation: "CreatePersonalWorld",
                    operationId: randomUUID(),
                  })
                )
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
            const sharingEnvelope = {
              purpose: "personal-records",
              schemaVersion: "sharing.v1",
              worldRef: created.worldRef,
            };
            if (operation === "RevokeWorldReadAccess") {
              yield* executor.executeSharing(
                account.credential,
                new TextEncoder().encode(
                  yield* canonicalJson({
                    ...sharingEnvelope,
                    input: {
                      expectedRevision: null,
                      principalRef: recipient.user.id,
                    },
                    operation: "GrantWorldReadAccess",
                    operationId: randomUUID(),
                  })
                )
              );
            }
            const operationId = randomUUID();
            const request = yield* canonicalJson({
              ...sharingEnvelope,
              input: {
                expectedRevision:
                  operation === "GrantWorldReadAccess" ? null : "0",
                principalRef: recipient.user.id,
              },
              operation,
              operationId,
            });
            const directory = yield* fs.makeTempDirectoryScoped({
              prefix: "zoen-sh09-process-",
            });
            const file = path.join(directory, "input.json");
            const encoded = yield* Schema.encodeEffect(
              Schema.fromJsonString(
                makeProcessConfiguration(
                  AuthorityInstallationSchema,
                  DataPolicySchema
                )
              )
            )({
              authorityUrl: Redacted.value(fixture.database.urls.authority),
              credential: Redacted.value(account.credential),
              family: "sharing",
              identity: {
                ...fixture.config,
                databaseUrl: Redacted.value(fixture.config.databaseUrl),
                secret: Redacted.value(fixture.config.secret),
              },
              installation,
              policy,
              request,
              storage: {
                accessKeyId: Redacted.value(
                  storage.config.credentials.accessKeyId
                ),
                bucket: storage.config.bucket,
                endpoint: storage.config.endpoint.href,
                secretAccessKey: Redacted.value(
                  storage.config.credentials.secretAccessKey
                ),
              },
            });
            yield* fs.writeFileString(file, encoded, { mode: 0o600 });
            const spawn = (hold: boolean) =>
              spawner.spawn(
                ChildProcess.make(
                  process.execPath,
                  [
                    fileURLToPath(
                      new URL(
                        "../../worlds-corrections-independent/executor-process.ts",
                        import.meta.url
                      )
                    ),
                  ],
                  {
                    env: {
                      ZOEN_REVIEW_CONFIG: file,
                      ZOEN_REVIEW_HOLD_ACK: String(hold),
                    },
                    forceKillAfter: "500 millis",
                  }
                )
              );
            const snapshot = sql`SELECT
              (SELECT jsonb_build_object('state', state, 'revision', revision::text, 'role', role) FROM authority.memberships WHERE principal_id = ${recipient.user.id}) AS target,
              (SELECT jsonb_build_object('state', state, 'revision', revision::text, 'role', role) FROM authority.memberships WHERE principal_id = ${account.user.id}) AS owner,
              (SELECT version::text FROM authority.domains WHERE domain_key = 'membership') AS membership_revision,
              (SELECT count(*)::int FROM authority.operations WHERE operation_id = ${operationId}) AS operations,
              (SELECT count(*)::int FROM authority.receipts r JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}) AS receipts,
              (SELECT count(*)::int FROM jobs.outbox b JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}) AS outbox`;
            const baseline = yield* snapshot;
            expect(baseline).toStrictEqual([
              {
                membership_revision:
                  operation === "GrantWorldReadAccess" ? "0" : "1",
                operations: 0,
                outbox: 0,
                owner: { revision: "0", role: "owner", state: "active" },
                receipts: 0,
                target:
                  operation === "GrantWorldReadAccess"
                    ? null
                    : { revision: "0", role: "viewer", state: "active" },
              },
            ]);
            const locked = yield* Deferred.make<boolean>();
            const release = yield* Deferred.make<boolean>();
            const barrier = yield* SqlClient.SqlClient.use((migration) =>
              migration.withTransaction(
                Effect.gen(function* holdOutboxInsert() {
                  yield* migration`LOCK TABLE jobs.outbox IN SHARE MODE`;
                  yield* Deferred.succeed(locked, true);
                  yield* Deferred.await(release);
                })
              )
            ).pipe(
              Effect.provide(fixture.database.migration),
              Effect.forkScoped
            );
            yield* Deferred.await(locked);
            const beforeCommit = yield* spawn(false);
            const blocked = SqlClient.SqlClient.use(
              (migration) =>
                migration`SELECT count(*)::int AS waiting FROM pg_locks WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND relation = 'jobs.outbox'::regclass AND mode = 'RowExclusiveLock' AND NOT granted`
            ).pipe(Effect.provide(fixture.database.migration));
            yield* waitUntil(
              blocked.pipe(Effect.map((rows) => rows[0]?.waiting === 1))
            );
            expect(yield* snapshot).toStrictEqual(baseline);
            expect(yield* fs.exists(`${file}.ack`)).toBeFalsy();
            yield* beforeCommit.kill({ killSignal: "SIGKILL" });
            expect(
              yield* beforeCommit.exitCode.pipe(Effect.flip)
            ).toMatchObject({
              reason: {
                cause: {
                  message:
                    "Process interrupted due to receipt of signal: 'SIGKILL'",
                },
              },
            });
            yield* Deferred.succeed(release, true);
            yield* Fiber.join(barrier);
            yield* waitUntil(
              blocked.pipe(Effect.map((rows) => rows[0]?.waiting === 0))
            );
            expect(yield* snapshot).toStrictEqual(baseline);
            const afterCommit = yield* spawn(true);
            yield* waitUntil(fs.exists(`${file}.committed`));
            expect(yield* fs.exists(`${file}.ack`)).toBeFalsy();
            const committed = yield* snapshot;
            expect(committed).toStrictEqual([
              {
                membership_revision:
                  operation === "GrantWorldReadAccess" ? "1" : "2",
                operations: 1,
                outbox: 1,
                owner: { revision: "0", role: "owner", state: "active" },
                receipts: 1,
                target: {
                  revision: operation === "GrantWorldReadAccess" ? "0" : "1",
                  role: "viewer",
                  state:
                    operation === "GrantWorldReadAccess" ? "active" : "revoked",
                },
              },
            ]);
            const [receipt] =
              yield* sql`SELECT r.result FROM authority.receipts r JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}`;
            const stored = yield* Schema.decodeUnknownEffect(
              SharingMutationSuccess
            )(receipt?.result);
            yield* afterCommit.kill({ killSignal: "SIGKILL" });
            expect(yield* afterCommit.exitCode.pipe(Effect.flip)).toMatchObject(
              {
                reason: {
                  cause: {
                    message:
                      "Process interrupted due to receipt of signal: 'SIGKILL'",
                  },
                },
              }
            );
            const replay = yield* spawn(false);
            expect(
              yield* replay.exitCode.pipe(Effect.timeout("8 seconds"))
            ).toBe(0);
            const acknowledged = yield* fs
              .readFileString(`${file}.ack`)
              .pipe(
                Effect.flatMap(
                  Schema.decodeEffect(
                    Schema.fromJsonString(SharingMutationSuccess)
                  )
                )
              );
            expect(acknowledged).toStrictEqual(stored);
            expect(yield* snapshot).toStrictEqual(committed);
            expect(yield* fs.readFileString(file)).toBe(encoded);
          })
        ).pipe(
          Effect.provide(
            Layer.provideMerge(
              SemanticExecutor.layer,
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime,
                NodeServices.layer
              )
            )
          )
        )
      )
    )
);
