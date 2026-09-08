import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const CountRow = Schema.Struct({
  count: Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

const countOf = (rows: unknown) =>
  Schema.decodeUnknownEffect(CountRow)(
    Array.isArray(rows) ? (rows[0] ?? { count: 0 }) : rows
  ).pipe(
    Effect.map((row) => row.count),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );

export interface SqlContentPurgeReport {
  readonly captures: number;
  readonly cases: number;
  readonly claims: number;
  readonly corrections: number;
  readonly evidence: number;
  readonly frames: number;
  readonly identityDecisions: number;
  readonly pins: number;
  readonly sources: number;
  readonly viewerMemberships: number;
}

/**
 * Delete World-scoped content in FK-safe order.
 * Preserves worlds, owner membership, erasure progress/receipts, and the
 * Closing receipt chain (RequestWorldErasure receipt + its operations/outbox).
 * Does not touch erasure_attempt (separate register).
 */
export const purgeWorldSqlContent = Effect.fn("erasure.purgeWorldSqlContent")(
  function* purgeWorldSqlContent(input: {
    readonly worldRef: WorldRef;
    /** Closing receipt plus the in-flight purge receipt (operations insert precedes apply). */
    readonly closingReceiptId: string;
    readonly purgeReceiptId: string;
  }) {
    const sql = yield* SqlClient.SqlClient;
    const { worldId, realm } = input.worldRef;
    const { closingReceiptId, purgeReceiptId } = input;

    const identityDecisions = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.identity_decisions
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const corrections = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.corrections
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const cases = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.cases
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const frames = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.frames
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const pins = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.pins
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const claims = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.claims
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const evidence = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.evidence
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const sources = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.sources
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const captures = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM jobs.captures
        WHERE world_id = ${worldId} AND realm = ${realm}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );
    const viewerMemberships = yield* countOf(
      yield* sql`
      WITH deleted AS (
        DELETE FROM authority.memberships
        WHERE world_id = ${worldId} AND realm = ${realm} AND role = ${"viewer"}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM deleted
    `
    );

    // Drop non-retained outbox / operations / bootstrap / receipts.
    yield* sql`
      DELETE FROM jobs.outbox
      WHERE world_id = ${worldId} AND realm = ${realm}
        AND receipt_id <> ${closingReceiptId}
        AND receipt_id <> ${purgeReceiptId}
    `;
    yield* sql`
      DELETE FROM authority.operations
      WHERE world_id = ${worldId} AND realm = ${realm}
        AND receipt_id <> ${closingReceiptId}
        AND receipt_id <> ${purgeReceiptId}
    `;
    yield* sql`
      DELETE FROM authority.bootstrap_operations
      WHERE world_id = ${worldId} AND realm = ${realm}
        AND receipt_id <> ${closingReceiptId}
        AND receipt_id <> ${purgeReceiptId}
    `;
    yield* sql`
      DELETE FROM authority.receipts
      WHERE world_id = ${worldId} AND realm = ${realm}
        AND receipt_id <> ${closingReceiptId}
        AND receipt_id <> ${purgeReceiptId}
    `;

    const report: SqlContentPurgeReport = {
      captures,
      cases,
      claims,
      corrections,
      evidence,
      frames,
      identityDecisions,
      pins,
      sources,
      viewerMemberships,
    };
    return report;
  }
);
