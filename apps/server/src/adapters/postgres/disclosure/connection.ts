import { Expired, Unavailable } from "@zoen/contracts/worlds/errors";
import { Deferred, Effect } from "effect";
import type { Pool, PoolClient } from "pg";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const expired = () => new Expired({ code: "EXPIRED" });

export interface Lock {
  readonly key: string;
  readonly shared: boolean;
}

/** A reservation is never returned while a query or a session lock is uncertain. */
export class Reservation {
  readonly locks: Lock[] = [];
  readonly client: PoolClient;
  released = false;
  transactionOpen = false;
  cleanup: Deferred.Deferred<null> | null = null;
  onLost: (() => void) | null = null;
  constructor(client: PoolClient) {
    this.client = client;
    client.on("error", this.connectionLost);
    client.on("end", this.connectionLost);
  }
  readonly connectionLost = () => {
    const notify = this.onLost;
    this.onLost = null;
    this.destroy();
    notify?.();
  };
  readonly destroy = () => {
    this.onLost = null;
    if (!this.released) {
      this.released = true;
      this.client.release(true);
    }
  };
  readonly query = (operation: string, key: string, acquired?: Lock) =>
    Effect.callback<boolean, Unavailable>((resume) => {
      if (this.released) {
        resume(Effect.fail(unavailable()));
      } else {
        // Native callbacks bind cancellation to physical client disposal.
        this.client.query<{ confirmed: boolean }>(
          `SELECT ${operation}(hashtextextended($1, 0)) AS confirmed`,
          [key],
          // oxlint-disable-next-line promise/prefer-await-to-callbacks
          (error, result) => {
            const confirmed = result?.rows[0]?.confirmed;
            if (
              error !== null ||
              this.released ||
              result?.rows.length !== 1 ||
              typeof confirmed !== "boolean"
            ) {
              this.destroy();
              resume(Effect.fail(unavailable()));
            } else {
              if (confirmed && acquired !== undefined) {
                this.locks.push(acquired);
              }
              resume(Effect.succeed(confirmed));
            }
          }
        );
      }
      return Effect.sync(this.destroy);
    });
  readonly statement = (text: string, values: readonly string[] = []) =>
    Effect.callback<readonly Record<string, unknown>[], Unavailable>(
      (resume) => {
        if (this.released) {
          resume(Effect.fail(unavailable()));
        } else {
          this.client.query<Record<string, unknown>>(
            text,
            [...values],
            // Cancellation must destroy this physical session, including an open transaction.
            // oxlint-disable-next-line promise/prefer-await-to-callbacks
            (error, result) => {
              if (error !== null || this.released) {
                this.destroy();
                resume(Effect.fail(unavailable()));
              } else {
                resume(Effect.succeed(result.rows));
              }
            }
          );
        }
        return Effect.sync(this.destroy);
      }
    );
  readonly transaction = <A, E, R>(body: Effect.Effect<A, E, R>) =>
    Effect.gen({ self: this }, function* currentTransaction() {
      this.transactionOpen = true;
      yield* this.statement("BEGIN ISOLATION LEVEL READ COMMITTED");
      const result = yield* body;
      yield* this.statement("COMMIT");
      this.transactionOpen = false;
      return result;
    }).pipe(Effect.onError(() => Effect.sync(this.destroy)));
  readonly closeOnce = () =>
    Effect.gen({ self: this }, function* closeReservation() {
      this.onLost = null;
      if (this.transactionOpen) {
        this.destroy();
      }
      if (this.released) {
        return;
      }
      for (const lock of this.locks.toReversed()) {
        const unlocked = yield* this.query(
          lock.shared ? "pg_advisory_unlock_shared" : "pg_advisory_unlock",
          lock.key
        ).pipe(
          Effect.interruptible,
          Effect.timeout("3 seconds"),
          Effect.catch(() =>
            Effect.sync(() => {
              this.destroy();
              return false;
            })
          )
        );
        if (!unlocked) {
          this.destroy();
          return;
        }
      }
      if (!this.released) {
        this.released = true;
        this.client.removeListener("error", this.connectionLost);
        this.client.removeListener("end", this.connectionLost);
        this.client.release();
      }
    });
  readonly close = () =>
    Effect.suspend(() => {
      if (this.cleanup !== null) {
        return Deferred.await(this.cleanup);
      }
      const done = Deferred.makeUnsafe<null>();
      this.cleanup = done;
      return this.closeOnce().pipe(
        Effect.as(null),
        Effect.onExit((exit) => Deferred.done(done, exit))
      );
    }).pipe(Effect.uninterruptible);
  readonly attempt = (lock: Lock, millis: number) =>
    this.query(
      lock.shared ? "pg_try_advisory_lock_shared" : "pg_try_advisory_lock",
      lock.key,
      lock
    ).pipe(
      Effect.interruptible,
      Effect.timeoutOrElse({
        duration: millis,
        orElse: () => Effect.fail(expired()),
      })
    );
}

export const reserve = (pool: Pool, millis: number) =>
  Effect.callback<Reservation, Unavailable>((resume) => {
    let cancelled = false;
    // The callback must dispose a connection delivered after interruption.
    // oxlint-disable-next-line promise/prefer-await-to-callbacks
    pool.connect((error, client) => {
      if (error !== undefined || client === undefined) {
        resume(Effect.fail(unavailable()));
      } else if (cancelled) {
        client.release(true);
      } else {
        resume(Effect.succeed(new Reservation(client)));
      }
    });
    return Effect.sync(() => {
      cancelled = true;
    });
  }).pipe(
    Effect.timeoutOrElse({
      duration: millis,
      orElse: () => Effect.fail(expired()),
    })
  );
