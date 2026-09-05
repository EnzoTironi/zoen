import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { AuthorityInstallation } from "@zoen/authority/commit/configuration";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import {
  reserveCapture,
  stageCapture,
} from "@zoen/authority/evidence/d01/capture";
import { EvidenceObjectStore } from "@zoen/authority/ports/d01/storage";
import { Effect, Layer, Schedule } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  configuration,
  makeInput,
} from "../../../../../tests/integration/d01/commit/fixture.ts";
import { captureMaintenance } from "../../../src/maintenance/captures.ts";
import { withStorage } from "../../adapters/object-storage/d01/fixture.ts";
import { withD01Database } from "../../adapters/postgres/d01/database.ts";

it.live(
  "EX10 the composed maintenance fiber crosses capture pages and leaves another installation untouched",
  () =>
    withD01Database((database) =>
      withStorage(() =>
        Effect.gen(function* backgroundCaptureConsumer() {
          const { context, request } = yield* makeInput();
          const world = yield* createPersonalWorld(context, request);
          const bytes = new TextEncoder().encode('{"orphan":"actual object"}');
          const uploaded = yield* reserveCapture(
            context,
            world.worldRef,
            bytes
          );
          const location = yield* stageCapture(context, uploaded, bytes);
          for (let index = 0; index < 32; index += 1) {
            yield* reserveCapture(
              context,
              world.worldRef,
              new TextEncoder().encode(`expired-${index}`)
            );
          }
          const installation = yield* AuthorityInstallation;
          const otherInput = yield* makeInput();
          const other = yield* createPersonalWorld(
            otherInput.context,
            otherInput.request
          ).pipe(
            Effect.provideService(AuthorityInstallation, {
              ...installation,
              generationId: randomUUID(),
            })
          );
          yield* reserveCapture(otherInput.context, other.worldRef, bytes);
          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`UPDATE jobs.captures SET expires_at = '2020-01-01T00:00:00.123Z'::timestamptz`
          ).pipe(Effect.provide(database.migration));
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE state = 'removed'`
          ).toStrictEqual([{ count: 0 }]);
          // Exercise the same Layer imported by application composition; no direct call to the sweep function.
          yield* Layer.build(captureMaintenance);
          const removed =
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE world_id = ${world.worldRef.worldId} AND state = 'removed' AND fence = 1`.pipe(
              Effect.repeat({
                schedule: Schedule.spaced("20 millis"),
                while: (rows) => rows[0]?.count !== 33,
              }),
              Effect.timeout("5 seconds")
            );
          expect(removed).toStrictEqual([{ count: 33 }]);
          const store = yield* EvidenceObjectStore;
          expect(yield* store.read(location).pipe(Effect.flip)).toMatchObject({
            _tag: "StorageFailure",
            reason: "NotFound",
          });
          expect(
            yield* sql`SELECT state, fence::text FROM jobs.captures WHERE world_id = ${other.worldRef.worldId}`
          ).toStrictEqual([{ fence: "0", state: "reserved" }]);
          expect(
            yield* sql`SELECT count(*)::int AS count FROM authority.evidence`
          ).toStrictEqual([{ count: 0 }]);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
