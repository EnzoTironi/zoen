import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeWorldsPostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { inspectWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/inspect.js";
import { requestWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/request.js";
import { applyWorldErasureSchema } from "../../../../packages/authority/src/knowledge/erasure/schema.js";
import {
  ErasureAttemptRegister,
  blocksWorldActivation,
} from "../../../../packages/authority/src/ports/erasure/attempt-register.js";
import {
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "../../../../packages/authority/src/ports/erasure/local-pg.js";
import {
  InspectWorldErasure,
  RequestWorldErasure,
  WorldErasureRequested,
} from "../../../../packages/contracts/src/erasure/operations.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  erasableConfiguration,
  installation,
  makeContext,
  retainedConfiguration,
} from "./fixture.js";

const grantErasureSchemas = Effect.fn("EX32.grantErasure")(
  function* grantErasureSchemas(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `GRANT USAGE ON SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON authority.world_erasure_progress, authority.world_erasure_receipts TO "${authorityRole}"`
    );
  }
);

const withErasureRuntime = <A, E, R, ROut, EOut>(
  configuration: Layer.Layer<ROut, EOut>,
  run: Effect.Effect<A, E, R>
) =>
  withWorldsDatabase((database) =>
    Effect.gen(function* prepare() {
      yield* Effect.gen(function* migrate() {
        const sql = yield* SqlClient.SqlClient;
        const membership = yield* Effect.promise(() =>
          import("node:fs/promises").then((fs) =>
            fs.readFile(
              new URL(
                "../../../../ops/migrations/005_world_read_membership.sql",
                import.meta.url
              ),
              "utf-8"
            )
          )
        );
        yield* sql.withTransaction(sql.unsafe(membership));
        yield* applyErasureAttemptSchema();
        yield* applyWorldErasureSchema();
        yield* grantErasureSchemas(database.names.authority);
      }).pipe(Effect.provide(database.migration));

      const registerPg = makeWorldsPostgresLayer({
        applicationName: "zoen-ex32-erasure-attempt",
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
    })
  );

const createWorld = Effect.fn("EX32.createWorld")(function* createWorld(
  context: Effect.Success<ReturnType<typeof makeContext>>
) {
  const request = yield* Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "worlds.v1",
  });
  return yield* createPersonalWorld(context, request);
});

it.live(
  "EX32 happy path: register → Closing → Confirmada; no Erased/purge claim",
  () =>
    withErasureRuntime(
      erasableConfiguration,
      Effect.gen(function* happy() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
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
        const success = yield* requestWorldErasure(context, request);
        expect(success).toMatchObject({
          _tag: "WorldErasureRequested",
          attemptExternalState: "Confirmed",
          phase: "Closing",
          restoreAfterErasure: false,
          worldRef: created.worldRef,
        });
        expect(success.phase).not.toBe("Erased");
        expect(success.phase).not.toBe("Purging");

        const register = yield* ErasureAttemptRegister;
        const observed = yield* register.inspect({
          deploymentEpoch: `cell:${installation.cellId}:epoch:${installation.cellEpoch}`,
          operationId: request.operationId,
          principalId: context.presence.principalId,
          worldRef: created.worldRef,
        });
        expect(observed.state).toBe("Confirmed");
        expect(blocksWorldActivation("Confirmed")).toBeFalsy();

        const sql = yield* SqlClient.SqlClient;
        const progress = yield* sql`
          SELECT phase, erasure_revision::text AS revision
          FROM authority.world_erasure_progress
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(progress).toStrictEqual([{ phase: "Closing", revision: "1" }]);
        const outbox = yield* sql`
          SELECT count(*)::int AS count FROM jobs.outbox
          WHERE world_id = ${created.worldRef.worldId}
            AND receipt_id = ${success.receiptRef}
        `;
        expect(outbox).toStrictEqual([{ count: 1 }]);
        // No content DELETE admitted in EX32.
        const worlds = yield* sql`
          SELECT count(*)::int AS count FROM authority.worlds
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(worlds).toStrictEqual([{ count: 1 }]);

        const inspected = yield* inspectWorldErasure(
          context,
          yield* Schema.decodeEffect(InspectWorldErasure)({
            input: { operationId },
            operation: "InspectWorldErasure",
            purpose: "personal-records",
            schemaVersion: "erasure.v1",
            worldRef: created.worldRef,
          })
        );
        expect(inspected).toMatchObject({
          attemptExternalState: "Confirmed",
          phase: "Closing",
          restoreAfterErasure: false,
        });
      })
    )
);

it.live("EX32 retained profile blocks Closing", () =>
  withErasureRuntime(
    retainedConfiguration,
    Effect.gen(function* retained() {
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
      const error = yield* requestWorldErasure(context, request).pipe(
        Effect.flip
      );
      expect(error).toMatchObject({
        _tag: "Blocked",
        code: "PROFILE_BLOCKED",
      });
    })
  )
);

it.live(
  "EX32 missing register (unqualified) blocks Closing — no local progress",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* missing() {
        yield* Effect.gen(function* migrate() {
          const sql = yield* SqlClient.SqlClient;
          const membership = yield* Effect.promise(() =>
            import("node:fs/promises").then((fs) =>
              fs.readFile(
                new URL(
                  "../../../../ops/migrations/005_world_read_membership.sql",
                  import.meta.url
                ),
                "utf-8"
              )
            )
          );
          yield* sql.withTransaction(sql.unsafe(membership));
          yield* applyErasureAttemptSchema();
          yield* applyWorldErasureSchema();
          yield* grantErasureSchemas(database.names.authority);
        }).pipe(Effect.provide(database.migration));
        const layers = Layer.mergeAll(
          erasableConfiguration,
          database.authority,
          ErasureAttemptRegister.unqualifiedLayer
        );
        const context = yield* makeContext();
        const created = yield* createWorld(context).pipe(
          Effect.provide(layers)
        );
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
        const error = yield* requestWorldErasure(context, request).pipe(
          Effect.provide(layers),
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });
        expect(
          yield* Effect.gen(function* countProgress() {
            const sql = yield* SqlClient.SqlClient;
            return yield* sql`SELECT count(*)::int AS count FROM authority.world_erasure_progress`;
          }).pipe(Effect.provide(database.authority))
        ).toStrictEqual([{ count: 0 }]);
      })
    )
);

it.live("EX32 idempotent replay, payload Conflict, viewer denied", () =>
  withErasureRuntime(
    erasableConfiguration,
    Effect.gen(function* replayConflictViewer() {
      const owner = yield* makeContext();
      const created = yield* createWorld(owner);
      const operationId = randomUUID();
      const base = {
        operation: "RequestWorldErasure" as const,
        operationId,
        purpose: "personal-records" as const,
        schemaVersion: "erasure.v1" as const,
        worldRef: created.worldRef,
      };
      const firstReq = yield* Schema.decodeEffect(RequestWorldErasure)({
        ...base,
        input: {
          confirmEntireWorld: true,
          expectedErasureRevision: null,
          policyVersion: "d03-local-erasable-v1",
        },
      });
      const first = yield* requestWorldErasure(owner, firstReq);
      const replay = yield* requestWorldErasure(owner, firstReq);
      expect(replay).toStrictEqual(first);
      expect(replay.attemptExternalState).toBe("Confirmed");

      // Same operationId + different intention digest (expected revision).
      const other = yield* Schema.decodeEffect(RequestWorldErasure)({
        ...base,
        input: {
          confirmEntireWorld: true,
          expectedErasureRevision: "99",
          policyVersion: "d03-local-erasable-v1",
        },
      });
      const conflict = yield* requestWorldErasure(owner, other).pipe(
        Effect.flip
      );
      expect(conflict).toMatchObject({ _tag: "Conflict", code: "CONFLICT" });

      const viewer = yield* makeContext();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        INSERT INTO authority.memberships
          (world_id, realm, principal_id, state, revision, role)
        VALUES (
          ${created.worldRef.worldId}, ${"live"}, ${viewer.presence.principalId},
          ${"active"}, 0, ${"viewer"}
        )
      `;
      const denied = yield* requestWorldErasure(viewer, firstReq).pipe(
        Effect.flip
      );
      expect(denied).toMatchObject({
        _tag: "NotFoundOrDenied",
        code: "NOT_FOUND_OR_DENIED",
      });

      const decoded = yield* Schema.decodeUnknownEffect(WorldErasureRequested)(
        first
      );
      expect(decoded.restoreAfterErasure).toBeFalsy();
    })
  )
);
