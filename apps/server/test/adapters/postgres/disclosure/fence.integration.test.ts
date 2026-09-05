import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { VerifiedPresence } from "@zoen/authority/ports/d01/context";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
} from "@zoen/authority/ports/disclosure/keys";
import { Instant, WorldRef } from "@zoen/contracts/d01/values";
import {
  DateTime,
  Deferred,
  Effect,
  Fiber,
  Layer,
  Result,
  Schema,
} from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../src/adapters/postgres/disclosure/fence.ts";
import { withD01Database } from "../d01/database.ts";

const deadline = (ms = 5000) =>
  DateTime.now.pipe(
    Effect.map((now) =>
      Schema.decodeSync(Instant)(
        DateTime.formatIso(DateTime.add(now, { milliseconds: ms }))
      )
    )
  );
const presence = () =>
  DateTime.now.pipe(
    Effect.map((now) =>
      Schema.decodeSync(VerifiedPresence)({
        authenticatedAt: DateTime.formatIso(now),
        expiresAt: DateTime.formatIso(DateTime.add(now, { seconds: 60 })),
        principalId: randomUUID(),
        realm: "live",
        sessionId: randomUUID(),
      })
    )
  );
const world = () =>
  Schema.decodeSync(WorldRef)({ realm: "live", worldId: randomUUID() });

it.live(
  "EX22 physical session and membership locks last through scope and unlock exactly once",
  () =>
    withD01Database((database) =>
      Effect.gen(function* scopedLocks() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const viewer = yield* presence();
        const target = world();
        const ready = yield* Deferred.make<null>();
        const release = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* hold() {
            yield* fence.shared(viewer, target, yield* deadline());
            yield* Deferred.succeed(ready, null);
            yield* Deferred.await(release);
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        for (const key of [
          sessionDisclosureKey(viewer),
          membershipDisclosureKey(target, viewer.principalId),
        ]) {
          expect(
            yield* sql.withTransaction(
              sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`
            )
          ).toStrictEqual([{ acquired: false }]);
        }
        yield* Deferred.succeed(release, null);
        yield* Fiber.join(reader);
        for (const key of [
          sessionDisclosureKey(viewer),
          membershipDisclosureKey(target, viewer.principalId),
        ]) {
          expect(
            yield* sql.withTransaction(
              sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`
            )
          ).toStrictEqual([{ acquired: true }]);
        }
        expect(
          yield* sql`SELECT count(*)::int AS count FROM pg_locks JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid WHERE application_name = 'ex22-fence-scope' AND locktype = 'advisory'`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(
        Effect.provide(
          Layer.merge(
            makeDisclosureFenceLayer({
              applicationName: "ex22-fence-scope",
              maxConnections: 1,
              url: database.urls.authority,
            }),
            database.migration
          )
        )
      )
    )
);

it.live(
  "EX22 an exclusive session gate blocks a reader until its original deadline; interrupted readers release acquired session locks",
  () =>
    withD01Database((database) =>
      Effect.gen(function* competingLocks() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const viewer = yield* presence();
        const target = world();
        const ready = yield* Deferred.make<null>();
        const release = yield* Deferred.make<null>();
        const writer = yield* Effect.scoped(
          Effect.gen(function* hold() {
            yield* fence.exclusiveSession(viewer, yield* deadline());
            yield* Deferred.succeed(ready, null);
            yield* Deferred.await(release);
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        const blocked = yield* Effect.scoped(
          fence.shared(viewer, target, yield* deadline(100))
        ).pipe(Effect.result);
        expect(Result.isFailure(blocked) && blocked.failure._tag).toBe(
          "Expired"
        );
        yield* Deferred.succeed(release, null);
        yield* Fiber.join(writer);
        const readerReady = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* holdReader() {
            yield* fence.shared(viewer, target, yield* deadline());
            yield* Deferred.succeed(readerReady, null);
            return yield* Effect.never;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(readerReady);
        yield* Fiber.interrupt(reader);
        const key = sessionDisclosureKey(viewer);
        expect(
          yield* sql.withTransaction(
            sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`
          )
        ).toStrictEqual([{ acquired: true }]);
      }).pipe(
        Effect.provide(
          Layer.merge(
            makeDisclosureFenceLayer({
              applicationName: "ex22-fence-deadline",
              maxConnections: 2,
              url: database.urls.authority,
            }),
            database.migration
          )
        )
      )
    )
);
