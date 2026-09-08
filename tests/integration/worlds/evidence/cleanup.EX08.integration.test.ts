import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import {
  reserveCapture,
  stageCapture,
} from "../../../../packages/ontology/src/evidence/worlds/capture.js";
import { sweepExpiredCaptures } from "../../../../packages/ontology/src/evidence/worlds/cleanup.js";
import { EvidenceObjectStore } from "../../../../packages/ontology/src/ports/worlds/storage.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX08 expired upload fencing removes real orphans and later uploads cannot revive a cleaned reservation",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* cleanupFences() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          const bytes = new TextEncoder().encode(
            '{"original":"retained until expiration"}'
          );
          const uploaded = yield* reserveCapture(context, worldRef, bytes);
          const location = yield* stageCapture(context, uploaded, bytes);
          const late = yield* reserveCapture(context, worldRef, bytes);
          const sql = yield* SqlClient.SqlClient;
          yield* Effect.gen(function* ageSyntheticReservations() {
            const setup = yield* SqlClient.SqlClient;
            yield* setup`UPDATE jobs.captures SET expires_at = clock_timestamp() - interval '1 second' WHERE world_id = ${worldRef.worldId}`;
          }).pipe(Effect.provide(database.migration));
          expect(yield* sweepExpiredCaptures(worldRef, null)).toStrictEqual({
            nextCursor: null,
            visited: 2,
          });
          const store = yield* EvidenceObjectStore;
          expect(yield* store.read(location).pipe(Effect.flip)).toMatchObject({
            _tag: "StorageFailure",
            reason: "NotFound",
          });
          expect(
            yield* stageCapture(context, late, bytes).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Expired" });
          // ZA-10: submit gate refuses PutObject once cleanup moved the capture
          // off reserved, so late stage cannot recreate an orphan object.
          expect(
            yield* store
              .locate({
                captureId: late.captureId,
                expectedBytes: late.expectedBytes,
                expectedDigest: late.expectedDigest,
                worldRef,
              })
              .pipe(Effect.flip)
          ).toMatchObject({
            _tag: "StorageFailure",
            reason: "NotFound",
          });
          const rows =
            yield* sql`SELECT state, fence::text FROM jobs.captures WHERE world_id = ${worldRef.worldId}`;
          expect(rows).toStrictEqual([
            { fence: "1", state: "removed" },
            { fence: "1", state: "removed" },
          ]);
          expect(
            yield* sql`SELECT count(*)::int AS evidence FROM authority.evidence`
          ).toStrictEqual([{ evidence: 0 }]);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);

it.live(
  "EX08 cleanup pagination crosses equal expiration timestamps without revisiting a page",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* cursorPrecision() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          for (let index = 0; index < 33; index += 1) {
            yield* reserveCapture(
              context,
              worldRef,
              new TextEncoder().encode(`capture-${index}`)
            );
          }
          yield* Effect.gen(function* agePage() {
            const setup = yield* SqlClient.SqlClient;
            yield* setup`UPDATE jobs.captures SET expires_at = '2020-01-01T00:00:00.123456Z'::timestamptz WHERE world_id = ${worldRef.worldId}`;
          }).pipe(Effect.provide(database.migration));
          const first = yield* sweepExpiredCaptures(worldRef, null);
          expect(first.visited).toBe(32);
          expect(first.nextCursor).not.toBeNull();
          const second = yield* sweepExpiredCaptures(
            worldRef,
            first.nextCursor
          );
          expect(second).toStrictEqual({ nextCursor: null, visited: 1 });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS captures FROM jobs.captures WHERE world_id = ${worldRef.worldId} AND state = 'removed' AND fence = 1`
          ).toStrictEqual([{ captures: 33 }]);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
