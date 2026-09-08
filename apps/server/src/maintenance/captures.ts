import { WorldId } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { AuthorityInstallation } from "@zoen/ontology/commit/configuration";
import {
  CaptureSweepCursor,
  sweepExpiredCaptures,
} from "@zoen/ontology/evidence/worlds/cleanup";
import { DataPolicy } from "@zoen/ontology/ports/worlds/context";
import { Effect, Layer, Schedule, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const WorldPage = Schema.Array(Schema.Struct({ world_id: WorldId }));
const afterCursor = (left: CaptureSweepCursor, right: CaptureSweepCursor) =>
  left.expiresAt > right.expiresAt ||
  (left.expiresAt === right.expiresAt && left.captureId >= right.captureId);

/** A fixed high-water mark prevents new uploads from indefinitely extending one World's turn. */
const sweepWorld = Effect.fn("maintenance.sweepCaptureWorld")(
  function* sweepWorld(world: WorldRef) {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql`
    SELECT capture_id AS "captureId",
      to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiresAt"
    FROM jobs.captures
    WHERE world_id = ${world.worldId} AND realm = ${world.realm}
      AND state <> 'admitted' AND expires_at <= clock_timestamp()
    ORDER BY expires_at DESC, capture_id DESC LIMIT 1`;
    if (row === undefined) {
      return;
    }
    const ceiling = yield* Schema.decodeUnknownEffect(CaptureSweepCursor)(row);
    let cursor: CaptureSweepCursor | null = null;
    do {
      const result: Effect.Success<ReturnType<typeof sweepExpiredCaptures>> =
        yield* sweepExpiredCaptures(world, cursor);
      cursor = result.nextCursor;
      if (cursor === null || afterCursor(cursor, ceiling)) {
        return;
      }
      yield* Effect.yieldNow;
    } while (cursor !== null);
  }
);

/** Scan one bounded World page, advancing even if one provider operation fails. */
export const sweepCaptureWorldPage = Effect.fn(
  "maintenance.sweepCaptureWorldPage"
)(function* sweepCaptureWorldPage(afterWorld: typeof WorldId.Type | null) {
  const sql = yield* SqlClient.SqlClient;
  const installation = yield* AuthorityInstallation;
  const policy = yield* DataPolicy;
  const after =
    afterWorld === null ? sql`true` : sql`w.world_id > ${afterWorld}::uuid`;
  const rows = yield* sql`
      SELECT w.world_id FROM authority.worlds w
      WHERE w.realm = ${policy.enabledRealm} AND w.data_policy_id = ${policy.profileId}
        AND w.cell_id = ${installation.cellId} AND w.cell_epoch = ${installation.cellEpoch}
        AND w.generation_id = ${installation.generationId} AND w.release_digest = ${installation.releaseDigest}
        AND ${after} AND EXISTS (
          SELECT 1 FROM jobs.captures c WHERE c.world_id = w.world_id AND c.realm = w.realm
            AND c.state <> 'admitted' AND c.expires_at <= clock_timestamp())
      ORDER BY w.world_id LIMIT 32`;
  const worlds = yield* Schema.decodeUnknownEffect(WorldPage)(rows);
  for (const world of worlds) {
    yield* sweepWorld({
      realm: policy.enabledRealm,
      worldId: world.world_id,
    }).pipe(
      Effect.catch(() =>
        Effect.logWarning({ event: "maintenance.capture-retry" })
      )
    );
  }
  return worlds.length === 32 ? (worlds.at(-1)?.world_id ?? null) : null;
});

/** Same admitted resources as the application; capture fencing remains in the semantic module. */
export const captureMaintenance = Layer.effectDiscard(
  Effect.gen(function* captureWorker() {
    let afterWorld: typeof WorldId.Type | null = null;
    const page = Effect.gen(function* maintenancePage() {
      afterWorld = yield* sweepCaptureWorldPage(afterWorld);
    }).pipe(
      Effect.matchEffect({
        onFailure: () =>
          Effect.logWarning({ event: "maintenance.capture-retry" }),
        onSuccess: Effect.succeed,
      })
    );
    yield* page.pipe(
      Effect.repeat(Schedule.spaced("30 seconds")),
      Effect.forkScoped
    );
  })
);
