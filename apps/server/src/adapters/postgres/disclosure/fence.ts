import { PgClient } from "@effect/sql-pg";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
} from "@zoen/authority/ports/disclosure/keys";
import { Expired, Unavailable } from "@zoen/contracts/d01/errors";
import type { Instant } from "@zoen/contracts/d01/values";
import { Clock, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";
import type { PoolClient } from "pg";

import { checkD01RuntimeRole } from "../d01/postgres.ts";
import type { D01PostgresConfig } from "../d01/postgres.ts";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const expired = () => new Expired({ code: "EXPIRED" });
const remaining = (deadline: typeof Instant.Type) =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) => {
      const millis = Date.parse(deadline) - now;
      return millis > 0 ? Effect.succeed(millis) : Effect.fail(expired());
    })
  );

interface Lock {
  readonly key: string;
  readonly shared: boolean;
}

/** A reservation is never returned while a query or a session lock is uncertain. */
class Reservation {
  readonly locks: Lock[] = [];
  readonly client: PoolClient;
  released = false;
  constructor(client: PoolClient) {
    this.client = client;
    client.on("error", this.destroy);
  }
  readonly destroy = () => {
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
  readonly close = () =>
    Effect.gen({ self: this }, function* closeReservation() {
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
        this.client.removeListener("error", this.destroy);
        this.client.release();
      }
    });
  readonly attempt = (lock: Lock, millis: number) =>
    this.query(
      lock.shared ? "pg_try_advisory_lock_shared" : "pg_try_advisory_lock",
      lock.key,
      lock
    ).pipe(
      Effect.timeoutOrElse({
        duration: millis,
        orElse: () => Effect.fail(expired()),
      })
    );
}

const reserve = (pool: Pool, millis: number) =>
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

/** A bounded, separate pool in the physical authority database. */
export const makeDisclosureFenceLayer = (config: D01PostgresConfig) =>
  Layer.effect(
    DisclosureFence,
    Effect.gen(function* makeFence() {
      if (
        !Number.isSafeInteger(config.maxConnections) ||
        config.maxConnections < 1 ||
        config.maxConnections > 64
      ) {
        return yield* unavailable();
      }
      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const created = new Pool({
            application_name: config.applicationName,
            connectionString: Redacted.value(config.url),
            connectionTimeoutMillis: 3000,
            idleTimeoutMillis: 30_000,
            max: config.maxConnections,
          });
          // Idle errors already remove the physical client from pg's pool.
          created.on("error", () => {
            /* pg removes the idle client before this notification. */
          });
          return created;
        }),
        (created) => Effect.promise(() => created.end())
      );
      const checkHealth = checkD01RuntimeRole.pipe(
        Effect.provide(
          PgClient.layerFrom(
            PgClient.fromPool({ acquire: Effect.succeed(pool) })
          )
        ),
        Effect.mapError(unavailable)
      );
      yield* checkHealth;
      const acquire = (locks: readonly Lock[], deadline: typeof Instant.Type) =>
        Effect.gen(function* acquireLocks() {
          const millis = yield* remaining(deadline);
          const reservation = yield* Effect.acquireRelease(
            reserve(pool, millis),
            (held) => held.close(),
            { interruptible: true }
          );
          for (const lock of locks) {
            while (true) {
              const budget = yield* remaining(deadline);
              if (yield* reservation.attempt(lock, budget)) {
                break;
              }
              const rest = yield* remaining(deadline);
              yield* Effect.sleep(Math.min(20, rest));
            }
          }
          yield* remaining(deadline);
        });
      return DisclosureFence.of({
        checkHealth,
        exclusiveSession: (presence, deadline) =>
          acquire(
            [{ key: sessionDisclosureKey(presence), shared: false }],
            deadline
          ),
        shared: (presence, world, deadline) =>
          acquire(
            [
              { key: sessionDisclosureKey(presence), shared: true },
              {
                key: membershipDisclosureKey(world, presence.principalId),
                shared: true,
              },
            ],
            deadline
          ),
      });
    })
  );
