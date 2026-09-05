import { randomBytes, randomUUID } from "node:crypto";

import { NodeHttpClient } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../../../../apps/server/test/composition/d01/fixture.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";

it.live(
  "independent EX10 audience and byte validation happen before authenticated semantic mutation",
  () =>
    withD01Http(({ database, origin }) =>
      Effect.gen(function* authenticatedTransportRejection() {
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          yield* canonicalJson({
            email: `${randomUUID()}@example.test`,
            name: "Boundary account",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const cookie = Redacted.value(responseCookie(signup));
        const encoder = new TextEncoder();
        const valid = yield* canonicalJson({
          input: {},
          operation: "CreatePersonalWorld",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "d01.v1",
        });
        const normalHeaders = { cookie, origin };
        const cases = [
          {
            body: encoder.encode(valid),
            headers: { cookie },
            name: "absent origin",
            status: 404,
          },
          {
            body: encoder.encode(valid),
            headers: { cookie, origin: "https://attacker.example" },
            name: "foreign origin",
            status: 404,
          },
          {
            body: encoder.encode(valid),
            headers: {
              ...normalHeaders,
              host: "attacker.example",
              "x-forwarded-host": new URL(origin).host,
            },
            name: "forged forwarding",
            status: 404,
          },
          {
            body: encoder.encode(valid),
            headers: { ...normalHeaders, "content-encoding": "gzip" },
            name: "unadmitted encoding",
            status: 400,
          },
          {
            body: new Uint8Array([...encoder.encode(valid), 255]),
            headers: normalHeaders,
            name: "invalid UTF-8",
            status: 400,
          },
          {
            body: encoder.encode(
              valid.replace('"input":{}', '"input":{},"input":{}')
            ),
            headers: normalHeaders,
            name: "duplicate keys",
            status: 400,
          },
        ];
        const outcomes = [];
        for (const entry of cases) {
          const response = yield* HttpClient.HttpClient.use((client) =>
            client.execute(
              HttpClientRequest.post(`${origin}/api/d01/execute`).pipe(
                HttpClientRequest.bodyUint8Array(
                  entry.body,
                  "application/json"
                ),
                HttpClientRequest.setHeaders(entry.headers)
              )
            )
          ).pipe(Effect.provide(NodeHttpClient.layerNodeHttp));
          outcomes.push({
            body: yield* jsonBody(response),
            name: entry.name,
            status: response.status,
          });
        }
        expect(outcomes).toStrictEqual(
          cases.map((entry) => ({
            body:
              entry.status === 404
                ? { _tag: "NotFoundOrDenied", code: "NOT_FOUND_OR_DENIED" }
                : { _tag: "InvalidInput", code: "INVALID_INPUT" },
            name: entry.name,
            status: entry.status,
          }))
        );
        const rows = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT (SELECT count(*)::int FROM authority.worlds) AS worlds, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
        ).pipe(Effect.provide(database.authority));
        expect(rows).toStrictEqual([{ outbox: 0, receipts: 0, worlds: 0 }]);
      })
    )
);
