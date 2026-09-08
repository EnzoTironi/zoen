import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import { reserveCapture } from "@zoen/authority/evidence/worlds/capture";
import { purgeWorldContent } from "@zoen/authority/knowledge/erasure/handlers/purge";
import { requestWorldErasure } from "@zoen/authority/knowledge/erasure/handlers/request";
import {
  applyObjectWriteSettlementEvidence,
  markObjectWriteSubmitted,
  markObjectWriteUnknown,
} from "@zoen/authority/knowledge/erasure/object-write-settlement";
import {
  PurgeWorldContent,
  RequestWorldErasure,
} from "@zoen/contracts/erasure/operations";
import { CreatePersonalWorld } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { layer as erasureStorage } from "../../../../apps/server/src/adapters/object-storage/erasure/s3.ts";
import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withErasureRuntime } from "../support/runtime.ts";
import { makeContext } from "./fixture.ts";

const scenario = Effect.gen(function* createScenario() {
  const context = yield* makeContext();
  const created = yield* createPersonalWorld(
    context,
    yield* Schema.decodeEffect(CreatePersonalWorld)({
      input: {},
      operation: "CreatePersonalWorld",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    })
  );
  const closing = yield* Schema.decodeEffect(RequestWorldErasure)({
    input: {
      confirmEntireWorld: true,
      expectedErasureRevision: null,
      policyVersion: "worlds-local-erasable-v1",
    },
    operation: "RequestWorldErasure",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "erasure.v1",
    worldRef: created.worldRef,
  });
  return { closing, context, world: created.worldRef };
});

const purgeOf = (closing: typeof RequestWorldErasure.Type, revision: string) =>
  Schema.decodeEffect(PurgeWorldContent)({
    input: {
      closingOperationId: closing.operationId,
      expectedErasureRevision: revision,
    },
    operation: "PurgeWorldContent",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "erasure.v1",
    worldRef: closing.worldRef,
  });

it.live(
  "ZA-10-01: submitted write before Closing keeps purge blocked until terminal evidence",
  () =>
    withErasureRuntime(() =>
      withStorage(({ config }) =>
        Effect.gen(function* delayedReply() {
          const { closing, context, world } = yield* scenario;
          const bytes = new TextEncoder().encode('{"za10":"delayed"}');
          const reservation = yield* reserveCapture(context, world, bytes);
          yield* markObjectWriteSubmitted({
            captureId: reservation.captureId,
            world,
          });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT state FROM jobs.object_write_attempts
              WHERE capture_id = ${reservation.captureId}`
          ).toStrictEqual([{ state: "external_submitted" }]);
          const closed = yield* requestWorldErasure(context, closing);
          expect(closed.phase).toBe("Closing");
          const blocked = yield* purgeWorldContent(
            context,
            yield* purgeOf(closing, closed.revision)
          ).pipe(Effect.flip);
          expect(blocked).toMatchObject({ code: "UNAVAILABLE" });
        }).pipe(Effect.provide(erasureStorage(config)))
      )
    )
);

it.live(
  "ZA-10-02: HEAD 404 / client cancellation cannot certify settlement or Erased",
  () =>
    withErasureRuntime(() =>
      withStorage(({ config }) =>
        Effect.gen(function* cancelOr404() {
          const { closing, context, world } = yield* scenario;
          const bytes = new TextEncoder().encode('{"za10":"cancel"}');
          const reservation = yield* reserveCapture(context, world, bytes);
          yield* markObjectWriteSubmitted({
            captureId: reservation.captureId,
            world,
          });
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql`
            SELECT attempt_id::text AS attempt_id FROM jobs.object_write_attempts
            WHERE capture_id = ${reservation.captureId}`;
          expect(rows).toHaveLength(1);
          const attemptId = (yield* Schema.decodeUnknownEffect(
            Schema.Struct({ attempt_id: Schema.String })
          )(rows[0])).attempt_id;
          expect(
            yield* applyObjectWriteSettlementEvidence({
              _tag: "HeadNotFound",
              attemptId,
            }).pipe(Effect.flip)
          ).toMatchObject({ code: "PROFILE_BLOCKED" });
          yield* markObjectWriteUnknown({
            captureId: reservation.captureId,
            world,
          });
          expect(
            yield* applyObjectWriteSettlementEvidence({
              _tag: "ClientCancelled",
              attemptId,
            })
          ).toBe("unknown");
          // Capture still reserved / unknown — settle via fake removed must not unlock Erased.
          yield* sql`
            UPDATE jobs.captures SET state = 'removed'
            WHERE capture_id = ${reservation.captureId}`;
          const closed = yield* requestWorldErasure(context, closing);
          expect(
            yield* purgeWorldContent(
              context,
              yield* purgeOf(closing, closed.revision)
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "UNAVAILABLE" });
          expect(
            yield* sql`SELECT state FROM jobs.object_write_attempts
              WHERE attempt_id = ${attemptId}::uuid`
          ).toStrictEqual([{ state: "unknown" }]);
        }).pipe(Effect.provide(erasureStorage(config)))
      )
    )
);

it.live(
  "ZA-10-03: absent credential-retirement proof keeps the storage fence closed",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* noRetirement() {
        expect(
          yield* applyObjectWriteSettlementEvidence({
            _tag: "CredentialRetirement",
            attemptId: randomUUID(),
          }).pipe(Effect.flip)
        ).toMatchObject({ code: "PROFILE_BLOCKED" });
        const { closing, context } = yield* scenario;
        const closed = yield* requestWorldErasure(context, closing);
        // Quiet World may still purge local-controlled-copies; fence itself stays Blocked.
        expect(closed.phase).toBe("Closing");
      })
    )
);
