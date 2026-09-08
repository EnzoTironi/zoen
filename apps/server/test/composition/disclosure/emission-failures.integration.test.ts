import { randomUUID } from "node:crypto";

import { NodeHttpServer } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { Deferred, Effect, Exit, Fiber, Layer, Schedule, Schema } from "effect";
import {
  HttpClient,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { withSharingDatabase } from "../../../../../tests/integration/sharing/core/fixture.ts";
import { configuration } from "../../../../../tests/integration/worlds/commit/fixture.ts";
import { makePrivateJsonEmitter } from "../../../src/http/disclosure.ts";
import { ResponseSecurityHeaders } from "../../../src/http/security.ts";
import { withStorage } from "../../adapters/object-storage/worlds/fixture.ts";
import { createAccount } from "../../identity/worlds/http.ts";

const bytes = (value: unknown) =>
  new TextEncoder().encode(
    Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))(value)
  );
const worldsBasis = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
};

it.live.each(["throw-after-end", "ack-delete-denied"] as const)(
  "EX23 real executor %s preserves pending after native HTTP 200 and prevents semantic revoke",
  (mode) =>
    withSharingDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* failedEmissionBoundary() {
          const executor = yield* SemanticExecutor;
          const sql = yield* SqlClient.SqlClient;
          const server = yield* HttpServer.HttpServer;
          const client = yield* HttpClient.HttpClient;
          const owner = yield* createAccount(fixture.config.baseUrl);
          const viewer = yield* createAccount(fixture.config.baseUrl);
          const created = yield* executor
            .execute(
              owner.credential,
              bytes({
                ...worldsBasis,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          yield* executor.executeSharing(
            owner.credential,
            bytes({
              ...sharing,
              input: { expectedRevision: null, principalRef: viewer.user.id },
              operation: "GrantWorldReadAccess",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            })
          );
          if (mode === "ack-delete-denied") {
            yield* SqlClient.SqlClient.use(
              (migration) =>
                migration`REVOKE DELETE ON jobs.disclosure_pending FROM ${migration(fixture.database.names.authority)}`
            ).pipe(Effect.provide(fixture.database.migration));
          }
          const closed = yield* Deferred.make<null>();
          const events: string[] = [];
          yield* server.serve(
            Effect.gen(function* nativeRoute() {
              const request = yield* HttpServerRequest.HttpServerRequest;
              const emit = yield* makePrivateJsonEmitter(request);
              const attempt = yield* Effect.scoped(
                executor.executeSharingWithEmission(
                  viewer.credential,
                  bytes({
                    ...sharing,
                    input: { principalRef: null },
                    operation: "InspectWorldAccess",
                    worldRef: created.worldRef,
                  }),
                  (body) => {
                    events.push("native.end.start");
                    const result = emit(body);
                    events.push("native.end.return");
                    if (mode === "throw-after-end") {
                      throw new Error(
                        "Controlled trusted writer failure after real native submission"
                      );
                    }
                    return result;
                  }
                )
              ).pipe(Effect.exit);
              events.push(attempt._tag);
              yield* Deferred.succeed(closed, null);
              return HttpServerResponse.empty({ status: 200 });
            }).pipe(
              Effect.provideService(ResponseSecurityHeaders, {
                "cache-control": "no-store",
              })
            )
          );
          const response = yield* client.get("/fault");
          expect(response.status).toBe(200);
          expect(yield* response.json).toMatchObject({
            _tag: "WorldAccessInspected",
            membership: { role: "viewer", state: "active" },
          });
          yield* Deferred.await(closed).pipe(Effect.timeout("5 seconds"));
          expect(events).toStrictEqual([
            "native.end.start",
            "native.end.return",
            mode === "throw-after-end" ? "Failure" : "Success",
          ]);
          expect(
            yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
          ).toStrictEqual([{ pending: 1 }]);
          const denied = yield* executor
            .executeSharing(
              owner.credential,
              bytes({
                ...sharing,
                input: { expectedRevision: "0", principalRef: viewer.user.id },
                operation: "RevokeWorldReadAccess",
                operationId: randomUUID(),
                worldRef: created.worldRef,
              })
            )
            .pipe(Effect.flip);
          expect(denied).toMatchObject({ _tag: "Unavailable" });
          expect(
            yield* sql`SELECT state, revision::text FROM authority.memberships WHERE principal_id = ${viewer.user.id}`
          ).toStrictEqual([{ revision: "0", state: "active" }]);
          expect(
            yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
          ).toStrictEqual([{ pending: 1 }]);
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              SemanticExecutor.layer.pipe(
                Layer.provideMerge(
                  Layer.mergeAll(
                    configuration,
                    fixture.database.authority,
                    fixture.runtime
                  )
                )
              ),
              NodeHttpServer.layerTest
            )
          )
        )
      )
    )
);

// SQL barriers pause the real protocol after preparation and during identity revalidation.
// They replace no executor, identity service, or provider response.
it.live.each(["session-expired", "cancelled"] as const)(
  "EX23 real executor %s before callback ACKs its registered permit without emitting",
  (mode) =>
    withSharingDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* cancelledBeforeCallback() {
          const executor = yield* SemanticExecutor;
          const sql = yield* SqlClient.SqlClient;
          const owner = yield* createAccount(fixture.config.baseUrl);
          const viewer = yield* createAccount(fixture.config.baseUrl);
          const created = yield* executor
            .execute(
              owner.credential,
              bytes({
                ...worldsBasis,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          yield* executor.executeSharing(
            owner.credential,
            bytes({
              ...sharing,
              input: { expectedRevision: null, principalRef: viewer.user.id },
              operation: "GrantWorldReadAccess",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            })
          );

          const registrationHeld = yield* Deferred.make<null>();
          const releaseRegistration = yield* Deferred.make<null>();
          const registrationBarrier = yield* SqlClient.SqlClient.use(
            (migration) =>
              migration.withTransaction(
                Effect.gen(function* holdRegistration() {
                  yield* migration`LOCK TABLE jobs.disclosure_subjects IN SHARE MODE`;
                  yield* Deferred.succeed(registrationHeld, null);
                  yield* Deferred.await(releaseRegistration).pipe(
                    Effect.timeout("8 seconds")
                  );
                })
              )
          ).pipe(Effect.provide(fixture.database.migration), Effect.forkChild);
          yield* Deferred.await(registrationHeld);
          let emitted = 0;
          const reader = yield* Effect.scoped(
            executor.executeSharingWithEmission(
              viewer.credential,
              bytes({
                ...sharing,
                input: { principalRef: null },
                operation: "InspectWorldAccess",
                worldRef: created.worldRef,
              }),
              () => {
                emitted += 1;
                return "submitted";
              }
            )
          ).pipe(Effect.exit, Effect.forkChild);
          yield* sql`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE application_name = 'zoen-ex22-identity-fence' AND wait_event_type = 'Lock'`.pipe(
            Effect.map((rows) => rows[0]?.waiting === 1),
            Effect.repeat({
              schedule: Schedule.spaced("10 millis"),
              until: (waiting) => waiting,
            }),
            Effect.timeout("5 seconds")
          );
          const identityHeld = yield* Deferred.make<null>();
          const releaseIdentity = yield* Deferred.make<null>();
          const identityBarrier = yield* SqlClient.SqlClient.use((migration) =>
            migration.withTransaction(
              Effect.gen(function* holdRevalidation() {
                yield* migration`LOCK TABLE identity.session IN ACCESS EXCLUSIVE MODE`;
                yield* Deferred.succeed(identityHeld, null);
                yield* Deferred.await(releaseIdentity).pipe(
                  Effect.timeout("8 seconds")
                );
                if (mode === "session-expired") {
                  yield* migration`UPDATE identity.session SET "expiresAt" = now() - interval '1 second' WHERE "userId" = ${viewer.user.id}`;
                }
              })
            )
          ).pipe(Effect.provide(fixture.database.migration), Effect.forkChild);
          yield* Deferred.await(identityHeld);
          yield* Deferred.succeed(releaseRegistration, null);
          yield* Fiber.join(registrationBarrier);
          yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`.pipe(
            Effect.map((rows) => rows[0]?.pending === 1),
            Effect.repeat({
              schedule: Schedule.spaced("10 millis"),
              until: (pending) => pending,
            }),
            Effect.timeout("5 seconds")
          );
          expect(emitted).toBe(0);
          if (mode === "cancelled") {
            yield* Fiber.interrupt(reader);
          }
          yield* Deferred.succeed(releaseIdentity, null);
          yield* Fiber.join(identityBarrier);
          if (mode === "session-expired") {
            expect(yield* Fiber.join(reader)).toMatchObject({
              _tag: "Failure",
              cause: {
                reasons: [{ _tag: "Fail", error: { _tag: "Unauthenticated" } }],
              },
            });
          } else {
            expect(Exit.hasInterrupts(yield* Fiber.await(reader))).toBeTruthy();
          }
          expect(emitted).toBe(0);
          expect(
            yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
          ).toStrictEqual([{ pending: 0 }]);
          const revoked = yield* executor.executeSharing(
            owner.credential,
            bytes({
              ...sharing,
              input: { expectedRevision: "0", principalRef: viewer.user.id },
              operation: "RevokeWorldReadAccess",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            })
          );
          expect(revoked).toMatchObject({
            _tag: "WorldReadAccessRevoked",
            membershipAtCommit: { revision: "1", state: "revoked" },
          });
        }).pipe(
          Effect.provide(
            SemanticExecutor.layer.pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  configuration,
                  fixture.database.authority,
                  fixture.runtime
                )
              )
            )
          )
        )
      )
    )
);
