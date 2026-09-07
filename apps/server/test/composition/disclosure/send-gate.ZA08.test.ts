import { NodeHttpServer, NodeHttpServerRequest } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  HttpClient,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { makePrivateJsonEmitter } from "../../../src/http/disclosure.ts";
import { responseSecurity } from "../../../src/http/security.ts";

it.live(
  "ZA-08 send gate: retired authorizeSend refuses native private JSON end",
  () =>
    Effect.gen(function* retiredSendGate() {
      const client = yield* HttpClient.HttpClient;
      let refused = false;
      const route = HttpRouter.add(
        "GET",
        "/retired",
        Effect.gen(function* refuseRetired() {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const native = NodeHttpServerRequest.toServerResponse(request);
          const privateWrites: string[] = [];
          native.writeHead = new Proxy(native.writeHead.bind(native), {
            apply(target, receiver, args: unknown[]) {
              privateWrites.push("writeHead");
              return Reflect.apply(target, receiver, args) as unknown;
            },
          });
          const emit = yield* makePrivateJsonEmitter(request, () => "retired");
          expect(() => emit(new TextEncoder().encode('{"k":1}'))).toThrow(
            "disclosure.writer_epoch_retired"
          );
          expect(privateWrites).toStrictEqual([]);
          refused = true;
          return HttpServerResponse.empty({ status: 503 });
        })
      );
      yield* Layer.build(
        HttpRouter.serve(route.pipe(Layer.provide(responseSecurity)), {
          disableListenLog: true,
          disableLogger: true,
        })
      );
      const response = yield* client.get("/retired");
      expect(response.status).toBe(503);
      expect(refused).toBeTruthy();
    }).pipe(Effect.provide(NodeHttpServer.layerTest))
);
