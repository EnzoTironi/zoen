import { randomUUID } from "node:crypto";

import { NodeHttpServer, NodeHttpServerRequest } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { sessionDisclosureKey } from "@zoen/authority/ports/disclosure/keys";
import { VerifiedPresence } from "@zoen/authority/ports/worlds/context";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DateTime, Deferred, Effect, Fiber, Layer, Schema } from "effect";
import {
  HttpClient,
  HttpServerRequest,
  HttpServer,
  HttpServerResponse,
} from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../src/adapters/postgres/disclosure/fence.ts";
import { makePrivateJsonEmitter } from "../../../../src/http/disclosure.ts";
import { ResponseSecurityHeaders } from "../../../../src/http/security.ts";
import { withD01Database } from "../worlds/database.ts";

it.live(
  "EX22 coordinator loss retains pending until native submission ACK; confirmed closing forbids subsequent HTTP private bytes",
  () =>
    withD01Database((database) =>
      Effect.gen(function* writerLoss() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const server = yield* HttpServer.HttpServer;
        const client = yield* HttpClient.HttpClient;
        if (server.address._tag !== "TcpAddress") {
          throw new Error("Writer probe requires TCP");
        }
        const now = yield* DateTime.now;
        const presence = yield* Schema.decodeEffect(VerifiedPresence)({
          authenticatedAt: DateTime.formatIso(now),
          expiresAt: DateTime.formatIso(DateTime.add(now, { seconds: 60 })),
          principalId: randomUUID(),
          realm: "live",
          sessionId: randomUUID(),
        });
        const world = yield* Schema.decodeEffect(WorldRef)({
          realm: "live",
          worldId: randomUUID(),
        });
        const deadline = yield* Schema.decodeEffect(Instant)(
          DateTime.formatIso(DateTime.add(now, { seconds: 10 }))
        );
        const key = sessionDisclosureKey(presence);
        const paused = yield* Deferred.make<null>();
        const resume = yield* Deferred.make<null>();
        const finished = yield* Deferred.make<null>();
        const events: string[] = [];
        const privateBody = `private-probe-${randomUUID()}`;
        const bytes = new TextEncoder().encode(privateBody);
        yield* server.serve(
          Effect.gen(function* actualHandler() {
            const acquired = yield* fence
              .shared(presence, world, deadline)
              .pipe(Effect.result);
            if (acquired._tag === "Failure") {
              events.push("reader.denied");
              return HttpServerResponse.empty({ status: 503 });
            }
            const permit = acquired.success;
            const request = yield* HttpServerRequest.HttpServerRequest;
            const native = NodeHttpServerRequest.toServerResponse(request);
            native.end = new Proxy(native.end.bind(native), {
              apply(target, receiver, args: unknown[]) {
                events.push("node.end.enter");
                const result: unknown = Reflect.apply(target, receiver, args);
                events.push("node.end.return");
                return result;
              },
            });
            const emit = yield* makePrivateJsonEmitter(request);
            let submitted = false;
            yield* Effect.addFinalizer(() =>
              Effect.gen(function* knownSubmission() {
                if (submitted) {
                  events.push("ack.start");
                  yield* permit.acknowledge.pipe(Effect.orDie);
                  events.push("ack.return");
                }
                yield* Deferred.succeed(finished, null);
              })
            );
            events.push("writer.pause");
            yield* Deferred.succeed(paused, null);
            yield* Deferred.await(resume);
            yield* Effect.sync(() => {
              expect(emit(bytes)).toBe("submitted");
              submitted = true;
            });
            return HttpServerResponse.empty({ status: 200 });
          }).pipe(
            Effect.uninterruptible,
            Effect.provideService(ResponseSecurityHeaders, {
              "cache-control": "no-store",
            })
          )
        );
        const request = yield* Effect.gen(function* actualRequest() {
          const response = yield* client.get("/probe");
          return { body: yield* response.text, status: response.status };
        }).pipe(Effect.forkChild);
        yield* Deferred.await(paused);
        expect(
          yield* sql.withTransaction(
            sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`
          )
        ).toStrictEqual([{ acquired: false }]);
        expect(
          yield* sql`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE application_name = 'ex22-writer-loss'`
        ).toStrictEqual([{ terminated: true }]);
        events.push("coordinator.terminated");
        const unlocked = yield* sql.withTransaction(
          sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS acquired`
        );
        expect(unlocked).toStrictEqual([{ acquired: true }]);
        events.push("physical.gate.free");
        expect(
          yield* Effect.scoped(fence.exclusiveSession(presence, deadline)).pipe(
            Effect.flip
          )
        ).toMatchObject({ _tag: "Unavailable" });
        events.push("guarded.closing.unavailable");
        expect(
          yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
        ).toStrictEqual([{ pending: 1 }]);
        expect(
          yield* sql`SELECT count(*)::int AS closing FROM jobs.disclosure_session_closing`
        ).toStrictEqual([{ closing: 0 }]);
        yield* Deferred.succeed(resume, null);
        const response = yield* Fiber.join(request);
        yield* Deferred.await(finished);
        expect(response).toStrictEqual({ body: privateBody, status: 200 });
        expect(
          yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
        ).toStrictEqual([{ pending: 0 }]);
        yield* Effect.scoped(fence.exclusiveSession(presence, deadline));
        events.push("guarded.closing.confirmed");
        const denied = yield* client.get("/probe");
        expect(denied.status).toBe(503);
        expect(yield* denied.text).not.toContain(privateBody);
        expect(events).toStrictEqual([
          "writer.pause",
          "coordinator.terminated",
          "physical.gate.free",
          "guarded.closing.unavailable",
          "node.end.enter",
          "node.end.return",
          "ack.start",
          "ack.return",
          "guarded.closing.confirmed",
          "reader.denied",
        ]);
        yield* Effect.logInfo({ events: [...events] });
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeDisclosureFenceLayer({
              applicationName: "ex22-writer-loss",
              maxConnections: 1,
              url: database.urls.authority,
            }),
            database.authority,
            NodeHttpServer.layerTest
          )
        )
      )
    )
);
