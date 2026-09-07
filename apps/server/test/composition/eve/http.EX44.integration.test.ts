import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldCreated } from "@zoen/contracts/d01/operations";
import { Effect, Redacted, Schema } from "effect";

import { http, jsonBody, responseCookie, withD01Http } from "../d01/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const d01 = { purpose: "personal-records", schemaVersion: "d01.v1" };
const eve = { purpose: "personal-records", schemaVersion: "eve.v1" };

it.live(
  "EX44 Eve HTTP fail-closed Blocked when OpenCode key absent; recover/cancel require auth",
  () =>
    withD01Http(({ origin }) =>
      Effect.gen(function* eveHttp() {
        const email = `${randomUUID()}@example.test`;
        const password = Redacted.make(randomBytes(24).toString("base64url"));
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({ email, name: "Eve HTTP", password: Redacted.value(password) })
        );
        expect(signup.status).toBe(200);
        const owner = responseCookie(signup);

        const created = yield* http(
          origin,
          "/api/d01/execute",
          json({
            ...d01,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          owner
        );
        expect(created.status).toBe(200);
        const world = Schema.decodeUnknownSync(WorldCreated)(
          yield* jsonBody(created)
        );

        const conversationId = randomUUID();
        const turn = yield* http(
          origin,
          "/api/eve/execute",
          json({
            ...eve,
            input: {
              conversationId,
              ingressId: randomUUID(),
              messageId: randomUUID(),
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              relationshipId: randomUUID(),
              turnId: randomUUID(),
              userText: "quanto gastei?",
            },
            operation: "AcceptConversationTurn",
            worldRef: world.worldRef,
          }),
          owner
        );
        expect(turn.status).toBe(503);
        expect(yield* jsonBody(turn)).toMatchObject({
          _tag: "Blocked",
          code: "PROFILE_BLOCKED",
        });

        const unauthenticated = yield* http(
          origin,
          "/api/eve/execute",
          json({
            ...eve,
            input: { conversationId },
            operation: "RecoverConversationJournal",
            worldRef: world.worldRef,
          })
        );
        expect(unauthenticated.status).toBe(401);
      })
    )
);
