import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/authority/src/evidence/worlds/import.js";
import { inspect } from "../../../../packages/authority/src/knowledge/worlds/inspect.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  ImportEvidence,
  Inspect,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX08 the 201st claim fails the Frame quota without retaining a truncated Frame or its pins",
  () =>
    withD01Database((database) =>
      withStorage(() =>
        Effect.gen(function* frameQuota() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          const importRecords = (revision: string, count: number) =>
            Effect.gen(function* importBatch() {
              const document = yield* canonicalJson({
                records: Array.from({ length: count }, (_, index) => ({
                  externalId: `record-${index}`,
                  predicate: "obligation.amount",
                  subjectKey: "many",
                  validTime: { _tag: "Unknown" },
                  value: { _tag: "Known", amount: "10.00", currency: "BRL" },
                })),
                schemaVersion: "worlds.v1",
                source: {
                  externalId: "batch",
                  label: "Batch",
                  namespace: "test",
                  revision,
                },
              });
              const input = yield* Schema.decodeEffect(ImportEvidence)({
                ...request,
                input: { document },
                operation: "ImportEvidence",
                operationId: randomUUID(),
                worldRef,
              });
              return yield* importEvidence(context, input);
            });
          yield* importRecords("1", 200);
          const input = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "many" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef,
          });
          const maximum = yield* inspect(context, input);
          expect(maximum.frame.claims).toHaveLength(200);
          yield* importRecords("2", 1);
          expect(
            yield* inspect(context, input).pipe(Effect.flip)
          ).toMatchObject({ _tag: "QuotaExceeded" });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM authority.frames) AS frames, (SELECT count(*)::int FROM authority.pins WHERE owner_kind = 'frame') AS pins, (SELECT count(*)::int FROM authority.claims) AS claims`
          ).toStrictEqual([{ claims: 201, frames: 1, pins: 1 }]);
          expect(
            yield* inspect(context, {
              ...input,
              input: { ...input.input, atFrame: maximum.frame.frameRef },
            })
          ).toStrictEqual(maximum);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
