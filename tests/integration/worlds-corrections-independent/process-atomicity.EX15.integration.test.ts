import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/worlds/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import {
  EvidenceImported,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
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

import { withStorage } from "../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withIdentityDatabase } from "../../../apps/server/test/identity/worlds/database.ts";
import { createAccount } from "../../../apps/server/test/identity/worlds/http.ts";
import { configuration } from "../worlds/commit/fixture.ts";
import { makeProcessConfiguration } from "./process-configuration.ts";

const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("8 seconds")
  );

it.live(
  "EX15 SIGKILL before SQL commit rolls back state/receipt/outbox; lost acknowledgement after commit replays once through a restarted real executor",
  () =>
    withIdentityDatabase((fixture) =>
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
            const document = yield* canonicalJson({
              records: [
                {
                  externalId: "process-record",
                  predicate: "obligation.amount",
                  subjectKey: "process-obligation",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                  value: { _tag: "Known", amount: "123", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "process-source",
                label: "Process source",
                namespace: "review",
                revision: "1",
              },
            });
            const operationId = randomUUID();
            const request = yield* canonicalJson({
              ...envelope,
              input: { document },
              operation: "ImportEvidence",
              operationId,
              worldRef: created.worldRef,
            });
            const directory = yield* fs.makeTempDirectoryScoped({
              prefix: "zoen-ex15-process-",
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
                      new URL("executor-process.ts", import.meta.url)
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
      (SELECT count(*)::int FROM authority.claims) AS claims,
      (SELECT count(*)::int FROM authority.evidence) AS evidence,
      (SELECT count(*)::int FROM authority.pins) AS pins,
      (SELECT count(*)::int FROM authority.sources) AS sources,
      (SELECT count(*)::int FROM authority.operations WHERE semantic_operation = 'ImportEvidence') AS operations,
      (SELECT count(*)::int FROM authority.receipts WHERE operation = 'ImportEvidence') AS receipts,
      (SELECT count(*)::int FROM jobs.outbox o JOIN authority.receipts r USING (world_id, realm, receipt_id) WHERE r.operation = 'ImportEvidence') AS outbox,
      (SELECT jsonb_object_agg(domain_key, version::text) FROM authority.domains WHERE domain_key IN ('claims', 'evidence', 'sources')) AS revisions`;
            const baseline = yield* snapshot;
            expect(baseline).toStrictEqual([
              {
                claims: 0,
                evidence: 0,
                operations: 0,
                outbox: 0,
                pins: 0,
                receipts: 0,
                revisions: { claims: "0", evidence: "0", sources: "0" },
                sources: 0,
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
            expect(
              yield* sql`SELECT state, count(*)::int AS count FROM jobs.captures GROUP BY state`
            ).toStrictEqual([{ count: 1, state: "uploaded" }]);
            const afterCommit = yield* spawn(true);
            yield* waitUntil(fs.exists(`${file}.committed`));
            expect(yield* fs.exists(`${file}.ack`)).toBeFalsy();
            const committed = yield* snapshot;
            expect(committed).toStrictEqual([
              {
                claims: 1,
                evidence: 1,
                operations: 1,
                outbox: 1,
                pins: 1,
                receipts: 1,
                revisions: { claims: "1", evidence: "1", sources: "1" },
                sources: 1,
              },
            ]);
            const [receipt] =
              yield* sql`SELECT r.result FROM authority.receipts r JOIN authority.operations o USING (world_id, realm, receipt_id) WHERE o.operation_id = ${operationId}`;
            const stored = yield* Schema.decodeUnknownEffect(EvidenceImported)(
              receipt?.result
            );
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
                  Schema.decodeEffect(Schema.fromJsonString(EvidenceImported))
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
