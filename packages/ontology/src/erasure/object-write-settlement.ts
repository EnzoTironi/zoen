import { randomUUID } from "node:crypto";

import { Blocked, Expired, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type {
  ObjectWriteAttemptState,
  ObjectWriteSettlementEvidence,
  StorageFenceQualification,
} from "../ports/erasure/object-write.js";

const AttemptState = Schema.Literals([
  "registered",
  "external_submitted",
  "terminal_observed",
  "unknown",
]);

/**
 * Honest G-STORAGE-FENCE for the selected RustFS/S3 profile:
 * Object Lock proves hold enforcement, not late-PUT / credential retirement fencing.
 */
export const observeStorageFenceQualification = (): StorageFenceQualification =>
  "Blocked";

/** Register durable intent before any external object send (same TX as capture reserve). */
export const registerObjectWriteAttempt = Effect.fn(
  "erasure.registerObjectWriteAttempt"
)(function* registerObjectWriteAttempt(input: {
  readonly world: WorldRef;
  readonly captureId: string;
  readonly erasureEpoch: string;
  readonly objectKey: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const attemptId = randomUUID();
  yield* sql`
    INSERT INTO jobs.object_write_attempts
      (attempt_id, world_id, realm, capture_id, erasure_epoch, object_key, state)
    VALUES (
      ${attemptId}, ${input.world.worldId}, ${input.world.realm},
      ${input.captureId}, ${input.erasureEpoch}, ${input.objectKey}, 'registered'
    )
  `;
  return attemptId;
});

/** Mark provider I/O as started — must precede PutObject. */
export const markObjectWriteSubmitted = Effect.fn(
  "erasure.markObjectWriteSubmitted"
)(function* markObjectWriteSubmitted(input: {
  readonly world: WorldRef;
  readonly captureId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  // Refuse submit once cleanup/purge moved the capture off reserved — closes the
  // late stageCapture race before PutObject (G-STORAGE-FENCE still Blocked for
  // already-submitted I/O).
  const rows = yield* sql`
    UPDATE jobs.object_write_attempts AS a
    SET state = 'external_submitted',
        submitted_at = clock_timestamp()
    FROM jobs.captures AS c
    WHERE a.world_id = ${input.world.worldId} AND a.realm = ${input.world.realm}
      AND a.capture_id = ${input.captureId} AND a.state = 'registered'
      AND c.world_id = a.world_id AND c.realm = a.realm AND c.capture_id = a.capture_id
      AND c.state = 'reserved'
    RETURNING a.attempt_id::text AS attempt_id
  `;
  if (rows.length !== 1) {
    // Cleanup/expiration fencing must surface Expired (EX08). Missing attempt,
    // non-registered attempt, or other ledger faults stay Unavailable (ZA-10
    // settlement fail-closed).
    const status = yield* sql`
      SELECT a.state AS attempt_state, c.state AS capture_state
      FROM jobs.object_write_attempts AS a
      LEFT JOIN jobs.captures AS c
        ON c.world_id = a.world_id AND c.realm = a.realm AND c.capture_id = a.capture_id
      WHERE a.world_id = ${input.world.worldId} AND a.realm = ${input.world.realm}
        AND a.capture_id = ${input.captureId}
    `;
    if (status.length === 1) {
      const denied = yield* Schema.decodeUnknownEffect(
        Schema.Struct({
          attempt_state: Schema.String,
          capture_state: Schema.NullOr(Schema.String),
        })
      )(status[0]).pipe(
        Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
      );
      if (
        denied.attempt_state === "registered" &&
        (denied.capture_state === null ||
          denied.capture_state === "cleanup_pending" ||
          denied.capture_state === "removed")
      ) {
        return yield* new Expired({ code: "EXPIRED" });
      }
    }
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Schema.decodeUnknownEffect(
    Schema.Struct({ attempt_id: Schema.String })
  )(rows[0]).pipe(
    Effect.map((row) => row.attempt_id),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
});

/** Definitive provider terminal (success or definite failure observed by runtime). */
export const markObjectWriteTerminal = Effect.fn(
  "erasure.markObjectWriteTerminal"
)(function* markObjectWriteTerminal(input: {
  readonly world: WorldRef;
  readonly captureId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    UPDATE jobs.object_write_attempts
    SET state = 'terminal_observed',
        resolved_at = clock_timestamp()
    WHERE world_id = ${input.world.worldId} AND realm = ${input.world.realm}
      AND capture_id = ${input.captureId}
      AND state IN ('external_submitted', 'unknown')
    RETURNING attempt_id::text AS attempt_id
  `;
  if (rows.length !== 1) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});

/** Ambiguous provider outcome — sticky until independent containment (unqualified). */
export const markObjectWriteUnknown = Effect.fn(
  "erasure.markObjectWriteUnknown"
)(function* markObjectWriteUnknown(input: {
  readonly world: WorldRef;
  readonly captureId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    UPDATE jobs.object_write_attempts
    SET state = 'unknown',
        resolved_at = clock_timestamp()
    WHERE world_id = ${input.world.worldId} AND realm = ${input.world.realm}
      AND capture_id = ${input.captureId}
      AND state IN ('external_submitted', 'registered')
  `;
  return yield* Effect.void;
});

/**
 * Apply settlement evidence without inventing containment.
 * Only ProviderTerminal may clear submitted/unknown into terminal_observed.
 */

/** Fail-closed classifier for evidence that never settles without a provider terminal. */
export const refuseNonTerminalSettlementEvidence = (
  evidence: ObjectWriteSettlementEvidence
): evidence is Extract<
  ObjectWriteSettlementEvidence,
  {
    readonly _tag:
      | "HeadNotFound"
      | "CredentialRetirement"
      | "NetworkDisconnect"
      | "TtlExpired";
  }
> =>
  evidence._tag === "HeadNotFound" ||
  evidence._tag === "CredentialRetirement" ||
  evidence._tag === "NetworkDisconnect" ||
  evidence._tag === "TtlExpired";

export const applyObjectWriteSettlementEvidence = Effect.fn(
  "erasure.applyObjectWriteSettlementEvidence"
)(function* applyObjectWriteSettlementEvidence(
  evidence: ObjectWriteSettlementEvidence
) {
  if (refuseNonTerminalSettlementEvidence(evidence)) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  if (evidence._tag === "ProviderTerminal") {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      UPDATE jobs.object_write_attempts
      SET state = 'terminal_observed',
          resolved_at = clock_timestamp()
      WHERE attempt_id = ${evidence.attemptId}::uuid
        AND state IN ('external_submitted', 'unknown')
      RETURNING state
    `;
    if (rows.length !== 1) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return "terminal_observed" as const satisfies ObjectWriteAttemptState;
  }
  if (evidence._tag === "ClientCancelled") {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
      UPDATE jobs.object_write_attempts
      SET state = 'unknown',
          submitted_at = COALESCE(submitted_at, clock_timestamp()),
          resolved_at = clock_timestamp()
      WHERE attempt_id = ${evidence.attemptId}::uuid
        AND state IN ('registered', 'external_submitted')
      RETURNING state
    `;
    if (rows.length === 1) {
      return "unknown" as const satisfies ObjectWriteAttemptState;
    }
    const current = yield* sql`
      SELECT state FROM jobs.object_write_attempts
      WHERE attempt_id = ${evidence.attemptId}::uuid
    `;
    if (current.length !== 1) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return yield* Schema.decodeUnknownEffect(
      Schema.Struct({ state: AttemptState })
    )(current[0]).pipe(
      Effect.map((row) => row.state),
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
  return yield* new Unavailable({ code: "UNAVAILABLE" });
});

/**
 * Block purge completion while any non-terminal attempt exists under the World.
 * Includes registered (not yet sent) and sticky unknown.
 */
export const requireSettledObjectWriters = Effect.fn(
  "erasure.requireSettledObjectWriters"
)(function* requireSettledObjectWriters(world: WorldRef) {
  const sql = yield* SqlClient.SqlClient;
  // external_submitted / unknown always block (even if capture was marked removed
  // after HEAD 404). registered without external send is fine once the capture is
  // durable `removed` — same rule as requireSettledCaptures.
  const uncertain = yield* sql`
    SELECT a.attempt_id
    FROM jobs.object_write_attempts AS a
    LEFT JOIN jobs.captures AS c
      ON c.world_id = a.world_id AND c.realm = a.realm AND c.capture_id = a.capture_id
    WHERE a.world_id = ${world.worldId} AND a.realm = ${world.realm}
      AND (
        a.state IN ('external_submitted', 'unknown')
        OR (
          a.state = 'registered'
          AND (c.capture_id IS NULL OR c.state <> 'removed')
        )
      )
    LIMIT 1
  `;
  if (uncertain.length !== 0) {
    return yield* new Unavailable({ code: "UNAVAILABLE" });
  }
  return yield* Effect.void;
});
