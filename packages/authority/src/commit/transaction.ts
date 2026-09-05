import {
  RetryableInfrastructureFailure,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { Cause, Effect } from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";

export const isTransactionConflict = (error: unknown): boolean =>
  SqlError.isSqlError(error) &&
  (error.reason._tag === "SerializationError" ||
    error.reason._tag === "DeadlockError");

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
        Effect.catchCause((cause) => {
          const [reason] = cause.reasons;
          // RC112 turns COMMIT failures into a single SQL defect. Restore only
          // that typed failure; preserve mixed causes and interruptions.
          return cause.reasons.length === 1 &&
            reason !== undefined &&
            Cause.isDieReason(reason) &&
            SqlError.isSqlError(reason.defect)
            ? Effect.fail(reason.defect)
            : Effect.failCause(cause);
        }),
        Effect.retry({ times: 2, while: isTransactionConflict }),
        Effect.catchTag("SqlError", (error) =>
          Effect.fail(
            isTransactionConflict(error)
              ? new RetryableInfrastructureFailure({
                  code: "RETRYABLE_INFRASTRUCTURE_FAILURE",
                })
              : new Unavailable({ code: "UNAVAILABLE" })
          )
        )
      );
  }
);
