import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import { reserveCapture } from "@zoen/authority/evidence/worlds/capture";
import { purgeWorldContent } from "@zoen/authority/knowledge/erasure/handlers/purge";
import { requestWorldErasure } from "@zoen/authority/knowledge/erasure/handlers/request";
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

const createScenario = Effect.gen(function* createScenario() {
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
      policyVersion: "d03-local-erasable-v1",
    },
    operation: "RequestWorldErasure",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "erasure.v1",
    worldRef: created.worldRef,
  });
  return { closing, context, world: created.worldRef };
});
const purgeRequest = (
  closing: typeof RequestWorldErasure.Type,
  revision: string
) =>
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
  "concurrent distinct purge operations cannot both claim the terminal SQL transition",
  () =>
    withErasureRuntime(() =>
      withStorage(({ config }) =>
        Effect.gen(function* concurrentPurge() {
          const { context, closing } = yield* createScenario;
          const closed = yield* requestWorldErasure(context, closing);
          const requests = [
            yield* purgeRequest(closing, closed.revision),
            yield* purgeRequest(closing, closed.revision),
          ];
          const results = yield* Effect.forEach(
            requests,
            (request) =>
              purgeWorldContent(context, request).pipe(Effect.result),
            { concurrency: 2 }
          );
          expect(
            results.filter((result) => result._tag === "Success")
          ).toHaveLength(1);
          expect(
            results.filter((result) => result._tag === "Failure")
          ).toHaveLength(1);
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS count FROM authority.operations
      WHERE semantic_operation = 'PurgeWorldContent'`
          ).toStrictEqual([{ count: 1 }]);
        }).pipe(Effect.provide(erasureStorage(config)))
      )
    )
);

it.live(
  "an expired reservation is not proof that a remote upload cannot finish",
  () =>
    withErasureRuntime((database) =>
      withStorage(({ config }) =>
        Effect.gen(function* uncertainPut() {
          const { context, closing, world } = yield* createScenario;
          const capture = yield* reserveCapture(
            context,
            world,
            new TextEncoder().encode("pending-upload")
          );
          const sql = yield* SqlClient.SqlClient;
          // Only the real migration role can construct an expired fixture; runtime grants stay unchanged.
          yield* SqlClient.SqlClient.use(
            (admin) => admin`UPDATE jobs.captures
      SET expires_at = clock_timestamp() - interval '1 second' WHERE capture_id = ${capture.captureId}`
          ).pipe(Effect.provide(database.migration));
          const closed = yield* requestWorldErasure(context, closing);
          const request = yield* purgeRequest(closing, closed.revision);
          expect(
            yield* purgeWorldContent(context, request).pipe(Effect.flip)
          ).toMatchObject({ code: "UNAVAILABLE" });
          expect(
            yield* sql`SELECT phase FROM authority.world_erasure_progress WHERE world_id = ${world.worldId}`
          ).toStrictEqual([{ phase: "Closing" }]);
          expect(
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE capture_id = ${capture.captureId}`
          ).toStrictEqual([{ count: 1 }]);
        }).pipe(Effect.provide(erasureStorage(config)))
      )
    )
);

it.live(
  "durable removed captures do not block purge terminality",
  () =>
    withErasureRuntime((database) =>
      withStorage(({ config }) =>
        Effect.gen(function* removedSettled() {
          const { context, closing, world } = yield* createScenario;
          const capture = yield* reserveCapture(
            context,
            world,
            new TextEncoder().encode("cleaned-upload")
          );
          // Simulate cleanup completing to durable `removed` without deleting the row yet
          // (SQL purge is what removes capture rows). Staging only accepts `reserved`.
          yield* SqlClient.SqlClient.use(
            (admin) => admin`UPDATE jobs.captures
      SET state = 'removed',
          expires_at = clock_timestamp() - interval '1 second'
      WHERE capture_id = ${capture.captureId}`
          ).pipe(Effect.provide(database.migration));
          const closed = yield* requestWorldErasure(context, closing);
          const request = yield* purgeRequest(closing, closed.revision);
          const purged = yield* purgeWorldContent(context, request);
          expect(purged).toMatchObject({ phase: "Erased" });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE capture_id = ${capture.captureId}`
          ).toStrictEqual([{ count: 0 }]);
        }).pipe(Effect.provide(erasureStorage(config)))
      )
    )
);
