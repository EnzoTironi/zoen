import { createHash, randomUUID } from "node:crypto";

import { NodeHttpServer, NodeHttpServerRequest } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { VerifiedPresence } from "@zoen/authority/ports/d01/context";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { Instant, WorldRef } from "@zoen/contracts/d01/values";
import { DateTime, Deferred, Effect, Layer, Schema } from "effect";
import {
  HttpClient,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../src/adapters/postgres/disclosure/fence.ts";
import { makePrivateJsonEmitter } from "../../../src/http/disclosure.ts";
import { responseSecurity } from "../../../src/http/security.ts";
import { withD01Database } from "../../adapters/postgres/d01/database.ts";

const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

it.live.each([64, 1_048_576])(
  "EX23 native JSON writer submits exactly %i bytes before acknowledging its durable permit",
  (size) =>
    withD01Database((database) =>
      Effect.gen(function* nativeWriterComponent() {
        const sql = yield* SqlClient.SqlClient;
        const fence = yield* DisclosureFence;
        const client = yield* HttpClient.HttpClient;
        const now = yield* DateTime.now;
        // Synthetic coordinates feed real coordination; this is not an identity/authority acceptance test.
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
        const bytes = new TextEncoder().encode(`"${"x".repeat(size - 2)}"`);
        const events: string[] = [];
        const closed = yield* Deferred.make<null>();
        const route = HttpRouter.add(
          "GET",
          "/writer",
          Effect.gen(function* actualWriter() {
            const request = yield* HttpServerRequest.HttpServerRequest;
            const native = NodeHttpServerRequest.toServerResponse(request);
            native.end = new Proxy(native.end.bind(native), {
              apply(target, receiver, args: unknown[]) {
                events.push("end.enter");
                const result: unknown = Reflect.apply(target, receiver, args);
                events.push("end.return");
                return result;
              },
            });
            const permit = yield* fence.shared(presence, world, deadline);
            let submitted = false;
            yield* Effect.addFinalizer(() =>
              Effect.gen(function* acknowledgeKnownWriter() {
                if (submitted) {
                  events.push("ack.start");
                  yield* permit.acknowledge.pipe(Effect.orDie);
                  events.push("ack.return");
                }
                yield* Deferred.succeed(closed, null);
              })
            );
            expect(
              yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
            ).toStrictEqual([{ pending: 1 }]);
            const emit = yield* makePrivateJsonEmitter(request);
            yield* Effect.sync(() => {
              expect(emit(bytes)).toBe("submitted");
              submitted = true;
              events.push("handler.return");
            });
            return HttpServerResponse.empty({ status: 200 });
          })
        );
        yield* Layer.build(
          HttpRouter.serve(route.pipe(Layer.provide(responseSecurity)), {
            disableListenLog: true,
            disableLogger: true,
          })
        );
        const response = yield* client.get("/writer");
        expect(response.status).toBe(200);
        const received = new Uint8Array(yield* response.arrayBuffer);
        yield* Deferred.await(closed).pipe(Effect.timeout("5 seconds"));
        expect({
          cache: response.headers["cache-control"],
          contentLength: response.headers["content-length"],
          contentType: response.headers["content-type"],
          nosniff: response.headers["x-content-type-options"],
          policy: response.headers["referrer-policy"],
          status: response.status,
        }).toStrictEqual({
          cache: "no-store",
          contentLength: String(size),
          contentType: "application/json",
          nosniff: "nosniff",
          policy: "no-referrer",
          status: 200,
        });
        expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/u);
        expect(received.byteLength).toBe(size);
        expect(digest(received)).toBe(digest(bytes));
        expect(events).toStrictEqual([
          "end.enter",
          "end.return",
          "handler.return",
          "ack.start",
          "ack.return",
        ]);
        expect(
          yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
        ).toStrictEqual([{ pending: 0 }]);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            database.authority,
            NodeHttpServer.layerTest,
            makeDisclosureFenceLayer({
              applicationName: "ex23-native-writer",
              maxConnections: 1,
              url: database.urls.authority,
            })
          )
        )
      )
    )
);
