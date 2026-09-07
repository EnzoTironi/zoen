import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldAccessInspected } from "@zoen/contracts/sharing/operations";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";

import {
  http,
  jsonBody,
  responseCookie,
  withWorldsHttp,
} from "../worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const worldsBasis = { purpose: "personal-records", schemaVersion: "worlds.v1" };

it.live(
  "ZA-03 obsolete /api/d03/sharing is rejected while /api/sharing/execute admits InspectWorldAccess",
  () =>
    withWorldsHttp(({ origin }) =>
      Effect.gen(function* obsoleteSharingRoute() {
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "ZA-03 wire",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const cookie = responseCookie(signup);
        const create = yield* http(
          origin,
          "/api/worlds/execute",
          json({
            ...worldsBasis,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          cookie
        );
        expect(create.status).toBe(200);
        const created = yield* jsonBody(create).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );

        const obsolete = yield* http(
          origin,
          "/api/d03/sharing",
          json({
            input: { principalRef: null },
            operation: "InspectWorldAccess",
            purpose: "personal-records",
            schemaVersion: "d03.sharing.v1",
            worldRef: created.worldRef,
          }),
          cookie
        );
        expect(obsolete.status).not.toBe(200);

        const current = yield* http(
          origin,
          "/api/sharing/execute",
          json({
            input: { principalRef: null },
            operation: "InspectWorldAccess",
            purpose: "personal-records",
            schemaVersion: "sharing.v1",
            worldRef: created.worldRef,
          }),
          cookie
        );
        expect(current.status).toBe(200);
        yield* jsonBody(current).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldAccessInspected))
        );
      })
    )
);
