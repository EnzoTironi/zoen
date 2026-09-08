import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { RequestWorldErasure } from "@zoen/contracts/erasure/operations";
import { CreatePersonalWorld } from "@zoen/contracts/worlds/operations";
import { authorizeWorld } from "@zoen/ontology/access/world";
import { createPersonalWorld } from "@zoen/ontology/commit/genesis";
import { requestWorldErasure } from "@zoen/ontology/knowledge/erasure/handlers/request";
import { DisclosureFence } from "@zoen/ontology/ports/disclosure/fence";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withErasureRuntime } from "../support/runtime.ts";
import { makeContext } from "./fixture.ts";

const scenario = Effect.gen(function* createScenario() {
  const context = yield* makeContext();
  const created = yield* createPersonalWorld(
    context,
    yield* Schema.decodeEffect(CreatePersonalWorld)({
      input: {},
      operation: "CreatePersonalWorld",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    })
  );
  const request = yield* Schema.decodeEffect(RequestWorldErasure)({
    input: {
      confirmEntireWorld: true,
      expectedErasureRevision: null,
      policyVersion: "worlds-local-erasable-v1",
    },
    operation: "RequestWorldErasure",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "erasure.v1",
    worldRef: created.worldRef,
  });
  return { context, request, world: created.worldRef };
});

it.live(
  "Closing denies content and sharing while retaining narrow owner erasure access",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* closedAccess() {
        const { context, request, world } = yield* scenario;
        yield* authorizeWorld(context, world, "read");
        const closed = yield* requestWorldErasure(context, request);
        expect(closed.phase).toBe("Closing");
        for (const capability of ["read", "mutate", "manage"] as const) {
          expect(
            yield* authorizeWorld(context, world, capability).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
        }
        yield* authorizeWorld(context, world, "erasure");
        expect(yield* requestWorldErasure(context, request)).toStrictEqual(
          closed
        );
        const other = yield* scenario;
        yield* authorizeWorld(other.context, other.world, "read");
      })
    )
);

it.live(
  "live emission reservation prevents Closing without fabricating an acknowledgement",
  () =>
    withErasureRuntime(() =>
      Effect.scoped(
        Effect.gen(function* liveEmission() {
          const { context, request, world } = yield* scenario;
          const fence = yield* DisclosureFence;
          const permit = yield* fence.shared(
            context.presence,
            world,
            context.deadline
          );
          expect(
            yield* requestWorldErasure(context, request).pipe(Effect.flip)
          ).toMatchObject({ code: "UNAVAILABLE" });
          yield* authorizeWorld(context, world, "read");
          yield* permit.acknowledge;
          expect((yield* requestWorldErasure(context, request)).phase).toBe(
            "Closing"
          );
        })
      )
    )
);

it.live(
  "lost emitter session leaves durable pending proof blocking Closing until trusted ACK",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* uncertainEmission() {
        const { context, request, world } = yield* scenario;
        const fence = yield* DisclosureFence;
        const permit = yield* Effect.scoped(
          fence.shared(context.presence, world, context.deadline)
        );
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* requestWorldErasure(context, request).pipe(Effect.flip)
        ).toMatchObject({ code: "UNAVAILABLE" });
        expect(
          yield* sql`SELECT count(*)::int AS count FROM jobs.disclosure_pending`
        ).toStrictEqual([{ count: 1 }]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM authority.world_erasure_progress`
        ).toStrictEqual([{ count: 0 }]);
        yield* permit.acknowledge;
        expect((yield* requestWorldErasure(context, request)).phase).toBe(
          "Closing"
        );
      })
    )
);
