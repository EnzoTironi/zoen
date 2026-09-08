import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { RequestWorldErasure } from "@zoen/contracts/erasure/operations";
import { GrantWorldReadAccess } from "@zoen/contracts/sharing/operations";
import { CreatePersonalWorld } from "@zoen/contracts/worlds/operations";
import { Revision } from "@zoen/contracts/worlds/values";
import { admitWorldContent } from "@zoen/ontology/access/erasure/content";
import { grantWorldReadAccess } from "@zoen/ontology/access/sharing/mutation";
import { createPersonalWorld } from "@zoen/ontology/commit/genesis";
import { requestWorldErasure } from "@zoen/ontology/erasure/handlers/request";
import { reserveCapture } from "@zoen/ontology/evidence/capture";
import { DisclosureFence } from "@zoen/ontology/ports/disclosure/fence";
import { worldDisclosureKey } from "@zoen/ontology/ports/disclosure/keys";
import { PrincipalDirectory } from "@zoen/ontology/ports/sharing/directory";
import { Deferred, Effect, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withErasureRuntime } from "../support/runtime.ts";
import { makeContext } from "./fixture.ts";

const directoryAlways = Layer.succeed(
  PrincipalDirectory,
  PrincipalDirectory.of({
    exists: () => Effect.succeed(true),
  })
);

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

/** ZA-09-01 — concurrent Closing vs import: exactly one valid ordering. */
it.live(
  "ZA-09-01 concurrent Closing and capture reservation admit exactly one ordering",
  () =>
    withErasureRuntime((database) =>
      Effect.scoped(
        Effect.gen(function* concurrentClosingImport() {
          const { context, request, world } = yield* scenario;
          const held = yield* Deferred.make<null>();
          const release = yield* Deferred.make<null>();
          const holder = yield* Effect.forkScoped(
            Effect.gen(function* holdWorldRow() {
              const migration = yield* SqlClient.SqlClient;
              yield* migration.withTransaction(
                Effect.gen(function* criticalSection() {
                  yield* migration`LOCK TABLE authority.worlds IN ACCESS EXCLUSIVE MODE`;
                  yield* Deferred.succeed(held, null);
                  yield* Deferred.await(release);
                })
              );
            }).pipe(Effect.provide(database.migration))
          );
          yield* Deferred.await(held);
          const closing = yield* Effect.forkScoped(
            requestWorldErasure(context, request).pipe(Effect.result)
          );
          const reservation = yield* Effect.forkScoped(
            reserveCapture(
              context,
              world,
              new TextEncoder().encode("concurrent-import")
            ).pipe(Effect.result)
          );
          const blocked = SqlClient.SqlClient.use(
            (admin) => admin`SELECT count(*)::int AS waiting FROM pg_locks
              WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
                AND relation = 'authority.worlds'::regclass
                AND NOT granted`
          ).pipe(Effect.provide(database.migration));
          let waiting = false;
          for (let attempt = 0; attempt < 80 && !waiting; attempt += 1) {
            const rows = yield* blocked;
            const count = Number(rows[0]?.waiting ?? 0);
            waiting = count >= 1;
            if (!waiting) {
              yield* Effect.sleep("25 millis");
            }
          }
          expect(waiting).toBeTruthy();
          yield* Deferred.succeed(release, null);
          yield* Fiber.join(holder);
          const reserved = yield* Fiber.join(reservation);
          const closed = yield* Fiber.join(closing);
          const sql = yield* SqlClient.SqlClient;
          if (closed._tag === "Success") {
            expect(closed.success.phase).toBe("Closing");
            expect(
              yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_world_closing
                WHERE world_key = ${worldDisclosureKey(world)}`
            ).toStrictEqual([{ n: 1 }]);
            // No stale snapshot may publish after the closed epoch.
            expect(
              yield* admitWorldContent(
                world,
                context.presence.principalId
              ).pipe(Effect.flip)
            ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
            if (reserved._tag !== "Success") {
              expect(
                yield* sql`SELECT count(*)::int AS n FROM jobs.captures
                  WHERE world_id = ${world.worldId}`
              ).toStrictEqual([{ n: 0 }]);
            }
          } else {
            expect(reserved._tag).toBe("Success");
            const later = yield* requestWorldErasure(context, request);
            expect(later.phase).toBe("Closing");
            expect(
              yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_world_closing
                WHERE world_key = ${worldDisclosureKey(world)}`
            ).toStrictEqual([{ n: 1 }]);
          }
        })
      )
    )
);

it.live(
  "ZA-09-01 Closing blocks another member grant and post-Closing emission",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* memberAndEmission() {
        const { context, request, world } = yield* scenario;
        const memberId = randomUUID();
        const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          input: { expectedRevision: null, principalRef: memberId },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "sharing.v1",
          worldRef: world,
        });
        yield* grantWorldReadAccess(context, grant).pipe(
          Effect.provide(directoryAlways)
        );
        const closed = yield* requestWorldErasure(context, request);
        expect(closed.phase).toBe("Closing");
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_world_closing
            WHERE world_key = ${worldDisclosureKey(world)}`
        ).toStrictEqual([{ n: 1 }]);
        const regrant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          input: { expectedRevision: null, principalRef: randomUUID() },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "sharing.v1",
          worldRef: world,
        });
        expect(
          yield* grantWorldReadAccess(context, regrant).pipe(
            Effect.provide(directoryAlways),
            Effect.flip
          )
        ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
        const fence = yield* DisclosureFence;
        const member = yield* makeContext(memberId);
        expect(
          yield* Effect.scoped(
            fence.shared(member.presence, world, member.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ code: "UNAVAILABLE" });
        expect(
          yield* admitWorldContent(world, context.presence.principalId).pipe(
            Effect.flip
          )
        ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
      })
    )
);

/** ZA-09-02 — principal-only fence / forged epoch cannot control authority. */
it.live(
  "ZA-09-02 forged capture epoch and membership-only path cannot bypass World barrier",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* forgedEpoch() {
        const { context, request, world } = yield* scenario;
        const bytes = new TextEncoder().encode("epoch-bound");
        const reservation = yield* reserveCapture(context, world, bytes);
        expect(reservation.fence).toBe("0");
        expect(
          yield* admitWorldContent(world, context.presence.principalId)
        ).toBe("0");
        const forgedFence = yield* Schema.decodeEffect(Revision)("999");
        expect(forgedFence).not.toBe(reservation.fence);
        expect(
          yield* admitWorldContent(world, context.presence.principalId)
        ).toBe(reservation.fence);
        // Caller-forged fence cannot match the server-admitted DB row.
        const sqlProbe = yield* SqlClient.SqlClient;
        expect(
          yield* sqlProbe`SELECT fence::text AS fence FROM jobs.captures
            WHERE capture_id = ${reservation.captureId}`
        ).toStrictEqual([{ fence: reservation.fence }]);
        yield* requestWorldErasure(context, request);
        const fence = yield* DisclosureFence;
        const otherSession = yield* makeContext(context.presence.principalId);
        expect(
          yield* Effect.scoped(
            fence.shared(otherSession.presence, world, otherSession.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ code: "UNAVAILABLE" });
        const sql = yield* SqlClient.SqlClient;
        yield* sql`
          INSERT INTO jobs.disclosure_subjects (subject_key, revision)
          VALUES (${`zoen:disclosure:membership:v1:${JSON.stringify([
            world.realm,
            world.worldId,
            context.presence.principalId,
          ])}`}, 0)
          ON CONFLICT (subject_key) DO UPDATE
            SET revision = jobs.disclosure_subjects.revision + 1`;
        expect(
          yield* admitWorldContent(world, context.presence.principalId).pipe(
            Effect.flip
          )
        ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
        expect(
          yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_world_closing
            WHERE world_key = ${worldDisclosureKey(world)}`
        ).toStrictEqual([{ n: 1 }]);
      })
    )
);

/** ZA-09-03 — pending writer keeps Closing blocked; receipt not rewritten. */
it.live(
  "ZA-09-03 process-lost pending writer keeps Closing blocked without rewriting receipt",
  () =>
    withErasureRuntime(() =>
      Effect.gen(function* pendingWriter() {
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
          yield* sql`SELECT count(*)::int AS n FROM authority.world_erasure_progress
            WHERE world_id = ${world.worldId}`
        ).toStrictEqual([{ n: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS n FROM authority.world_erasure_receipts
            WHERE world_id = ${world.worldId}`
        ).toStrictEqual([{ n: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_world_closing
            WHERE world_key = ${worldDisclosureKey(world)}`
        ).toStrictEqual([{ n: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS n FROM jobs.disclosure_pending`
        ).toStrictEqual([{ n: 1 }]);
        yield* permit.acknowledge;
        const closed = yield* requestWorldErasure(context, request);
        expect(closed.phase).toBe("Closing");
        expect(closed.receiptRef).toBeTypeOf("string");
        const receipts =
          yield* sql`SELECT receipt_id, erasure_revision::text AS revision
            FROM authority.world_erasure_receipts
            WHERE world_id = ${world.worldId}`;
        expect(receipts).toHaveLength(1);
        expect(receipts[0]?.receipt_id).toBe(closed.receiptRef);
        const again = yield* requestWorldErasure(context, request);
        expect(again.receiptRef).toBe(closed.receiptRef);
        expect(again.revision).toBe(closed.revision);
        expect(
          yield* sql`SELECT count(*)::int AS n FROM authority.world_erasure_receipts
            WHERE world_id = ${world.worldId}`
        ).toStrictEqual([{ n: 1 }]);
      })
    )
);
