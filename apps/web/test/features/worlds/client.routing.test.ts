import { describe, expect, it } from "@effect/vitest";
import { routeExecute } from "@zoen/application-client/execute";
import { InspectWorldErasure } from "@zoen/contracts/erasure/operations";
import { InspectWorldAccess } from "@zoen/contracts/sharing/operations";
import { InspectSubjectIdentity } from "@zoen/contracts/subject-identity/operations";
import { ApplicationApi } from "@zoen/contracts/worlds/api";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import {
  CreatePersonalWorld,
  UndoCorrection,
} from "@zoen/contracts/worlds/operations";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, Layer, Option, Result, Schema } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import {
  BrowserApi,
  browserApiLayer,
} from "../../../src/features/worlds/client.ts";

const worldId = "33333333-3333-4333-8333-333333333333";
const operationId = "11111111-1111-4111-8111-111111111111";
const origin = "http://127.0.0.1:4310";
const worldRef = { realm: "live" as const, worldId };

interface Captured {
  readonly cookie: string | undefined;
  readonly path: string;
}

const headerValue = (
  headers: Headers.Headers,
  name: string
): string | undefined => Option.getOrUndefined(Headers.get(headers, name));

const routingCases: readonly {
  readonly path: string;
  readonly payload: SemanticRequest;
}[] = [
  {
    path: "/api/worlds/execute",
    payload: Schema.decodeSync(CreatePersonalWorld)({
      input: {},
      operation: "CreatePersonalWorld",
      operationId,
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    }),
  },
  {
    path: "/api/corrections/execute",
    payload: Schema.decodeSync(UndoCorrection)({
      input: {
        correctionRef: "55555555-5555-4555-8555-555555555555",
        frameRef: "66666666-6666-4666-8666-666666666666",
      },
      operation: "UndoCorrection",
      operationId,
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
      worldRef,
    }),
  },
  {
    path: "/api/sharing/execute",
    payload: Schema.decodeSync(InspectWorldAccess)({
      input: { principalRef: null },
      operation: "InspectWorldAccess",
      purpose: "personal-records",
      schemaVersion: "sharing.v1",
      worldRef,
    }),
  },
  {
    path: "/api/erasure/execute",
    payload: Schema.decodeSync(InspectWorldErasure)({
      input: { operationId: null },
      operation: "InspectWorldErasure",
      purpose: "personal-records",
      schemaVersion: "erasure.v1",
      worldRef,
    }),
  },
  {
    path: "/api/subject-identity/execute",
    payload: Schema.decodeSync(InspectSubjectIdentity)({
      input: {
        anchors: ["obligation-1"],
        atFrame: null,
        interval: {
          _tag: "DateInterval",
          from: "2026-01-01",
          to: "2026-02-01",
        },
      },
      operation: "InspectSubjectIdentity",
      purpose: "personal-records",
      schemaVersion: "subject-identity.v1",
      worldRef,
    }),
  },
];

/** Mirror apps/web client: prependUrl + shared routeExecute, no Cookie header. */
const runWebStyleRouted = (payload: SemanticRequest) =>
  Effect.gen(function* routed() {
    let captured: Captured | undefined;
    const mock = HttpClient.make((request, url) =>
      Effect.sync(() => {
        captured = {
          cookie: headerValue(request.headers, "Cookie"),
          path: url.pathname,
        };
        return HttpClientResponse.fromWeb(
          request,
          Response.json(
            { _tag: "InvalidInput", code: "INVALID_INPUT" },
            { status: 400 }
          )
        );
      })
    );
    const http = mock.pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(origin),
          HttpClientRequest.setHeader("Content-Type", "application/json")
        )
      )
    );
    const client = yield* HttpApiClient.make(ApplicationApi, {
      transformClient: () => http,
    }).pipe(Effect.provide(Layer.succeed(HttpClient.HttpClient, mock)));
    const outcome = yield* routeExecute(client, payload).pipe(
      Effect.provide(Layer.succeed(HttpClient.HttpClient, mock)),
      Effect.result
    );
    expect(Result.isFailure(outcome)).toBeTruthy();
    if (!Result.isFailure(outcome)) {
      return yield* Effect.die("expected InvalidInput from mock HttpClient");
    }
    expect(outcome.failure).toMatchObject(
      new InvalidInput({ code: "INVALID_INPUT" })
    );
    expect(captured).toBeDefined();
    if (captured === undefined) {
      return yield* Effect.die("expected HttpClient capture");
    }
    return captured;
  });

describe("web Worlds execute routing", () => {
  it.effect(
    "shares ApplicationApi group routing without injecting Cookie headers",
    () =>
      Effect.gen(function* routing() {
        for (const entry of routingCases) {
          const captured = yield* runWebStyleRouted(entry.payload);
          expect(captured).toStrictEqual({
            cookie: undefined,
            path: entry.path,
          });
        }
      })
  );

  it.effect(
    "BrowserApi.execute stays cookie-auth (Fetch) and closes errors to SemanticError",
    () => {
      const payload = Schema.decodeSync(CreatePersonalWorld)({
        input: {},
        operation: "CreatePersonalWorld",
        operationId,
        purpose: "personal-records",
        schemaVersion: "worlds.v1",
      });
      return Effect.gen(function* closed() {
        let capturedCredentials: RequestCredentials | undefined;
        const mockFetch: typeof globalThis.fetch = (_input, init) => {
          capturedCredentials = init?.credentials;
          return Promise.resolve(
            Response.json(
              { _tag: "InvalidInput", code: "INVALID_INPUT" },
              { status: 400 }
            )
          );
        };
        const api = yield* BrowserApi.pipe(
          Effect.provide(browserApiLayer(origin))
        );
        const outcome = yield* api
          .execute(payload)
          .pipe(
            Effect.provideService(FetchHttpClient.Fetch, mockFetch),
            Effect.result
          );
        expect(Result.isFailure(outcome)).toBeTruthy();
        if (Result.isFailure(outcome)) {
          expect(outcome.failure).toMatchObject(
            new InvalidInput({ code: "INVALID_INPUT" })
          );
        }
        expect(capturedCredentials).toBe("same-origin");
      });
    }
  );
});
