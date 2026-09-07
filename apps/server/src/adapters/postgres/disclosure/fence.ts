import { randomUUID } from "node:crypto";

import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
  worldDisclosureKey,
} from "@zoen/authority/ports/disclosure/keys";
import { Expired, Unavailable } from "@zoen/contracts/worlds/errors";
import type { Instant } from "@zoen/contracts/worlds/values";
import { Clock, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";

import type { D01PostgresConfig } from "../worlds/postgres.ts";
import { reserve } from "./connection.ts";
import type { Lock } from "./connection.ts";
import { checkDisclosurePool } from "./health.ts";
import { registerPending, startSessionClosing } from "./state.ts";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const expired = () => new Expired({ code: "EXPIRED" });
const remaining = (deadline: typeof Instant.Type) =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap((now) => {
      const millis = Date.parse(deadline) - now;
      return millis > 0 ? Effect.succeed(millis) : Effect.fail(expired());
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
      const checkHealth = checkDisclosurePool(pool);
      yield* checkHealth;
      const acquire = (locks: readonly Lock[], deadline: typeof Instant.Type) =>
        Effect.gen(function* acquireLocks() {
          const owner = yield* Effect.fiber;
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
          if (reservation.released) {
            return yield* unavailable();
          }
          // The real emitter continues in this caller fiber until its Scope closes.
          reservation.onLost = () => {
            owner.interruptUnsafe();
          };
          return reservation;
        });
      return DisclosureFence.of({
        checkHealth,
        exclusiveSession: (presence, deadline) =>
          Effect.gen(function* closeSession() {
            const key = sessionDisclosureKey(presence);
            const reservation = yield* acquire(
              [{ key, shared: false }],
              deadline
            );
            const budget = yield* remaining(deadline);
            yield* startSessionClosing(reservation, key).pipe(
              Effect.interruptible,
              Effect.timeoutOrElse({
                duration: budget,
                orElse: () => Effect.fail(expired()),
              })
            );
            yield* remaining(deadline);
          }),
        shared: (presence, world, deadline) =>
          Effect.gen(function* registerDisclosure() {
            const worldKey = worldDisclosureKey(world);
            const sessionKey = sessionDisclosureKey(presence);
            const membershipKey = membershipDisclosureKey(
              world,
              presence.principalId
            );
            // World shared first so Closing's exclusive world lock stays O(1).
            const reservation = yield* acquire(
              [
                { key: worldKey, shared: true },
                { key: sessionKey, shared: true },
                { key: membershipKey, shared: true },
              ],
              deadline
            );
            const permitId = randomUUID();
            const budget = yield* remaining(deadline);
            yield* registerPending(
              reservation,
              permitId,
              worldKey,
              sessionKey,
              membershipKey
            ).pipe(
              Effect.interruptible,
              Effect.timeoutOrElse({
                duration: budget,
                orElse: () => Effect.fail(expired()),
              })
            );
            yield* remaining(deadline);
            // ACK follows trusted end/cancellation proof. Releasing this reservation first
            // avoids starving a saturated pool; the durable row still blocks writers.
            const acknowledge = reservation.close().pipe(
              Effect.andThen(
                Effect.scoped(
                  Effect.gen(function* acknowledgeAttempt() {
                    const current = yield* Effect.acquireRelease(
                      reserve(pool, 3000),
                      (held) => held.close(),
                      { interruptible: true }
                    );
                    yield* current.statement(
                      "DELETE FROM jobs.disclosure_pending WHERE permit_id = $1",
                      [permitId]
                    );
                  })
                ).pipe(
                  Effect.interruptible,
                  Effect.timeout("3 seconds"),
                  Effect.mapError(unavailable)
                )
              )
            );
            return { acknowledge };
          }),
      });
    })
  );
