import {
  RetryableInfrastructureFailure,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import { Cause, Effect } from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";

export const isTransactionConflict = (error: unknown): boolean =>
  SqlError.isSqlError(error) &&
  (error.reason._tag === "SerializationError" ||
    error.reason._tag === "DeadlockError");

/** Restore only the single SQL defect emitted by RC112 at COMMIT. */
export const restoreSqlDefect = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  self.pipe(
    Effect.catchCause((cause): Effect.Effect<never, E | SqlError.SqlError> => {
      const [reason] = cause.reasons;
      return cause.reasons.length === 1 &&
        reason !== undefined &&
        Cause.isDieReason(reason) &&
        SqlError.isSqlError(reason.defect)
        ? Effect.fail(reason.defect)
        : Effect.failCause(cause);
    })
  );

const publicSqlFailure = (error: unknown) =>
  Effect.fail(
    isTransactionConflict(error)
      ? new RetryableInfrastructureFailure({
          code: "RETRYABLE_INFRASTRUCTURE_FAILURE",
        })
      : new Unavailable({ code: "UNAVAILABLE" })
  );

export const sanitizeSqlFailure = <A, E, R>(
  self: Effect.Effect<A, E | SqlError.SqlError, R>
) => self.pipe(Effect.catchTag("SqlError", publicSqlFailure));

/** The body contains authority SQL only. Its bound intent survives every retry. */
export const serializable = Effect.fn("authority.commit.serializable")(
  function* serializable<A, E, R>(body: Effect.Effect<A, E, R>) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql
      .withTransaction(
        sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.pipe(
          Effect.andThen(body)
        )
      )
      .pipe(
        restoreSqlDefect,
        Effect.retry({ times: 2, while: isTransactionConflict }),
        sanitizeSqlFailure
      );
  }
);
