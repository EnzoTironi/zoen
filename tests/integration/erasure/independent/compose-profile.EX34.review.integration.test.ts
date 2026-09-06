import { randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeD01PostgresLayer } from "../../../../apps/server/src/adapters/postgres/d01/postgres.js";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.js";
import { applyErasureMigrations } from "../../../../ops/migrations/run.ts";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { inspectWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/inspect.js";
import { requestWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/request.js";
import { localErasureAttemptRegisterLayer } from "../../../../packages/authority/src/ports/erasure/local-pg.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/d01/operations.js";
import {
  InspectWorldErasure,
  RequestWorldErasure,
  WorldErasureRequested,
} from "../../../../packages/contracts/src/erasure/operations.js";
import {
  erasableConfiguration,
  makeContext,
  retainedConfiguration,
} from "../core/fixture.js";

/**
 * EX34 independent oracles: numbered migrations + new-World erasable profile.
 * Retained Worlds stay blocked; restoreAfterErasure stays false; no purge/Erased.
 */
const withNumberedErasureRuntime = <A, E, R, ROut, EOut>(
  configuration: Layer.Layer<ROut, EOut>,
  run: Effect.Effect<A, E, R>
) =>
  withD01Database(
    (database) =>
      Effect.gen(function* prepare() {
        const registerPg = makeD01PostgresLayer({
          applicationName: "zoen-ex34-erasure-attempt",
          maxConnections: 4,
          url: database.urls.authority,
        });
        const register = localErasureAttemptRegisterLayer.pipe(
          Layer.provide(registerPg)
        );
        return yield* run.pipe(
          Effect.provide(
            Layer.mergeAll(configuration, database.authority, register)
          )
        );
      }),
    undefined,
    (database) =>
      applyErasureMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );

const createWorld = Effect.fn("EX34.createWorld")(function* createWorld(
  context: Effect.Success<ReturnType<typeof makeContext>>
) {
  const request = yield* Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "d01.v1",
  });
  return yield* createPersonalWorld(context, request);
});

it.live(
  "EX34 erasable profile on NEW Worlds: Closing via numbered migrations; no Erased",
  () =>
    withNumberedErasureRuntime(
      erasableConfiguration,
      Effect.gen(function* erasableClosing() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`
            SELECT data_policy_id FROM authority.worlds
            WHERE world_id = ${created.worldRef.worldId}
          `
        ).toStrictEqual([{ data_policy_id: "d03-local-erasable-v1" }]);
        const operationId = randomUUID();
        const request = yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "d03-local-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const closed = yield* requestWorldErasure(context, request).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldErasureRequested))
        );
        expect(closed).toMatchObject({
          attemptExternalState: "Confirmed",
          phase: "Closing",
          restoreAfterErasure: false,
        });
        expect(["Erased", "Purging"]).not.toContain(closed.phase);
        const inspect = yield* Schema.decodeEffect(InspectWorldErasure)({
          input: { operationId: null },
          operation: "InspectWorldErasure",
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const observed = yield* inspectWorldErasure(context, inspect);
        expect(observed).toMatchObject({
          phase: "Closing",
          restoreAfterErasure: false,
        });
        expect(
          yield* sql`
            SELECT state FROM erasure_attempt.attempts
            WHERE operation_id = ${operationId}
          `
        ).toStrictEqual([{ state: "Confirmed" }]);
        expect(
          yield* sql`
            SELECT phase FROM authority.world_erasure_progress
            WHERE world_id = ${created.worldRef.worldId}
          `
        ).toStrictEqual([{ phase: "Closing" }]);
      })
    )
);

it.live(
  "EX34 retained Worlds reject Closing even when erasure DDL is installed",
  () =>
    withNumberedErasureRuntime(
      retainedConfiguration,
      Effect.gen(function* retainedBlocked() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`
            SELECT data_policy_id FROM authority.worlds
            WHERE world_id = ${created.worldRef.worldId}
          `
        ).toStrictEqual([{ data_policy_id: "d01-local-retained-v1" }]);
        const request = yield* Schema.decodeEffect(RequestWorldErasure)({
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
        const denied = yield* requestWorldErasure(context, request).pipe(
          Effect.flip
        );
        expect(denied).toMatchObject({
          _tag: "Blocked",
          code: "PROFILE_BLOCKED",
        });
        expect(
          yield* sql`SELECT count(*)::integer AS count FROM authority.world_erasure_progress`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT count(*)::integer AS count FROM erasure_attempt.attempts`
        ).toStrictEqual([{ count: 0 }]);
      })
    )
);

it.live(
  "EX34 restoreAfterErasure stays false on erasable Closing success",
  () =>
    withNumberedErasureRuntime(
      erasableConfiguration,
      Effect.gen(function* restoreClosed() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const request = yield* Schema.decodeEffect(RequestWorldErasure)({
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
        const closed = yield* requestWorldErasure(context, request);
        expect(closed).toMatchObject({ restoreAfterErasure: false });
      })
    )
);
