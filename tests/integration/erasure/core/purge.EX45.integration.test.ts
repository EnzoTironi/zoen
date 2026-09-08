import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeWorldsPostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { inspectWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/inspect.js";
import { purgeWorldContent } from "../../../../packages/authority/src/knowledge/erasure/handlers/purge.js";
import { requestWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/request.js";
import { applyWorldErasureSchema } from "../../../../packages/authority/src/knowledge/erasure/schema.js";
import { ErasureObjectInventory } from "../../../../packages/authority/src/ports/erasure/inventory.js";
import {
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "../../../../packages/authority/src/ports/erasure/local-pg.js";
import { ErasurePurgeStore } from "../../../../packages/authority/src/ports/erasure/purge.js";
import {
  InspectWorldErasure,
  PurgeWorldContent,
  RequestWorldErasure,
} from "../../../../packages/contracts/src/erasure/operations.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  erasableConfiguration,
  makeContext,
  retainedConfiguration,
} from "./fixture.js";

const emptyObjectLayers = Layer.mergeAll(
  Layer.succeed(
    ErasureObjectInventory,
    ErasureObjectInventory.of({
      listWorldMultipartUploads: (worldRef) =>
        Effect.succeed({
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
          uploads: [],
        }),
      listWorldVersions: (worldRef) =>
        Effect.succeed({
          entries: [],
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
        }),
    })
  ),
  Layer.succeed(
    ErasurePurgeStore,
    ErasurePurgeStore.of({
      inspectHold: () => Effect.succeed("Clear" as const),
      purgeManifest: () => Effect.succeed([]),
      purgeVersion: () => Effect.succeed("AlreadyAbsent" as const),
    })
  )
);

const grantErasureSchemas = Effect.fn("EX45.grantErasure")(
  function* grantErasureSchemas(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `GRANT USAGE ON SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON authority.world_erasure_progress, authority.world_erasure_receipts TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON authority.frames, authority.cases, authority.corrections,
         authority.claims, authority.pins, authority.evidence, authority.sources,
         authority.receipts, authority.operations, authority.bootstrap_operations,
         authority.memberships, authority.identity_decisions TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON jobs.captures, jobs.outbox TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON jobs.object_write_attempts TO "${authorityRole}"`
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
        const objectWrite = yield* Effect.promise(() =>
          import("node:fs/promises").then((fs) =>
            fs.readFile(
              new URL(
                "../../../../ops/migrations/015_object_write_settlement.sql",
                import.meta.url
              ),
              "utf-8"
            )
          )
        );
        yield* sql.withTransaction(sql.unsafe(objectWrite));
        yield* applyErasureAttemptSchema();
        yield* applyWorldErasureSchema();
        yield* grantErasureSchemas(database.names.authority);
      }).pipe(Effect.provide(database.migration));

      const registerPg = makeWorldsPostgresLayer({
        applicationName: "zoen-ex45-erasure-attempt",
        maxConnections: 4,
        url: database.urls.authority,
      });
      const register = localErasureAttemptRegisterLayer.pipe(
        Layer.provide(registerPg)
      );
      return yield* run.pipe(
        Effect.provide(
          Layer.mergeAll(
            configuration,
            database.authority,
            register,
            emptyObjectLayers
          )
        )
      );
    })
  );

const createWorld = Effect.fn("EX45.createWorld")(function* createWorld(
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

const seedSyntheticFrame = Effect.fn("EX45.seedFrame")(
  function* seedSyntheticFrame(worldId: string, principalId: string) {
    const sql = yield* SqlClient.SqlClient;
    const frameId = randomUUID();
    yield* sql`
      INSERT INTO authority.frames (
        world_id, realm, frame_id, principal_id, purpose, subject_key,
        internal_basis, visible_frame, created_at
      ) VALUES (
        ${worldId}, ${"live"}, ${frameId}, ${principalId},
        ${"personal-records"}, ${"synthetic-subject"},
        ${JSON.stringify({ kind: "synthetic", note: "disposable" })}::jsonb,
        ${JSON.stringify({ kind: "synthetic-visible", note: "purge-me" })}::jsonb,
        clock_timestamp()
      )
    `;
    return frameId;
  }
);

it.live(
  "EX45 happy path: Closing→Confirmada→SQL purge→Erased; Closing receipt immutable; restore blocked",
  () =>
    withErasureRuntime(
      erasableConfiguration,
      Effect.gen(function* happy() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const closingOperationId = randomUUID();
        const closingRequest = yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-local-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId: closingOperationId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const closed = yield* requestWorldErasure(context, closingRequest);
        expect(closed).toMatchObject({
          _tag: "WorldErasureRequested",
          phase: "Closing",
          restoreAfterErasure: false,
        });

        yield* seedSyntheticFrame(
          created.worldRef.worldId,
          context.presence.principalId
        );
        const sql = yield* SqlClient.SqlClient;
        const beforeFrames = yield* sql`
          SELECT count(*)::int AS count FROM authority.frames
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(beforeFrames).toStrictEqual([{ count: 1 }]);

        const purgeOperationId = randomUUID();
        const purgeRequest = yield* Schema.decodeEffect(PurgeWorldContent)({
          input: {
            closingOperationId,
            expectedErasureRevision: closed.revision,
          },
          operation: "PurgeWorldContent",
          operationId: purgeOperationId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const purged = yield* purgeWorldContent(context, purgeRequest);
        expect(purged).toMatchObject({
          _tag: "WorldContentPurged",
          attestationScope: "local-controlled-copies",
          phase: "Erased",
          restoreAfterErasure: false,
          sqlContentPurged: true,
        });
        expect(purged.restoreAfterErasure).toBeFalsy();

        const frames = yield* sql`
          SELECT count(*)::int AS count FROM authority.frames
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(frames).toStrictEqual([{ count: 0 }]);
        const worlds = yield* sql`
          SELECT count(*)::int AS count FROM authority.worlds
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(worlds).toStrictEqual([{ count: 1 }]);
        const progress = yield* sql`
          SELECT phase FROM authority.world_erasure_progress
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(progress).toStrictEqual([{ phase: "Erased" }]);
        const erasureReceipt = yield* sql`
          SELECT count(*)::int AS count FROM authority.world_erasure_receipts
          WHERE world_id = ${created.worldRef.worldId}
            AND operation_id = ${closingOperationId}
        `;
        expect(erasureReceipt).toStrictEqual([{ count: 1 }]);
        const closingReceipt = yield* sql`
          SELECT count(*)::int AS count FROM authority.receipts
          WHERE world_id = ${created.worldRef.worldId}
            AND receipt_id = ${closed.receiptRef}
        `;
        expect(closingReceipt).toStrictEqual([{ count: 1 }]);

        const replayClosing = yield* requestWorldErasure(
          context,
          closingRequest
        );
        expect(replayClosing).toMatchObject({
          _tag: "WorldErasureRequested",
          phase: "Closing",
          receiptRef: closed.receiptRef,
          restoreAfterErasure: false,
        });
        expect(replayClosing.phase).not.toBe("Erased");

        const inspected = yield* inspectWorldErasure(
          context,
          yield* Schema.decodeEffect(InspectWorldErasure)({
            input: { operationId: closingOperationId },
            operation: "InspectWorldErasure",
            purpose: "personal-records",
            schemaVersion: "erasure.v1",
            worldRef: created.worldRef,
          })
        );
        expect(inspected).toMatchObject({
          phase: "Erased",
          restoreAfterErasure: false,
        });

        const replayPurge = yield* purgeWorldContent(context, purgeRequest);
        expect(replayPurge).toMatchObject({
          phase: "Erased",
          receiptRef: purged.receiptRef,
          restoreAfterErasure: false,
        });
      })
    )
);

it.live("EX45 does not purge another World", () =>
  withErasureRuntime(
    erasableConfiguration,
    Effect.gen(function* isolation() {
      const context = yield* makeContext();
      const target = yield* createWorld(context);
      const other = yield* createWorld(context);
      yield* seedSyntheticFrame(
        other.worldRef.worldId,
        context.presence.principalId
      );

      const closingOperationId = randomUUID();
      const closed = yield* requestWorldErasure(
        context,
        yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-local-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId: closingOperationId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: target.worldRef,
        })
      );
      yield* purgeWorldContent(
        context,
        yield* Schema.decodeEffect(PurgeWorldContent)({
          input: {
            closingOperationId,
            expectedErasureRevision: closed.revision,
          },
          operation: "PurgeWorldContent",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: target.worldRef,
        })
      );

      const sql = yield* SqlClient.SqlClient;
      const otherFrames = yield* sql`
        SELECT count(*)::int AS count FROM authority.frames
        WHERE world_id = ${other.worldRef.worldId}
      `;
      expect(otherFrames).toStrictEqual([{ count: 1 }]);
    })
  )
);

it.live("EX45 retained profile blocks purge", () =>
  withErasureRuntime(
    retainedConfiguration,
    Effect.gen(function* retained() {
      // Retained Worlds never reach Closing under erasable policyVersion.
      const context = yield* makeContext();
      const created = yield* createWorld(context);
      const error = yield* requestWorldErasure(
        context,
        yield* Schema.decodeEffect(RequestWorldErasure)({
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
        })
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ code: "PROFILE_BLOCKED" });
    })
  )
);
