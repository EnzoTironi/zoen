import { createHash } from "node:crypto";

import { ErasureAttemptExternalState } from "@zoen/contracts/erasure/values";
import { Conflict, Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Digest, exact } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql";

import { canonicalJson } from "../../values/canonical.js";
import { ErasureExternalAnchor } from "./anchor.js";
import type {
  ErasureAttemptIdentity,
  ErasureAttemptIntention,
  ErasureAttemptObservation,
  ErasureWorldSuppressionObservation,
} from "./attempt-register.js";
import { ErasureAttemptRegister } from "./attempt-register.js";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const conflict = () => new Conflict({ code: "CONFLICT" });

/**
 * Candidate DDL for an isolated register schema (not authority.*).
 * Tests apply this against a disposable DB; root numbers ops/migrations.
 * Includes monotone controller head for ZA-11 freshness proofs.
 */
export const erasureAttemptSchemaSql = `
CREATE SCHEMA IF NOT EXISTS erasure_attempt;

CREATE TABLE IF NOT EXISTS erasure_attempt.attempts (
  deployment_epoch text COLLATE "C" NOT NULL,
  operation_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  intention_digest text COLLATE "C" NOT NULL
    CHECK (intention_digest ~ '^[0-9a-f]{64}$'),
  state text COLLATE "C" NOT NULL
    CHECK (state IN ('Registered', 'Confirmed', 'Aborted', 'Unknown')),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  PRIMARY KEY (deployment_epoch, operation_id),
  CHECK (
    (state IN ('Registered', 'Unknown') AND resolved_at IS NULL)
    OR (state IN ('Confirmed', 'Aborted') AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS erasure_attempts_world
  ON erasure_attempt.attempts (world_id, realm, state);

CREATE TABLE IF NOT EXISTS erasure_attempt.controller_head (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sequence bigint NOT NULL CHECK (sequence >= 0),
  head_digest text COLLATE "C" NOT NULL
    CHECK (head_digest ~ '^[0-9a-f]{64}$'),
  pending_sequence bigint
    CHECK (pending_sequence IS NULL OR pending_sequence > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    pending_sequence IS NULL OR pending_sequence = sequence
  )
);

INSERT INTO erasure_attempt.controller_head (singleton, sequence, head_digest, pending_sequence)
VALUES (true, 0, repeat('0', 64), NULL)
ON CONFLICT (singleton) DO NOTHING;
`;

export const applyErasureAttemptSchema = Effect.fn(
  "erasureAttempt.applySchema"
)(function* applyErasureAttemptSchema() {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(sql.unsafe(erasureAttemptSchemaSql));
});

const AttemptRow = Schema.Struct({
  intention_digest: Digest,
  principal_id: Schema.String.check(Schema.isUUID()),
  realm: Schema.Literal("live"),
  state: ErasureAttemptExternalState,
  world_id: Schema.String.check(Schema.isUUID()),
}).annotate(exact);

const HeadRow = Schema.Struct({
  head_digest: Digest,
  pending_sequence: Schema.NullOr(Schema.String),
  sequence: Schema.String,
}).annotate(exact);

const WorldStateRow = Schema.Struct({
  state: ErasureAttemptExternalState,
}).annotate(exact);

const observe = (
  state: ErasureAttemptExternalState
): ErasureAttemptObservation => ({ state });

const intentionDigestOf = (intention: ErasureAttemptIntention) =>
  canonicalJson({
    confirmEntireWorld: intention.confirmEntireWorld,
    expectedErasureRevision: intention.expectedErasureRevision,
    policyVersion: intention.policyVersion,
  }).pipe(
    Effect.mapError(() => unavailable()),
    Effect.map((canonical) =>
      Schema.decodeSync(Digest)(
        createHash("sha256")
          .update(`zoen:erasure:intention:v1\n${canonical}`, "utf-8")
          .digest("hex")
      )
    )
  );

const identityMatches = (
  identity: ErasureAttemptIdentity,
  row: typeof AttemptRow.Type
): boolean =>
  row.principal_id === identity.principalId &&
  row.world_id === identity.worldRef.worldId &&
  row.realm === identity.worldRef.realm;

const headDigestOf = (sequence: bigint, priorDigest: string) =>
  Schema.decodeSync(Digest)(
    createHash("sha256")
      .update(
        `zoen:erasure:controller-head:v1\n${sequence}\n${priorDigest}`,
        "utf-8"
      )
      .digest("hex")
  );

const preferWorldState = (
  states: readonly ErasureAttemptExternalState[]
): ErasureWorldSuppressionObservation => {
  if (states.includes("Confirmed")) {
    return observe("Confirmed");
  }
  if (states.includes("Registered")) {
    return observe("Registered");
  }
  if (states.includes("Unknown")) {
    return observe("Unknown");
  }
  return { state: "Clear" };
};

interface AnchorService {
  readonly inspect: Effect.Effect<
    { readonly admittedSequence: bigint },
    Unavailable
  >;
  readonly advance: (
    sequence: bigint
  ) => Effect.Effect<{ readonly admittedSequence: bigint }, Unavailable>;
}

const buildRegister = (options: {
  readonly sql: SqlClient.SqlClient;
  readonly requireFreshAnchor: boolean;
  readonly anchor: AnchorService | null;
}) => {
  const { sql, requireFreshAnchor, anchor } = options;

  const loadHead = Effect.gen(function* loadControllerHead() {
    const rows = yield* sql`
      SELECT sequence::text, head_digest, pending_sequence::text AS pending_sequence
      FROM erasure_attempt.controller_head
      WHERE singleton = true
    `.pipe(Effect.mapError(() => unavailable()));
    const decoded = yield* Schema.decodeUnknownEffect(Schema.Array(HeadRow))(
      rows
    ).pipe(Effect.mapError(() => unavailable()));
    if (decoded.length !== 1 || decoded[0] === undefined) {
      return yield* unavailable();
    }
    return {
      digest: decoded[0].head_digest,
      pending:
        decoded[0].pending_sequence === null
          ? null
          : BigInt(decoded[0].pending_sequence),
      sequence: BigInt(decoded[0].sequence),
    };
  });

  const clearPending = (sequence: bigint) =>
    sql`
      UPDATE erasure_attempt.controller_head
      SET pending_sequence = NULL, updated_at = clock_timestamp()
      WHERE singleton = true
        AND sequence = ${sequence.toString()}
        AND pending_sequence = ${sequence.toString()}
    `.pipe(
      Effect.mapError(() => unavailable()),
      Effect.asVoid
    );

  // Recover interrupted DB→anchor commits; reject genuine rollbacks (behind).
  const ensureFresh =
    requireFreshAnchor && anchor !== null
      ? Effect.gen(function* ensureControllerFresh() {
          const head = yield* loadHead;
          let admitted = yield* anchor.inspect;
          if (head.pending !== null && head.pending === head.sequence) {
            if (admitted.admittedSequence + 1n === head.sequence) {
              // Crash window: DB committed forward, external anchor still lagging.
              admitted = yield* anchor.advance(head.sequence);
              yield* clearPending(head.sequence);
            } else if (admitted.admittedSequence === head.sequence) {
              yield* clearPending(head.sequence);
            } else {
              return yield* unavailable();
            }
          } else if (head.pending !== null) {
            return yield* unavailable();
          }
          if (head.sequence !== admitted.admittedSequence) {
            return yield* unavailable();
          }
          return yield* Effect.void;
        })
      : Effect.void;

  /** Advance DB head (+ pending flag when anchored) inside the caller's transaction. */
  const bumpHeadInTransaction = Effect.gen(function* bumpControllerHeadTx() {
    const head = yield* loadHead;
    if (head.pending !== null) {
      return yield* unavailable();
    }
    const nextSequence = head.sequence + 1n;
    const nextDigest = headDigestOf(nextSequence, head.digest);
    const updated = yield* (
      requireFreshAnchor
        ? sql`
            UPDATE erasure_attempt.controller_head
            SET sequence = ${nextSequence.toString()},
                head_digest = ${nextDigest},
                pending_sequence = ${nextSequence.toString()},
                updated_at = clock_timestamp()
            WHERE singleton = true
              AND sequence = ${head.sequence.toString()}
              AND head_digest = ${head.digest}
              AND pending_sequence IS NULL
            RETURNING sequence::text
          `
        : sql`
            UPDATE erasure_attempt.controller_head
            SET sequence = ${nextSequence.toString()},
                head_digest = ${nextDigest},
                updated_at = clock_timestamp()
            WHERE singleton = true
              AND sequence = ${head.sequence.toString()}
              AND head_digest = ${head.digest}
              AND pending_sequence IS NULL
            RETURNING sequence::text
          `
    ).pipe(Effect.mapError(() => unavailable()));
    if (updated.length !== 1) {
      return yield* unavailable();
    }
    return nextSequence;
  });

  const completeAnchor = (nextSequence: bigint) =>
    requireFreshAnchor && anchor !== null
      ? Effect.gen(function* mirrorExternalAnchor() {
          yield* anchor.advance(nextSequence);
          yield* clearPending(nextSequence);
        })
      : Effect.void;

  const load = (identity: ErasureAttemptIdentity) =>
    Effect.gen(function* loadAttempt() {
      const rows = yield* sql`
        SELECT principal_id, world_id, realm, intention_digest, state
        FROM erasure_attempt.attempts
        WHERE deployment_epoch = ${identity.deploymentEpoch}
          AND operation_id = ${identity.operationId}
      `.pipe(Effect.mapError(() => unavailable()));
      const decoded = yield* Schema.decodeUnknownEffect(
        Schema.Array(AttemptRow)
      )(rows).pipe(Effect.mapError(() => unavailable()));
      if (decoded.length === 0) {
        return { _tag: "missing" as const };
      }
      if (decoded.length !== 1) {
        return { _tag: "unknown" as const };
      }
      const [row] = decoded;
      if (row === undefined || !identityMatches(identity, row)) {
        return yield* conflict();
      }
      return {
        _tag: "row" as const,
        digest: row.intention_digest,
        state: row.state,
      };
    });

  const observeWorld = (worldRef: WorldRef) =>
    Effect.gen(function* observeWorldSuppression() {
      const fresh = yield* Effect.result(ensureFresh);
      if (fresh._tag === "Failure") {
        // Stale or unrecoverable controller ⇒ Unknown blocks admission (F06).
        return observe("Unknown");
      }
      const rows = yield* sql`
        SELECT state
        FROM erasure_attempt.attempts
        WHERE world_id = ${worldRef.worldId}
          AND realm = ${worldRef.realm}
          AND (
            state = ${"Registered"}
            OR state = ${"Confirmed"}
            OR state = ${"Unknown"}
          )
      `.pipe(Effect.mapError(() => unavailable()));
      const decoded = yield* Schema.decodeUnknownEffect(
        Schema.Array(WorldStateRow)
      )(rows).pipe(Effect.mapError(() => unavailable()));
      return preferWorldState(decoded.map((row) => row.state));
    });

  return ErasureAttemptRegister.of({
    inspect: (identity) =>
      Effect.gen(function* inspectAttempt() {
        yield* ensureFresh;
        const existing = yield* load(identity);
        if (existing._tag === "missing") {
          return yield* unavailable();
        }
        if (existing._tag === "unknown") {
          return observe("Unknown");
        }
        return observe(existing.state);
      }),
    mirrorLocalOutcome: (identity, outcome) =>
      Effect.gen(function* mirrorOutcome() {
        yield* ensureFresh;
        const mirrored = yield* sql
          .withTransaction(
            Effect.gen(function* mutateAndBump() {
              const updated = yield* sql`
                UPDATE erasure_attempt.attempts
                SET state = ${outcome}, resolved_at = clock_timestamp()
                WHERE deployment_epoch = ${identity.deploymentEpoch}
                  AND operation_id = ${identity.operationId}
                  AND principal_id = ${identity.principalId}
                  AND world_id = ${identity.worldRef.worldId}
                  AND realm = ${identity.worldRef.realm}
                  AND state = ${"Registered"}
                RETURNING state
              `.pipe(Effect.mapError(() => unavailable()));
              if (updated.length === 1) {
                const next = yield* bumpHeadInTransaction;
                return { _tag: "bumped" as const, next, state: outcome };
              }
              return { _tag: "missing" as const };
            })
          )
          .pipe(Effect.mapError(() => unavailable()));
        if (mirrored._tag === "bumped") {
          yield* completeAnchor(mirrored.next);
          return observe(mirrored.state);
        }
        const existing = yield* load(identity);
        if (existing._tag === "missing") {
          return yield* unavailable();
        }
        if (existing._tag === "unknown") {
          return observe("Unknown");
        }
        if (existing.state === outcome) {
          return observe(outcome);
        }
        if (existing.state === "Confirmed" || existing.state === "Aborted") {
          return yield* conflict();
        }
        if (existing.state === "Unknown") {
          return observe("Unknown");
        }
        return yield* unavailable();
      }),
    observeWorld,
    register: (identity, intention) =>
      Effect.gen(function* registerAttempt() {
        yield* ensureFresh;
        const digest = yield* intentionDigestOf(intention);
        const registered = yield* sql
          .withTransaction(
            Effect.gen(function* insertAndBump() {
              const inserted = yield* sql`
                INSERT INTO erasure_attempt.attempts (
                  deployment_epoch, operation_id, principal_id, world_id, realm,
                  intention_digest, state
                ) VALUES (
                  ${identity.deploymentEpoch}, ${identity.operationId},
                  ${identity.principalId}, ${identity.worldRef.worldId},
                  ${identity.worldRef.realm}, ${digest}, ${"Registered"}
                )
                ON CONFLICT (deployment_epoch, operation_id) DO NOTHING
                RETURNING state
              `.pipe(
                Effect.catchTag("SqlError", (error: SqlError.SqlError) => {
                  if (error.reason._tag === "UniqueViolation") {
                    return Effect.succeed([] as readonly unknown[]);
                  }
                  return Effect.fail(unavailable());
                })
              );
              if (inserted.length > 0) {
                const next = yield* bumpHeadInTransaction;
                return { _tag: "bumped" as const, next };
              }
              return { _tag: "conflict" as const };
            })
          )
          .pipe(Effect.mapError(() => unavailable()));
        if (registered._tag === "bumped") {
          yield* completeAnchor(registered.next);
          return observe("Registered");
        }
        const existing = yield* load(identity);
        if (existing._tag === "missing" || existing._tag === "unknown") {
          return observe("Unknown");
        }
        if (existing.digest !== digest) {
          return yield* conflict();
        }
        // Proved Abort of the same intention may retry: re-arm Registered + head.
        if (existing.state === "Aborted") {
          const rearmed = yield* sql
            .withTransaction(
              Effect.gen(function* rearmAborted() {
                const updated = yield* sql`
                  UPDATE erasure_attempt.attempts
                  SET state = ${"Registered"}, resolved_at = NULL
                  WHERE deployment_epoch = ${identity.deploymentEpoch}
                    AND operation_id = ${identity.operationId}
                    AND intention_digest = ${digest}
                    AND state = ${"Aborted"}
                  RETURNING state
                `.pipe(Effect.mapError(() => unavailable()));
                if (updated.length !== 1) {
                  return { _tag: "missing" as const };
                }
                const next = yield* bumpHeadInTransaction;
                return { _tag: "bumped" as const, next };
              })
            )
            .pipe(Effect.mapError(() => unavailable()));
          if (rearmed._tag === "bumped") {
            yield* completeAnchor(rearmed.next);
            return observe("Registered");
          }
          return observe("Unknown");
        }
        return observe(existing.state);
      }),
  });
};

/**
 * Local durable register. Provide SqlClient from a pool/database that does not
 * share the Closing transaction rollback unit (dedicated DB or at least a
 * separate committed connection). Does not authorize Closing or purge.
 * Without an external anchor this does **not** claim anti-rollback independence.
 */
export const localErasureAttemptRegisterLayer: Layer.Layer<
  ErasureAttemptRegister,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  ErasureAttemptRegister,
  Effect.gen(function* buildLocalRegister() {
    const sql = yield* SqlClient.SqlClient;
    return buildRegister({
      anchor: null,
      requireFreshAnchor: false,
      sql,
    });
  })
);

/**
 * Local narrow independent controller (ZA-11): register mutations advance a
 * monotone controller head and the external file/volume anchor together.
 * Stale restored heads fail closed against the admitted anchor.
 */
export const anchoredLocalErasureAttemptRegisterLayer: Layer.Layer<
  ErasureAttemptRegister,
  never,
  SqlClient.SqlClient | ErasureExternalAnchor
> = Layer.effect(
  ErasureAttemptRegister,
  Effect.gen(function* buildAnchoredRegister() {
    const sql = yield* SqlClient.SqlClient;
    const anchor = yield* ErasureExternalAnchor;
    return buildRegister({
      anchor,
      requireFreshAnchor: true,
      sql,
    });
  })
);
