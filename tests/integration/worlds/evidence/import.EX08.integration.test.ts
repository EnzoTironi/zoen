import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { ImportEvidence } from "../../../../packages/contracts/src/worlds/operations.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { readCut } from "../../../../packages/ontology/src/commit/guards.js";
import { bindWorldIntent } from "../../../../packages/ontology/src/commit/intent.js";
import { commitMutation } from "../../../../packages/ontology/src/commit/mutation.js";
import { importEvidence } from "../../../../packages/ontology/src/evidence/worlds/import.js";
import { canonicalJson } from "../../../../packages/ontology/src/values/canonical.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX08 real import preserves one revision, rejects changed intent and leaves unchanged knowledge counters on dedup",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* importAndDedup() {
          const { context, request } = yield* makeInput();
          const created = yield* createPersonalWorld(context, request);
          const document = yield* canonicalJson({
            records: [
              {
                externalId: "invoice-1",
                predicate: "obligation.amount",
                subjectKey: "invoice-1",
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-01",
                  to: "2026-10-01",
                },
                value: { _tag: "Known", amount: "100.00", currency: "BRL" },
              },
            ],
            schemaVersion: "worlds.v1",
            source: {
              externalId: "billing",
              label: "Original label",
              namespace: "test",
              revision: "1",
            },
          });
          const input = yield* Schema.decodeEffect(ImportEvidence)({
            input: { document },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef: created.worldRef,
          });
          const first = yield* importEvidence(context, input);
          const cut = yield* readCut(created.worldRef);
          const duplicate = yield* importEvidence(context, {
            ...input,
            operationId: yield* Schema.decodeEffect(
              ImportEvidence.fields.operationId
            )(randomUUID()),
          });
          expect(duplicate.evidenceRef).toBe(first.evidenceRef);
          expect(duplicate.receiptRef).not.toBe(first.receiptRef);
          expect(yield* readCut(created.worldRef)).toStrictEqual(cut);
          expect(yield* importEvidence(context, input)).toStrictEqual(first);
          const conflict = yield* importEvidence(context, {
            ...input,
            input: { document: document.replace("100.00", "200.00") },
          }).pipe(Effect.flip);
          expect(conflict).toMatchObject({
            _tag: "Conflict",
            code: "CONFLICT",
          });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM authority.evidence) AS evidence,
      (SELECT count(*)::int FROM authority.claims) AS claims,
      (SELECT count(*)::int FROM authority.receipts) AS receipts,
      (SELECT count(*)::int FROM authority.pins) AS pins`
          ).toStrictEqual([{ claims: 1, evidence: 1, pins: 1, receipts: 3 }]);
          expect(
            yield* sql`SELECT source_label FROM authority.evidence`
          ).toStrictEqual([{ source_label: "Original label" }]);
          const badPlan = yield* bindWorldIntent({
            ...input,
            operationId: yield* Schema.decodeEffect(
              ImportEvidence.fields.operationId
            )(randomUUID()),
          });
          const invalidDomain = yield* commitMutation(context, badPlan, {
            apply: (receiptRef) =>
              Effect.gen(function* attemptUndeclaredDomain() {
                yield* sql`UPDATE authority.sources SET label = 'must roll back' WHERE source_id = ${first.sourceRef} AND world_id = ${created.worldRef.worldId} AND realm = 'live'`;
                return {
                  changedDomains: ["sources"],
                  result: { ...first, receiptRef },
                };
              }),
            basis: null,
            domains: ["claims"],
          }).pipe(Effect.flip);
          expect(invalidDomain).toMatchObject({
            _tag: "Unavailable",
            code: "UNAVAILABLE",
          });
          expect(yield* sql`SELECT label FROM authority.sources`).toStrictEqual(
            [{ label: "Original label" }]
          );
          expect(yield* readCut(created.worldRef)).toStrictEqual(cut);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
