import { randomUUID } from "node:crypto";

import { NodeHttpServer, NodeHttpServerRequest } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { sessionDisclosureKey } from "@zoen/authority/ports/disclosure/keys";
import { VerifiedPresence } from "@zoen/authority/ports/worlds/context";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DateTime, Deferred, Effect, Exit, Fiber, Layer, Schema } from "effect";
import {
  HttpClient,
  HttpEffect,
  HttpServer,
  HttpServerResponse,
} from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../worlds/database.ts";

it.live(
  "EX22 private bytes must not reach end after coordinator loss releases the exclusive session gate",
  () =>
    withWorldsDatabase((database) =>
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
            const fiber = yield* Effect.fiber;
            fiber.addObserver((exit) => {
              events.push(
                `fiber.exit.interrupted=${String(Exit.hasInterrupts(exit))}`
              );
            });
            yield* fence.shared(presence, world, deadline);
            yield* HttpEffect.appendPreResponseHandler((request, response) =>
              Effect.gen(function* beforeActualWriter() {
                const native = NodeHttpServerRequest.toServerResponse(request);
                native.end = new Proxy(native.end.bind(native), {
                  apply(target, receiver, args: unknown[]) {
                    events.push("node.end.enter");
                    const result: unknown = Reflect.apply(
                      target,
                      receiver,
                      args
                    );
                    events.push("node.end.return");
                    return result;
                  },
                });
                events.push("preResponse.pause");
                yield* Deferred.succeed(paused, null);
                yield* Deferred.await(resume);
                events.push("preResponse.resume");
                return response;
              })
            );
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                events.push("scope.close");
              }).pipe(Effect.andThen(Deferred.succeed(finished, null)))
            );
            events.push("emitter.return");
            return HttpServerResponse.uint8Array(bytes);
          })
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
        events.push("exclusive.acquired.and.committed");
        yield* Effect.sleep("100 millis");
        yield* Deferred.succeed(resume, null);
        const response = yield* Fiber.join(request);
        yield* Deferred.await(finished);
        yield* Effect.logInfo({ events: [...events], response });
        expect(response.body).not.toContain(privateBody);
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
