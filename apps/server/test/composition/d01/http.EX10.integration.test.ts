import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { http, jsonBody, responseCookie, withD01Http } from "./fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "d01.v1" };
const executePath = "/api/d01/execute";
const document = (source: string, amount: string) =>
  json({
    records: [
      {
        externalId: "obligation-1",
        predicate: "obligation.amount",
        subjectKey: "obligation-1",
        validTime: {
          _tag: "DateInterval",
          from: "2026-09-01",
          to: "2026-10-01",
        },
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "d01.v1",
    source: {
      externalId: source,
      label: source,
      namespace: "http-test",
      revision: "1",
    },
  });

it.live(
  "EX10 real HTTP authenticates, retains rival evidence, replays and denies current revoked access",
  () =>
    withD01Http(({ database, origin }) =>
      Effect.gen(function* realJourney() {
        const ready = yield* http(origin, "/ready");
        expect({
          body: yield* jsonBody(ready),
          status: ready.status,
        }).toStrictEqual({ body: { status: "ready" }, status: 200 });
        const email = `${randomUUID()}@example.test`;
        const password = Redacted.make(randomBytes(24).toString("base64url"));
        const credentials = { email, password: Redacted.value(password) };
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({ ...credentials, name: "HTTP account" })
        );
        expect(signup.status).toBe(200);
        const signupCookie = responseCookie(signup);
        const initialLogout = yield* http(
          origin,
          "/api/auth/sign-out",
          "{}",
          signupCookie
        );
        expect(initialLogout.status).toBe(200);
        const login = yield* http(
          origin,
          "/api/auth/sign-in/email",
          json(credentials)
        );
        expect({
          cache: login.headers["cache-control"],
          status: login.status,
        }).toStrictEqual({ cache: "no-store", status: 200 });
        const owner = responseCookie(login);
        const createRequest = {
          ...envelope,
          input: {},
          operation: "CreatePersonalWorld",
          operationId: randomUUID(),
        };
        const create = yield* http(
          origin,
          executePath,
          json(createRequest),
          owner
        );
        const created = yield* jsonBody(create).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        expect(create.status).toBe(200);
        const retry = yield* http(
          origin,
          executePath,
          json(createRequest),
          owner
        );
        expect(yield* jsonBody(retry)).toStrictEqual(created);
        const firstDocument = document("billing", "100.00");
        const importRequest = {
          ...envelope,
          input: { document: firstDocument },
          operation: "ImportEvidence",
          operationId: randomUUID(),
          worldRef: created.worldRef,
        };
        const first = yield* http(
          origin,
          executePath,
          json(importRequest),
          owner
        );
        const evidence = yield* jsonBody(first).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
        );
        const second = yield* http(
          origin,
          executePath,
          json({
            ...importRequest,
            input: { document: document("bank-statement", "200.00") },
            operationId: randomUUID(),
          }),
          owner
        );
        expect({ first: first.status, second: second.status }).toStrictEqual({
          first: 200,
          second: 200,
        });
        const importRetry = yield* http(
          origin,
          executePath,
          json(importRequest),
          owner
        );
        expect(yield* jsonBody(importRetry)).toStrictEqual(evidence);
        const inspectRequest = {
          ...envelope,
          input: { atFrame: null, subjectKey: "obligation-1" },
          operation: "Inspect",
          worldRef: created.worldRef,
        };
        const inspect = yield* http(
          origin,
          executePath,
          json(inspectRequest),
          owner
        );
        const frame = yield* jsonBody(inspect).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        expect({
          claims: frame.frame.claims.length,
          contested: frame.frame.contested,
          corrections: frame.frame.scopedCorrections,
          selection: frame.frame.selection._tag,
          verification: frame.frame.verification,
        }).toStrictEqual({
          claims: 2,
          contested: true,
          corrections: [],
          selection: "unresolved",
          verification: "unverified",
        });
        const open = yield* http(
          origin,
          executePath,
          json({
            ...envelope,
            input: { evidenceRef: evidence.evidenceRef },
            operation: "OpenEvidence",
            worldRef: created.worldRef,
          }),
          owner
        );
        const opened = yield* jsonBody(open).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceOpened))
        );
        expect(opened.document).toBe(firstDocument);
        const strangerSignup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Second account",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(strangerSignup.status).toBe(200);
        const stranger = responseCookie(strangerSignup);
        const denied = yield* http(
          origin,
          executePath,
          json(inspectRequest),
          stranger
        );
        expect({
          body: yield* jsonBody(denied),
          status: denied.status,
        }).toStrictEqual({
          body: { _tag: "NotFoundOrDenied", code: "NOT_FOUND_OR_DENIED" },
          status: 404,
        });
        const counts = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT (SELECT count(*)::int FROM authority.worlds) AS worlds, (SELECT count(*)::int FROM authority.evidence) AS evidence, (SELECT count(*)::int FROM authority.claims) AS claims, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
        ).pipe(Effect.provide(database.authority));
        expect(counts).toStrictEqual([
          { claims: 2, evidence: 2, outbox: 3, receipts: 3, worlds: 1 },
        ]);
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`UPDATE authority.memberships SET state = 'revoked', revision = revision + 1 WHERE world_id = ${created.worldRef.worldId}`
        ).pipe(Effect.provide(database.authority));
        const revoked = yield* http(
          origin,
          executePath,
          json(importRequest),
          owner
        );
        expect(revoked.status).toBe(404);
        const logout = yield* http(origin, "/api/auth/sign-out", "{}", owner);
        expect(logout.status).toBe(200);
        const loggedOutReplay = yield* http(
          origin,
          executePath,
          json(createRequest),
          owner
        );
        expect(loggedOutReplay.status).toBe(401);
      })
    )
);

it.live(
  "EX10 HTTP preserves strict bytes and rejects cross-origin and oversized requests",
  () =>
    withD01Http(({ origin }) =>
      Effect.gen(function* requestBoundaries() {
        const duplicate = yield* http(
          origin,
          executePath,
          '{"schemaVersion":"d01.v1","schemaVersion":"d01.v1"}'
        );
        expect({
          body: yield* jsonBody(duplicate),
          status: duplicate.status,
        }).toStrictEqual({
          body: { _tag: "InvalidInput", code: "INVALID_INPUT" },
          status: 400,
        });
        const crossOrigin = yield* http(
          origin,
          executePath,
          "{}",
          undefined,
          "https://untrusted.example"
        );
        expect(crossOrigin.status).toBe(404);
        const oversized = yield* http(
          origin,
          executePath,
          " ".repeat(1024 * 1024 + 1)
        );
        expect({
          body: yield* jsonBody(oversized),
          status: oversized.status,
        }).toStrictEqual({
          body: { _tag: "QuotaExceeded", code: "QUOTA_EXCEEDED" },
          status: 429,
        });
        const invalidAuth = yield* http(
          origin,
          "/api/auth/sign-up/email",
          '{"email":"a@example.test","email":"b@example.test"}'
        );
        expect(invalidAuth.status).toBe(400);
      })
    )
);
