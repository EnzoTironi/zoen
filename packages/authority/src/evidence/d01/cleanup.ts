import { Blocked, Unavailable } from "@zoen/contracts/d01/errors";
import {
  Digest,
  DocumentFormat,
  Instant,
  Revision,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { serializable } from "../../commit/transaction.js";
import { DataPolicy, DataPolicySchema } from "../../ports/d01/context.js";
import { CaptureId, EvidenceObjectStore } from "../../ports/d01/storage.js";

export const CaptureSweepCursor = Schema.Struct({
  captureId: CaptureId,
  expiresAt: Instant,
}).annotate(exact);
export type CaptureSweepCursor = typeof CaptureSweepCursor.Type;
const Candidate = Schema.Struct({
  byte_length: Schema.Int,
  capture_id: CaptureId,
  document_format: DocumentFormat,
  expected_digest: Digest,
  expires_at: Instant,
  fence: Revision,
}).annotate(exact);
const batchSize = 32;

/** Private maintenance operation; the server supplies its SQL/storage credentials. */
export const sweepExpiredCaptures = Effect.fn(
  "authority.evidence.sweepExpiredCaptures"
)(function* sweepExpiredCaptures(
  worldRef: WorldRef,
  after: CaptureSweepCursor | null
) {
  const world = yield* Schema.decodeEffect(WorldRef)(worldRef).pipe(
    Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" }))
  );
  const policy = yield* Schema.decodeEffect(DataPolicySchema)(
    yield* DataPolicy
  ).pipe(Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" })));
  if (world.realm !== policy.enabledRealm) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  const cursor = yield* Schema.decodeEffect(Schema.NullOr(CaptureSweepCursor))(
    after
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  const sql = yield* SqlClient.SqlClient;
  const [profile] =
    yield* sql`SELECT data_policy_id FROM authority.worlds WHERE world_id = ${world.worldId} AND realm = ${world.realm}`;
  const admitted = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ data_policy_id: Schema.Literal(policy.profileId) })
  )(profile).pipe(
    Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" }))
  );
  const next =
    cursor === null
      ? sql`true`
      : sql`(expires_at, capture_id) > (${cursor.expiresAt}::timestamptz, ${cursor.captureId}::uuid)`;
  const rows = yield* sql`
      SELECT byte_length, capture_id, document_format, expected_digest, fence::text,
        to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS expires_at
      FROM jobs.captures
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND state <> 'admitted' AND expires_at <= clock_timestamp() AND ${next}
      ORDER BY expires_at, capture_id LIMIT ${batchSize}
    `;
  const candidates = yield* Schema.decodeUnknownEffect(Schema.Array(Candidate))(
    rows
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  const store = yield* EvidenceObjectStore;
  for (const candidate of candidates) {
    const claimed = yield* serializable(
      Effect.gen(function* claimExpiredCapture() {
        const [locked] = yield* sql`
          SELECT c.fence::text FROM jobs.captures c
          JOIN authority.worlds w USING (world_id, realm)
          WHERE c.world_id = ${world.worldId} AND c.realm = ${world.realm} AND c.capture_id = ${candidate.capture_id}
            AND c.state <> 'admitted' AND c.expires_at <= clock_timestamp() AND w.data_policy_id = ${admitted.data_policy_id}
            AND NOT EXISTS (SELECT 1 FROM authority.evidence e WHERE e.world_id = c.world_id AND e.realm = c.realm AND e.capture_id = c.capture_id)
          FOR UPDATE OF c
        `;
        if (locked === undefined) {
          return null;
        }
        const row = yield* Schema.decodeUnknownEffect(
          Schema.Struct({ fence: Revision })
        )(locked).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
        const fence = yield* Schema.decodeEffect(Revision)(
          (BigInt(row.fence) + 1n).toString()
        ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
        yield* sql`UPDATE jobs.captures SET state = 'cleanup_pending', fence = ${fence}
          WHERE world_id = ${world.worldId} AND realm = ${world.realm} AND capture_id = ${candidate.capture_id}`;
        return fence;
      })
    );
    if (claimed === null) {
      continue;
    }
    const location = yield* store
      .locateDocument({
        captureId: candidate.capture_id,
        documentFormat: candidate.document_format,
        expectedBytes: candidate.byte_length,
        expectedDigest: candidate.expected_digest,
        worldRef: world,
      })
      .pipe(
        Effect.catchTag("StorageFailure", (error) =>
          error.reason === "NotFound"
            ? Effect.succeed(null)
            : Effect.fail(new Unavailable({ code: "UNAVAILABLE" }))
        )
      );
    if (location !== null) {
      yield* store
        .remove(location)
        .pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    }
    yield* serializable(sql`UPDATE jobs.captures c SET state = 'removed'
        WHERE c.world_id = ${world.worldId} AND c.realm = ${world.realm} AND c.capture_id = ${candidate.capture_id}
          AND c.fence = ${claimed} AND c.state = 'cleanup_pending'
          AND NOT EXISTS (SELECT 1 FROM authority.evidence e WHERE e.world_id = c.world_id AND e.realm = c.realm AND e.capture_id = c.capture_id)`);
  }
  const last = candidates.at(-1);
  return {
    nextCursor:
      candidates.length === batchSize && last !== undefined
        ? { captureId: last.capture_id, expiresAt: last.expires_at }
        : null,
    visited: candidates.length,
  };
});
