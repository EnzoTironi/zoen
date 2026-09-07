import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { Effect, Redacted, Schema } from "effect";

import {
  http,
  jsonBody,
  responseCookie,
  withWorldsHttp,
} from "../worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const d01 = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const eve = { purpose: "personal-records", schemaVersion: "eve.v1" };

it.live(
  "ZA-17 makeApplication with OpenCode key still Blocked on Eve accept",
  () =>
    withWorldsHttp(
      ({ origin }) =>
        Effect.gen(function* eveHttpKeyPresent() {
          const email = `${randomUUID()}@example.test`;
          const password = Redacted.make(randomBytes(24).toString("base64url"));
          const signup = yield* http(
            origin,
            "/api/auth/sign-up/email",
            json({
              email,
              name: "Eve ZA17",
              password: Redacted.value(password),
            })
          );
          expect(signup.status).toBe(200);
          const owner = responseCookie(signup);

          const created = yield* http(
            origin,
            "/api/worlds/execute",
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

          const turn = yield* http(
            origin,
            "/api/eve/execute",
            json({
              ...eve,
              input: {
                conversationId: randomUUID(),
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
        }),
      {
        openCodeZen: {
          apiKey: Redacted.make("za17-host-key-must-not-admit-product"),
          baseUrl: "https://example.test/zen/v1",
          model: "big-pickle",
        },
      }
    )
);
