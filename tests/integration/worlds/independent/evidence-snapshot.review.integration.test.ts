import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import {
  ImportEvidence,
  Inspect,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { readCut } from "../../../../packages/ontology/src/commit/guards.js";
import { importEvidence } from "../../../../packages/ontology/src/evidence/worlds/import.js";
import { inspect } from "../../../../packages/ontology/src/knowledge/worlds/inspect.js";
import { canonicalJson } from "../../../../packages/ontology/src/values/canonical.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "independent EX08 concurrent dedup stays atomic and a blocked frame retains its original snapshot and pins",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.scoped(
          Effect.gen(function* snapshotReview() {
            const { context, request } = yield* makeInput();
            const { worldRef } = yield* createPersonalWorld(context, request);
            const document = yield* canonicalJson({
              records: [
                {
                  externalId: "record",
                  predicate: "obligation.amount",
                  subjectKey: "review-obligation",
                  validTime: { _tag: "Unknown" },
                  value: { _tag: "Known", amount: "100", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "review-source",
                label: "Original",
                namespace: "review",
                revision: "1",
              },
            });
            const input = yield* Schema.decodeEffect(ImportEvidence)({
              ...request,
              input: { document },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            });
            const duplicate = yield* Schema.decodeEffect(ImportEvidence)({
              ...input,
              operationId: randomUUID(),
            });
            const results = yield* Effect.all(
              [
                importEvidence(context, input),
                importEvidence(context, duplicate),
              ],
              { concurrency: 2 }
            );
            const sql = yield* SqlClient.SqlClient;
            expect({
              cut: yield* readCut(worldRef),
              distinctReceipts: results[0].receiptRef !== results[1].receiptRef,
              persisted:
                yield* sql`SELECT (SELECT count(*)::int FROM authority.evidence) AS evidence, (SELECT count(*)::int FROM authority.claims) AS claims, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM authority.pins) AS pins`,
              sameEvidence: results[0].evidenceRef === results[1].evidenceRef,
            }).toMatchObject({
              cut: { claims: "1", evidence: "1", sources: "1" },
              distinctReceipts: true,
              persisted: [{ claims: 1, evidence: 1, pins: 1, receipts: 3 }],
              sameEvidence: true,
            });
            const query = yield* Schema.decodeEffect(Inspect)({
              input: { atFrame: null, subjectKey: "review-obligation" },
              operation: "Inspect",
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef,
            });
            const held = yield* Deferred.make<null>();
            const release = yield* Deferred.make<null>();
            const holder = yield* Effect.forkScoped(
              Effect.gen(function* lockFrameInsert() {
                const migration = yield* SqlClient.SqlClient;
                yield* migration.withTransaction(
                  Effect.gen(function* frameTableLock() {
                    yield* migration`LOCK TABLE authority.frames IN SHARE MODE`;
                    yield* Deferred.succeed(held, null);
                    yield* Deferred.await(release);
                  })
                );
              }).pipe(Effect.provide(database.migration))
            );
            yield* Deferred.await(held);
            const pending = yield* Effect.forkScoped(inspect(context, query));
            let waiting = false;
            for (let attempt = 0; attempt < 80 && !waiting; attempt += 1) {
              const rows =
                yield* sql`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation = 'authority.frames'::regclass AND NOT granted) AS waiting`;
              waiting = rows[0]?.waiting === true;
              if (!waiting) {
                yield* Effect.sleep("25 millis");
              }
            }
            expect(waiting).toBeTruthy();
            const newer = yield* Schema.decodeEffect(ImportEvidence)({
              ...input,
              input: {
                document: document
                  .replace('"revision":"1"', '"revision":"2"')
                  .replace('"100"', '"200"'),
              },
              operationId: randomUUID(),
            });
            yield* importEvidence(context, newer);
            yield* Deferred.succeed(release, null);
            yield* Fiber.join(holder);
            const frozen = yield* Fiber.join(pending);
            expect({
              basis:
                yield* sql`SELECT internal_basis->'cut'->>'claims' AS claims, (SELECT count(*)::int FROM authority.pins WHERE owner_kind = 'frame' AND owner_id = ${frozen.frame.frameRef}) AS pins FROM authority.frames WHERE frame_id = ${frozen.frame.frameRef}`,
              revisions: frozen.frame.claims.map(
                (claim) => claim.source.revision
              ),
            }).toStrictEqual({
              basis: [{ claims: "1", pins: 1 }],
              revisions: ["1"],
            });
            const current = yield* inspect(context, query);
            expect(
              current.frame.claims.map((claim) => claim.source.revision)
            ).toStrictEqual(["1", "2"]);
            expect(
              yield* inspect(context, {
                ...query,
                input: { ...query.input, atFrame: frozen.frame.frameRef },
              })
            ).toStrictEqual(frozen);
          })
        ).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
