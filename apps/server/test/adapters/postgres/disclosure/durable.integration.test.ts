import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import type { DisclosurePermit } from "@zoen/authority/ports/disclosure/fence";
import { VerifiedPresence } from "@zoen/authority/ports/worlds/context";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DateTime, Deferred, Effect, Exit, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../worlds/database.ts";
import type { WorldsTestDatabase } from "../worlds/database.ts";

const context = Effect.gen(function* testContext() {
  const now = yield* DateTime.now;
  return {
    deadline: yield* Schema.decodeEffect(Instant)(
      DateTime.formatIso(DateTime.add(now, { seconds: 10 }))
    ),
    presence: yield* Schema.decodeEffect(VerifiedPresence)({
      authenticatedAt: DateTime.formatIso(now),
      expiresAt: DateTime.formatIso(DateTime.add(now, { seconds: 60 })),
      principalId: randomUUID(),
      realm: "live",
      sessionId: randomUUID(),
    }),
    world: yield* Schema.decodeEffect(WorldRef)({
      realm: "live",
      worldId: randomUUID(),
    }),
  };
});
const runtime = (database: WorldsTestDatabase) =>
  Layer.merge(
    makeDisclosureFenceLayer({
      applicationName: "ex22-durable",
      maxConnections: 1,
      url: database.urls.authority,
    }),
    database.migration
  );

it.live(
  "EX22 Scope closure retains a durable permit; exact ACK permits terminal logout, which prevents new disclosure",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* terminalClosing() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const permit = yield* Effect.scoped(
          fence.shared(test.presence, test.world, test.deadline)
        );
        expect(
          yield* sql`SELECT revision FROM jobs.disclosure_subjects ORDER BY subject_key`
        ).toStrictEqual([
          { revision: "1" },
          { revision: "1" },
          { revision: "1" },
        ]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 1 }]);
        expect(
          yield* Effect.scoped(
            fence.exclusiveSession(test.presence, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_session_closing`
        ).toStrictEqual([{ count: 0 }]);
        // This test owns the attempt and never gives its bytes to any emitter.
        yield* permit.acknowledge;
        yield* permit.acknowledge;
        yield* Effect.scoped(
          fence.exclusiveSession(test.presence, test.deadline)
        );
        yield* Effect.scoped(
          fence.exclusiveSession(test.presence, test.deadline)
        );
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_session_closing`
        ).toStrictEqual([{ count: 1 }]);
        expect(
          yield* Effect.scoped(
            fence.shared(test.presence, test.world, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
        const newSession = yield* Schema.decodeEffect(VerifiedPresence)({
          ...test.presence,
          sessionId: randomUUID(),
        });
        const next = yield* Effect.scoped(
          fence.shared(newSession, test.world, test.deadline)
        );
        yield* next.acknowledge;
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 failed permit INSERT rolls both subject writes back and discards the transaction's physical client",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* atomicRegistration() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const before = yield* sql<{
          pid: number;
        }>`SELECT pid FROM pg_stat_activity WHERE application_name = 'ex22-durable'`;
        expect(before).toHaveLength(1);
        yield* sql`REVOKE INSERT ON jobs.disclosure_pending FROM ${sql(database.names.authority)}`;
        expect(
          yield* Effect.scoped(
            fence.shared(test.presence, test.world, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_subjects`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT pid FROM pg_stat_activity WHERE application_name = 'ex22-durable'`
        ).toStrictEqual([]);
        yield* sql`GRANT INSERT ON jobs.disclosure_pending TO ${sql(database.names.authority)}`;
        const retry = yield* Effect.scoped(
          fence.shared(test.presence, test.world, test.deadline)
        );
        yield* retry.acknowledge;
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 denied ACK retains the same durable permit and retry removes only that UUID without another emission",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* retryAcknowledgement() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const permit = yield* Effect.scoped(
          fence.shared(test.presence, test.world, test.deadline)
        );
        const before = yield* sql`SELECT * FROM jobs.disclosure_pending`;
        expect(before).toHaveLength(1);
        yield* sql`REVOKE DELETE ON jobs.disclosure_pending FROM ${sql(database.names.authority)}`;
        expect(yield* permit.acknowledge.pipe(Effect.flip)).toMatchObject({
          _tag: "Unavailable",
        });
        expect(yield* sql`SELECT * FROM jobs.disclosure_pending`).toStrictEqual(
          before
        );
        expect(
          yield* Effect.scoped(
            fence.exclusiveSession(test.presence, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        yield* sql`GRANT DELETE ON jobs.disclosure_pending TO ${sql(database.names.authority)}`;
        yield* permit.acknowledge;
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 a lost coordinator leaves pending durable and blocks terminal logout until ACK on a current connection",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* physicalLoss() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const ready = yield* Deferred.make<DisclosurePermit>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* pendingReader() {
            const permit = yield* fence.shared(
              test.presence,
              test.world,
              test.deadline
            );
            yield* Deferred.succeed(ready, permit);
            return yield* Effect.never;
          })
        ).pipe(Effect.forkChild);
        const permit = yield* Deferred.await(ready);
        expect(
          yield* SqlClient.SqlClient.use(
            (observer) =>
              observer`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE application_name = 'ex22-durable'`
          ).pipe(Effect.provide(database.authority))
        ).toStrictEqual([{ terminated: true }]);
        expect(
          Exit.hasInterrupts(
            yield* Fiber.await(reader).pipe(Effect.timeout("1 second"))
          )
        ).toBeTruthy();
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 1 }]);
        expect(
          yield* Effect.scoped(
            fence.exclusiveSession(test.presence, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        // The interrupted test never invoked or retained an emitter.
        yield* permit.acknowledge;
        yield* Effect.scoped(
          fence.exclusiveSession(test.presence, test.deadline)
        );
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 coordinator health rejects missing durable grants on the actual pool",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* healthGrants() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        yield* sql`REVOKE INSERT ON jobs.disclosure_session_closing FROM ${sql(database.names.authority)}`;
        expect(yield* fence.checkHealth.pipe(Effect.flip)).toMatchObject({
          _tag: "Unavailable",
        });
        yield* sql`GRANT INSERT ON jobs.disclosure_session_closing TO ${sql(database.names.authority)}`;
        yield* fence.checkHealth;
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 concurrent exact ACKs release one physical reservation and use a saturated one-slot pool safely",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* concurrentAcknowledgements() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        yield* Effect.scoped(
          Effect.gen(function* sameAttempt() {
            const permit = yield* fence.shared(
              test.presence,
              test.world,
              test.deadline
            );
            yield* Effect.all([permit.acknowledge, permit.acknowledge], {
              concurrency: "unbounded",
            });
          })
        );
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM pg_locks JOIN pg_stat_activity ON pg_locks.pid = pg_stat_activity.pid WHERE application_name = 'ex22-durable' AND locktype = 'advisory'`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 explicit cancellation proof can ACK from an interrupted owner's finalizer",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* cancelledBeforeEmission() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const ready = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* neverEmits() {
            const permit = yield* fence.shared(
              test.presence,
              test.world,
              test.deadline
            );
            // This finalizer owns the proof: this effect never invokes an emitter.
            yield* Effect.addFinalizer(() =>
              permit.acknowledge.pipe(Effect.orDie)
            );
            yield* Deferred.succeed(ready, null);
            return yield* Effect.never;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        yield* Fiber.interrupt(reader);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(runtime(database)))
    )
);

it.live(
  "EX22 registration obeys its deadline even when its caller is uninterruptible and PostgreSQL blocks the subject write",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* boundedRegistration() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const test = yield* context;
        const ready = yield* Deferred.make<null>();
        const release = yield* Deferred.make<null>();
        const holder = yield* sql
          .withTransaction(
            Effect.gen(function* blockSubjectTable() {
              yield* sql`LOCK TABLE jobs.disclosure_subjects IN ACCESS EXCLUSIVE MODE`;
              yield* Deferred.succeed(ready, null);
              yield* Deferred.await(release).pipe(Effect.timeout("2 seconds"));
            })
          )
          .pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        const now = yield* DateTime.now;
        const deadline = yield* Schema.decodeEffect(Instant)(
          DateTime.formatIso(DateTime.add(now, { milliseconds: 100 }))
        );
        const failure = yield* Effect.scoped(
          fence.shared(test.presence, test.world, deadline)
        ).pipe(Effect.uninterruptible, Effect.flip);
        expect(failure).toMatchObject({ _tag: "Expired" });
        yield* Deferred.succeed(release, null);
        yield* Fiber.join(holder);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_subjects`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(runtime(database)))
    )
);
