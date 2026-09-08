import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import {
  ImportEvidence,
  Inspect,
  OpenEvidence,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { sweepExpiredCaptures } from "../../../../packages/ontology/src/evidence/cleanup.js";
import { importEvidence } from "../../../../packages/ontology/src/evidence/import.js";
import { openEvidence } from "../../../../packages/ontology/src/evidence/open.js";
import { inspect } from "../../../../packages/ontology/src/knowledge/inspect.js";
import {
  EvidenceObjectStore,
  ObjectLocation,
} from "../../../../packages/ontology/src/ports/worlds/storage.js";
import { canonicalJson } from "../../../../packages/ontology/src/values/canonical.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX08 frame freezes original labels and rivals; open returns original bytes and unavailable content never rewrites history",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* frameHistory() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          const inspectRequest = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "invoice-1" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef,
          });
          const empty = yield* inspect(context, inspectRequest);
          expect(empty.frame.claims).toStrictEqual([]);
          expect(empty.frame.coverage).toStrictEqual({ _tag: "Unknown" });
          const importOne = (revision: string, amount: string) =>
            Effect.gen(function* revisionImport() {
              const document = yield* canonicalJson({
                records: [
                  {
                    externalId: "record-1",
                    predicate: "obligation.amount",
                    subjectKey: "invoice-1",
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                    value: { _tag: "Known", amount, currency: "BRL" },
                  },
                ],
                schemaVersion: "worlds.v1",
                source: {
                  externalId: "billing",
                  label: `Label ${revision}`,
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
              return {
                document,
                result: yield* importEvidence(context, input),
              };
            });
          const first = yield* importOne("1", "100.00");
          const saved = yield* inspect(context, inspectRequest);
          expect(
            saved.frame.claims.map((claim) => claim.source.label)
          ).toStrictEqual(["Label 1"]);
          expect(saved.frame.claims[0]?.value).toStrictEqual({
            _tag: "Known",
            amount: "100",
            currency: "BRL",
          });
          yield* importOne("2", "200.00");
          const current = yield* inspect(context, inspectRequest);
          expect(
            current.frame.claims.map((claim) => claim.source.label)
          ).toStrictEqual(["Label 1", "Label 2"]);
          expect(current.frame).toMatchObject({
            contested: true,
            selection: { _tag: "unresolved" },
            verification: "unverified",
          });
          const replay = {
            ...inspectRequest,
            input: { ...inspectRequest.input, atFrame: saved.frame.frameRef },
          };
          expect(yield* inspect(context, replay)).toStrictEqual(saved);
          expect(Object.keys(saved.frame)).not.toContain("internalBasis");
          const openRequest = yield* Schema.decodeEffect(OpenEvidence)({
            ...inspectRequest,
            input: { evidenceRef: first.result.evidenceRef },
            operation: "OpenEvidence",
          });
          expect((yield* openEvidence(context, openRequest)).document).toBe(
            first.document
          );
          const sql = yield* SqlClient.SqlClient;
          const rows =
            yield* sql`SELECT internal_basis->'cut'->>'claims' AS claims, (SELECT count(*)::int FROM authority.pins WHERE owner_kind = 'frame' AND owner_id = ${saved.frame.frameRef}) AS pins FROM authority.frames WHERE frame_id = ${saved.frame.frameRef}`;
          expect(rows).toStrictEqual([{ claims: "1", pins: 1 }]);
          yield* Effect.gen(function* ageAdmittedCaptures() {
            const setup = yield* SqlClient.SqlClient;
            yield* setup`UPDATE jobs.captures SET expires_at = clock_timestamp() - interval '1 second' WHERE world_id = ${worldRef.worldId}`;
          }).pipe(Effect.provide(database.migration));
          expect(yield* sweepExpiredCaptures(worldRef, null)).toStrictEqual({
            nextCursor: null,
            visited: 0,
          });
          expect((yield* openEvidence(context, openRequest)).document).toBe(
            first.document
          );
          const [capture] =
            yield* sql`SELECT object_location FROM jobs.captures JOIN authority.evidence USING (world_id, realm, capture_id) WHERE evidence_id = ${first.result.evidenceRef}`;
          const original = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ object_location: ObjectLocation })
          )(capture);
          yield* (yield* EvidenceObjectStore).remove(original.object_location);
          expect(
            yield* openEvidence(context, openRequest).pipe(Effect.flip)
          ).toMatchObject({ _tag: "HistoricalContentUnavailable" });
          expect(yield* inspect(context, replay)).toStrictEqual(saved);
          const second = yield* makeInput();
          const other = yield* createPersonalWorld(
            second.context,
            second.request
          );
          expect(
            yield* inspect(second.context, {
              ...replay,
              worldRef: other.worldRef,
            }).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(
            yield* openEvidence(second.context, {
              ...openRequest,
              worldRef: other.worldRef,
            }).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
