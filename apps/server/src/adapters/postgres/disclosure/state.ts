import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Effect, Schema } from "effect";

import type { Reservation } from "./connection.ts";

const Found = Schema.Tuple([Schema.Struct({ found: Schema.Boolean })]);
const found = (rows: readonly Record<string, unknown>[]) =>
  Schema.decodeUnknownEffect(Found)(rows).pipe(
    Effect.map(([row]) => row.found),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
const bumpSubject = (connection: Reservation, key: string) =>
  connection.statement(
    "INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES ($1, 1) ON CONFLICT (subject_key) DO UPDATE SET revision = disclosure_subjects.revision + 1",
    [key]
  );

/** Called only while world+session+membership shared locks are held, in canonical order. */
export const registerPending = (
  connection: Reservation,
  permitId: string,
  worldKey: string,
  writerEpoch: string,
  sessionKey: string,
  membershipKey: string
) =>
  connection.transaction(
    Effect.gen(function* insertPending() {
      const worldClosed = yield* connection
        .statement(
          "SELECT EXISTS (SELECT FROM jobs.disclosure_world_closing WHERE world_key = $1) AS found",
          [worldKey]
        )
        .pipe(Effect.flatMap(found));
      if (worldClosed) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      const closing = yield* connection
        .statement(
          "SELECT EXISTS (SELECT FROM jobs.disclosure_session_closing WHERE session_key = $1) AS found",
          [sessionKey]
        )
        .pipe(Effect.flatMap(found));
      if (closing) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      yield* bumpSubject(connection, worldKey);
      yield* bumpSubject(connection, sessionKey);
      yield* bumpSubject(connection, membershipKey);
      yield* connection.statement(
        "INSERT INTO jobs.disclosure_pending (permit_id, session_key, membership_key) VALUES ($1, $2, $3)",
        [permitId, sessionKey, membershipKey]
      );
      yield* connection.statement(
        "INSERT INTO jobs.disclosure_writer_epochs (writer_epoch, permit_id, session_key, membership_key, writer_pid, status) VALUES ($1, $2, $3, $4, $5, 'active')",
        [writerEpoch, permitId, sessionKey, membershipKey, String(process.pid)]
      );
      return yield* Effect.void;
    })
  );

/** A current READ COMMITTED transaction under the physical session exclusive. */
export const startSessionClosing = (
  connection: Reservation,
  sessionKey: string
) =>
  connection.transaction(
    Effect.gen(function* terminalSessionBarrier() {
      yield* connection.statement(
        "INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES ($1, 0) ON CONFLICT (subject_key) DO NOTHING",
        [sessionKey]
      );
      const pending = yield* connection
        .statement(
          "SELECT EXISTS (SELECT FROM jobs.disclosure_pending WHERE session_key = $1) AS found",
          [sessionKey]
        )
        .pipe(Effect.flatMap(found));
      if (pending) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      yield* connection.statement(
        "INSERT INTO jobs.disclosure_session_closing (session_key) VALUES ($1) ON CONFLICT (session_key) DO NOTHING",
        [sessionKey]
      );
      return yield* Effect.void;
    })
  );

const PendingEpoch = Schema.Tuple([
  Schema.Struct({
    membership_key: Schema.String,
    session_key: Schema.String,
    status: Schema.Literals(["active", "retired"]),
    writer_pid: Schema.Union([Schema.Finite, Schema.FiniteFromString]),
  }),
]);

/**
 * Retire one active writer epoch and advance the matching pending row.
 * Lock order: session subject bump → membership subject bump → epoch retire →
 * recovery insert → pending delete. Monotone recovery rows are never deleted.
 */
export const recoverContainedPending = (
  connection: Reservation,
  recoveryId: string,
  permitId: string,
  writerEpoch: string,
  containmentPid: number,
  containmentExitStatus: number
) =>
  connection.transaction(
    Effect.gen(function* recoverPending() {
      const rows = yield* connection.statement(
        `SELECT e.session_key, e.membership_key, e.status, e.writer_pid
         FROM jobs.disclosure_writer_epochs AS e
         INNER JOIN jobs.disclosure_pending AS p ON p.permit_id = e.permit_id
         WHERE e.writer_epoch = $1 AND e.permit_id = $2
         FOR UPDATE OF e`,
        [writerEpoch, permitId]
      );
      const decoded = yield* Schema.decodeUnknownEffect(PendingEpoch)(
        rows
      ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
      if (decoded.length !== 1) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      const [
        {
          membership_key: membershipKey,
          session_key: sessionKey,
          status,
          writer_pid: boundPid,
        },
      ] = decoded;
      if (status !== "active") {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      if (boundPid !== containmentPid) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      yield* bumpSubject(connection, sessionKey);
      yield* bumpSubject(connection, membershipKey);
      yield* connection.statement(
        "UPDATE jobs.disclosure_writer_epochs SET status = 'retired', retired_at = clock_timestamp() WHERE writer_epoch = $1 AND status = 'active'",
        [writerEpoch]
      );
      yield* connection.statement(
        `INSERT INTO jobs.disclosure_recovery (
          recovery_id, permit_id, writer_epoch, session_key, membership_key,
          containment_kind, containment_pid, containment_exit_status
        ) VALUES ($1, $2, $3, $4, $5, 'supervisor_process_exit', $6, $7)`,
        [
          recoveryId,
          permitId,
          writerEpoch,
          sessionKey,
          membershipKey,
          String(containmentPid),
          String(containmentExitStatus),
        ]
      );
      yield* connection.statement(
        "DELETE FROM jobs.disclosure_pending WHERE permit_id = $1",
        [permitId]
      );
      return yield* Effect.void;
    })
  );
