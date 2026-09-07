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
  sessionKey: string,
  membershipKey: string
) =>
  connection.transaction(
    Effect.gen(function* insertPending() {
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
