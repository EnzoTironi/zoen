// oxlint-disable vitest/max-expects -- One real database/storage lifecycle proves retained state across its transitions.
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  reserveCapture,
  stageCapture,
} from "../../../../packages/authority/src/evidence/d01/capture.js";
import { sweepExpiredCaptures } from "../../../../packages/authority/src/evidence/d01/cleanup.js";
import { EvidenceObjectStore } from "../../../../packages/authority/src/ports/d01/storage.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX08 expired upload fencing removes real orphans and later uploads cannot revive a cleaned reservation",
  () =>
    withD01Database((database) =>
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
          // The provider accepted the late stage, but SQL fencing denied confirmation.
          const orphan = yield* store.locate({
            captureId: late.captureId,
            expectedBytes: late.expectedBytes,
            expectedDigest: late.expectedDigest,
            worldRef,
          });
          expect(yield* store.read(orphan)).toStrictEqual(bytes);
          yield* sweepExpiredCaptures(worldRef, null);
          expect(yield* store.read(orphan).pipe(Effect.flip)).toMatchObject({
            _tag: "StorageFailure",
            reason: "NotFound",
          });
          const rows =
            yield* sql`SELECT state, fence::text FROM jobs.captures WHERE world_id = ${worldRef.worldId}`;
          expect(rows).toStrictEqual([
            { fence: "2", state: "removed" },
            { fence: "2", state: "removed" },
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
    withD01Database((database) =>
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
