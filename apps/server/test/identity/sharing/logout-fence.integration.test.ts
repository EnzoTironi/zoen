import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { PrincipalDirectory } from "@zoen/authority/ports/sharing/directory";
import { Presence, PrincipalId } from "@zoen/authority/ports/worlds/context";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DateTime, Deferred, Effect, Fiber, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01IdentityDatabase } from "../worlds/database.ts";
import { createAccount, postAuth } from "../worlds/http.ts";

it.live(
  "EX22 real logout stays unavailable across pending ACK, then confirms absence on retry",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* logoutOrdering() {
        const fence = yield* DisclosureFence;
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const world = yield* Schema.decodeEffect(WorldRef)({
          realm: "live",
          worldId: randomUUID(),
        });
        const now = yield* DateTime.now;
        const deadline = yield* Schema.decodeEffect(Instant)(
          DateTime.formatIso(DateTime.add(now, { seconds: 10 }))
        );
        const ready = yield* Deferred.make<null>();
        const release = yield* Deferred.make<null>();
        const reader = yield* Effect.scoped(
          Effect.gen(function* heldReader() {
            const permit = yield* fence.shared(verified, world, deadline);
            yield* Deferred.succeed(ready, null);
            yield* Deferred.await(release);
            yield* permit.acknowledge;
          })
        ).pipe(Effect.forkChild);
        yield* Deferred.await(ready);
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        ).pipe(Effect.forkChild);
        // Same-role observer confirms that the real logout has attempted the exclusive lock.
        yield* Effect.gen(function* observeAttempt() {
          const sql = yield* SqlClient.SqlClient;
          while (true) {
            const rows = yield* sql<{
              attempted: boolean;
            }>`SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name = 'zoen-ex22-identity-fence' AND query LIKE 'SELECT pg_try_advisory_lock(%') AS attempted`;
            if (rows[0]?.attempted === true) {
              break;
            }
            yield* Effect.sleep("10 millis");
          }
        }).pipe(
          Effect.provide(fixture.database.authority),
          Effect.timeout("3 seconds")
        );
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          verified.sessionId
        );
        const ackBlocked = yield* Deferred.make<null>();
        const allowAck = yield* Deferred.make<null>();
        const barrier = yield* SqlClient.SqlClient.use((sql) =>
          sql.withTransaction(
            Effect.gen(function* pendingAcknowledgement() {
              // SHARE blocks DELETE's RowExclusive lock but permits the logout's SELECT.
              yield* sql`LOCK TABLE jobs.disclosure_pending IN SHARE MODE`;
              yield* Deferred.succeed(ackBlocked, null);
              yield* Deferred.await(allowAck);
            })
          )
        ).pipe(Effect.provide(fixture.database.migration), Effect.forkChild);
        yield* Deferred.await(ackBlocked);
        yield* Deferred.succeed(release, null);
        const blocked = yield* Fiber.join(logout);
        expect(blocked.status).toBe(503);
        expect(blocked.headers.getSetCookie()).toStrictEqual([]);
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          verified.sessionId
        );
        yield* Deferred.succeed(allowAck, null);
        yield* Fiber.join(barrier);
        yield* Fiber.join(reader);
        expect(
          (yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
          )).status
        ).toBe(200);
        expect(
          yield* presence.verify(account.credential).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unauthenticated" });
        const rows = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT id FROM identity.session WHERE id = ${verified.sessionId}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(rows).toStrictEqual([]);
      }).pipe(Effect.provide(fixture.runtime))
    )
);

it.live(
  "EX22 PrincipalDirectory returns exact account existence without identity metadata",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* accountEligibility() {
        const directory = yield* PrincipalDirectory;
        const account = yield* createAccount(fixture.config.baseUrl);
        const registered = yield* directory.exists(
          yield* Schema.decodeEffect(PrincipalId)(account.user.id)
        );
        const unknown = yield* directory.exists(
          yield* Schema.decodeEffect(PrincipalId)(randomUUID())
        );
        expect({ registered, unknown }).toStrictEqual({
          registered: true,
          unknown: false,
        });
      }).pipe(Effect.provide(fixture.runtime))
    )
);
