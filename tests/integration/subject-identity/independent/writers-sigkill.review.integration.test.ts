import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
} from "@zoen/contracts/subject-identity/operations";
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

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withIdentityDatabase } from "../../../../apps/server/test/identity/database.js";
import { createAccount } from "../../../../apps/server/test/identity/http.js";
import { makeProcessConfiguration } from "../../worlds-corrections-independent/process-configuration.ts";
import { configuration } from "../../worlds/commit/fixture.js";

const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("8 seconds")
  );

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

const worldsBasis = {
  purpose: "personal-records" as const,
  schemaVersion: "worlds.v1" as const,
};
const envelope = {
  purpose: "personal-records" as const,
  schemaVersion: "subject-identity.v1" as const,
};

const documentFor = (subjects: readonly { key: string; amount: string }[]) =>
  canonicalJson({
    records: subjects.map((subject) => ({
      externalId: `row-${subject.key}`,
      predicate: "obligation.amount",
      subjectKey: subject.key,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: subject.amount, currency: "BRL" },
    })),
    schemaVersion: "worlds.v1",
    source: {
      externalId: "billing-sigkill",
      label: "Billing SIGKILL",
      namespace: "subject-identity-writers",
      revision: "1",
    },
  });

/** ID-08: real SIGKILL on ResolveIdentity — no partial decision/receipt/outbox/domain. */
it.live(
  "independent: ResolveIdentity SIGKILL before commit rolls back; lost ack after commit replays once",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage((storage) =>
        Effect.scoped(
          Effect.gen(function* identityWriterAtomicity() {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
            const sql = yield* SqlClient.SqlClient;
            const executor = yield* SemanticExecutor;
            const installation = yield* AuthorityInstallation;
            const policy = yield* DataPolicy;
            const account = yield* createAccount(fixture.config.baseUrl);
            const created = yield* executor
              .execute(
                account.credential,
                yield* bytes({
                  ...worldsBasis,
                  input: {},
                  operation: "CreatePersonalWorld",
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
            const { worldRef } = created;
            yield* executor.execute(
              account.credential,
              yield* bytes({
                ...worldsBasis,
                input: {
                  document: yield* documentFor([
                    { amount: "100", key: "A" },
                    { amount: "120", key: "B" },
                  ]),
                },
                operation: "ImportEvidence",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const inspected = yield* executor
              .executeSubjectIdentity(
                account.credential,
                yield* bytes({
                  ...envelope,
                  input: {
                    anchors: ["A", "B"],
                    atFrame: null,
                    interval: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                  },
                  operation: "InspectSubjectIdentity",
                  worldRef,
                })
              )
              .pipe(
                Effect.flatMap(
                  Schema.decodeUnknownEffect(SubjectIdentityInspected)
                )
              );
            const proposed = yield* executor
              .executeSubjectIdentity(
                account.credential,
                yield* bytes({
                  ...envelope,
                  input: {
                    frame: {
                      frameRef: inspected.frame.frameRef,
                      kind: "subject-identity",
                    },
                    left: "A",
                    right: "B",
                  },
                  operation: "ProposeIdentityResolution",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
              .pipe(
                Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed))
              );

            const operationId = randomUUID();
            const request = yield* canonicalJson({
              ...envelope,
              input: {
                answer: "same-as",
                consequenceDigest: proposed.question.consequenceDigest,
                questionRef: proposed.question.questionRef,
              },
              operation: "ResolveIdentity",
              operationId,
              worldRef,
            });
            const directory = yield* fs.makeTempDirectoryScoped({
              prefix: "zoen-id08-resolve-",
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
              family: "subject-identity",
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
              (SELECT count(*)::int FROM authority.identity_decisions WHERE world_id = ${worldRef.worldId}::uuid) AS decisions,
              (SELECT count(*)::int FROM authority.operations WHERE operation_id = ${operationId}) AS operations,
              (SELECT count(*)::int FROM authority.receipts r JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}) AS receipts,
              (SELECT count(*)::int FROM jobs.outbox b JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}) AS outbox,
              (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'identity') AS identity,
              (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${proposed.question.caseRef}::uuid) AS case_state`;
            const baseline = yield* snapshot;
            expect(baseline).toStrictEqual([
              {
                case_state: "proposed",
                decisions: 0,
                identity: "0",
                operations: 0,
                outbox: 0,
                receipts: 0,
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
                case_state: "applied",
                decisions: 1,
                identity: "1",
                operations: 1,
                outbox: 1,
                receipts: 1,
              },
            ]);
            const [receipt] =
              yield* sql`SELECT r.result FROM authority.receipts r JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}`;
            const stored = yield* Schema.decodeUnknownEffect(IdentityResolved)(
              receipt?.result
            );
            expect(stored.outcome).toBe("applied");
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
                  Schema.decodeEffect(Schema.fromJsonString(IdentityResolved))
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
