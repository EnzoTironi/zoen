import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DisclosureFence } from "@zoen/ontology/ports/disclosure/fence";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
  worldDisclosureKey,
} from "@zoen/ontology/ports/disclosure/keys";
import { VerifiedPresence } from "@zoen/ontology/ports/worlds/context";
import {
  DateTime,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Result,
  Schema,
} from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../worlds/database.ts";

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
    withWorldsDatabase((database) =>
      Effect.gen(function* scopedLocks() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const viewer = yield* presence();
        const target = world();
        const ready = yield* Deferred.make<null>();
        const release = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* hold() {
            const permit = yield* fence.shared(
              viewer,
              target,
              yield* deadline()
            );
            yield* Deferred.succeed(ready, null);
            yield* Deferred.await(release);
            return permit;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        for (const key of [
          worldDisclosureKey(target),
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
        const permit = yield* Fiber.join(reader);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 1 }]);
        yield* permit.acknowledge;
        yield* permit.acknowledge;
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
        for (const key of [
          worldDisclosureKey(target),
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
    withWorldsDatabase((database) =>
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
        expect(
          yield* Effect.scoped(
            fence.shared(viewer, target, yield* deadline())
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        const nextSession = yield* presence();
        const readerReady = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* holdReader() {
            yield* fence.shared(nextSession, target, yield* deadline());
            yield* Deferred.succeed(readerReady, null);
            return yield* Effect.never;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(readerReady);
        yield* Fiber.interrupt(reader);
        const key = sessionDisclosureKey(nextSession);
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

it.live(
  "EX22 confirmed coordinator connection loss interrupts the emitting fiber and removes all physical locks",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* lostConnection() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const viewer = yield* presence();
        const target = world();
        const ready = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* emittingReader() {
            yield* fence.shared(viewer, target, yield* deadline());
            yield* Deferred.succeed(ready, null);
            return yield* Effect.never;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        expect(
          yield* sql`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE application_name = 'ex22-fence-loss'`
        ).toStrictEqual([{ terminated: true }]);
        const outcome = yield* Fiber.await(reader).pipe(
          Effect.timeout("1 second")
        );
        expect(Exit.hasInterrupts(outcome)).toBeTruthy();
        expect(
          yield* sql`SELECT count(*)::int AS count FROM pg_locks JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid WHERE application_name = 'ex22-fence-loss' AND locktype = 'advisory'`
        ).toStrictEqual([{ count: 0 }]);
        yield* Effect.scoped(fence.shared(viewer, target, yield* deadline()));
      }).pipe(
        Effect.provide(
          Layer.merge(
            makeDisclosureFenceLayer({
              applicationName: "ex22-fence-loss",
              maxConnections: 1,
              url: database.urls.authority,
            }),
            database.authority
          )
        )
      )
    )
);
