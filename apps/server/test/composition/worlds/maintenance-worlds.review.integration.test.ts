import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { AuthorityInstallation } from "@zoen/authority/commit/configuration";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import {
  reserveCapture,
  stageCapture,
} from "@zoen/authority/evidence/worlds/capture";
import { importEvidence } from "@zoen/authority/evidence/worlds/import";
import {
  CaptureId,
  EvidenceObjectStore,
} from "@zoen/authority/ports/worlds/storage";
import { canonicalJson } from "@zoen/authority/values/canonical";
import { ImportEvidence } from "@zoen/contracts/worlds/operations";
import { Digest } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  configuration,
  makeInput,
} from "../../../../../tests/integration/worlds/commit/fixture.ts";
import { sweepCaptureWorldPage } from "../../../src/maintenance/captures.ts";
import { withStorage } from "../../adapters/object-storage/worlds/fixture.ts";
import { withD01Database } from "../../adapters/postgres/worlds/database.ts";

it.live(
  "independent maintenance visits 33 Worlds fairly and preserves admitted bytes",
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
            const next = yield* makeInput();
            const created = yield* createPersonalWorld(
              next.context,
              next.request
            );
            yield* reserveCapture(next.context, created.worldRef, bytes);
          }
          const document = yield* canonicalJson({
            records: [
              {
                externalId: "invoice-1",
                predicate: "obligation.amount",
                subjectKey: "invoice-1",
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-01",
                  to: "2026-10-01",
                },
                value: { _tag: "Known", amount: "100.00", currency: "BRL" },
              },
            ],
            schemaVersion: "worlds.v1",
            source: {
              externalId: "source",
              label: "Source",
              namespace: "maintenance",
              revision: "1",
            },
          });
          yield* importEvidence(
            context,
            yield* Schema.decodeEffect(ImportEvidence)({
              input: { document },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef: world.worldRef,
            })
          );
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
          const firstCursor = yield* sweepCaptureWorldPage(null);
          expect(firstCursor).not.toBeNull();
          expect(
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE state = 'removed'`
          ).toStrictEqual([{ count: 32 }]);
          const secondCursor = yield* sweepCaptureWorldPage(firstCursor);
          expect(secondCursor).toBeNull();
          expect(
            yield* sql`SELECT count(*)::int AS count FROM jobs.captures WHERE state = 'removed'`
          ).toStrictEqual([{ count: 33 }]);
          expect(
            yield* sql`SELECT state, fence::text FROM jobs.captures WHERE state = 'admitted'`
          ).toStrictEqual([{ fence: "0", state: "admitted" }]);
          const store = yield* EvidenceObjectStore;
          const [admitted] =
            yield* sql`SELECT capture_id, byte_length, expected_digest FROM jobs.captures WHERE state = 'admitted'`;
          if (admitted === undefined) {
            throw new Error("Real import must retain admitted capture");
          }
          const capture = yield* Schema.decodeUnknownEffect(
            Schema.Struct({
              byte_length: Schema.Int,
              capture_id: CaptureId,
              expected_digest: Digest,
            })
          )(admitted);
          const admittedLocation = yield* store.locate({
            captureId: capture.capture_id,
            expectedBytes: capture.byte_length,
            expectedDigest: capture.expected_digest,
            worldRef: world.worldRef,
          });
          expect(
            new TextDecoder().decode(yield* store.read(admittedLocation))
          ).toBe(document);

          expect(yield* store.read(location).pipe(Effect.flip)).toMatchObject({
            _tag: "StorageFailure",
            reason: "NotFound",
          });
          expect(
            yield* sql`SELECT state, fence::text FROM jobs.captures WHERE world_id = ${other.worldRef.worldId}`
          ).toStrictEqual([{ fence: "0", state: "reserved" }]);
          expect(
            yield* sql`SELECT count(*)::int AS count FROM authority.evidence`
          ).toStrictEqual([{ count: 1 }]);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
