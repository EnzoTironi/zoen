import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  PutBucketVersioningCommand,
} from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  CaptureId,
  EvidenceObjectStore,
  ObjectLocation,
} from "@zoen/authority/ports/worlds/storage";
import { digestBytes } from "@zoen/authority/values/canonical";
import { ImportDocument } from "@zoen/contracts/worlds/evidence";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema, Stream } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import {
  claimRow,
  seedEvidence,
} from "../../../../apps/server/test/adapters/postgres/worlds/seed.ts";
import {
  applyApplicationMigrations,
  applyWorldsBaselineMigrations,
} from "../../../../ops/migrations/run.ts";

// Real SQL fixture history; no claim of normal authentication or semantic admission.
// Explicit baseline columns keep setup independent of future CSV import implementation.
// CSV-12 partial: preserves SQL rows/objects; does not prove historical Frames or release admission.
const snapshotHistory = Effect.gen(function* snapshotHistory() {
  const sql = yield* SqlClient.SqlClient;
  const result: Record<string, unknown> = {};
  for (const table of [
    "authority.worlds",
    "authority.memberships",
    "authority.domains",
    "authority.sources",
    "authority.evidence",
    "authority.claims",
    "authority.receipts",
    "authority.pins",
    "jobs.captures",
  ] as const) {
    result[table] = yield* sql.unsafe(
      `SELECT COALESCE(jsonb_agg(to_jsonb(row) - 'document_format' ORDER BY (to_jsonb(row) - 'document_format')::text), '[]'::jsonb) AS rows FROM ${table} AS row`
    );
  }
  result.migrations =
    yield* sql`SELECT * FROM public.effect_sql_migrations WHERE migration_id <= 3 ORDER BY migration_id`;
  return result;
});

it.live(
  "independent migration 004 preserves real legacy SQL history and exact versioned JSON bytes",
  () =>
    withWorldsDatabase(
      (database) =>
        withStorage(({ client, config }) =>
          Effect.gen(function* upgradeHistory() {
            const sql = yield* SqlClient.SqlClient;
            const store = yield* EvidenceObjectStore;
            yield* sdk((signal) =>
              client.send(
                new PutBucketVersioningCommand({
                  Bucket: config.bucket,
                  VersioningConfiguration: { Status: "Enabled" },
                }),
                { abortSignal: signal }
              )
            );
            const seed = yield* seedEvidence();
            const claim = claimRow(seed);
            const document = yield* Schema.decodeEffect(ImportDocument)({
              records: [
                {
                  externalId: claim.external_id,
                  predicate: "obligation.amount",
                  subjectKey: claim.subject_key,
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-01-01",
                    to: "2026-02-01",
                  },
                  value: { _tag: "Known", amount: "0", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: seed.source,
                label: "SQL integrity fixture",
                namespace: "ex06",
                revision: "revision-1",
              },
            }).pipe(
              Effect.flatMap(
                Schema.encodeEffect(Schema.fromJsonString(ImportDocument))
              )
            );
            const bytes = new TextEncoder().encode(document);
            const location = yield* store.stage({
              captureId: yield* Schema.decodeEffect(CaptureId)(seed.capture),
              content: Stream.make(bytes),
              expectedBytes: bytes.byteLength,
              expectedDigest: digestBytes(bytes),
              worldRef: yield* Schema.decodeEffect(WorldRef)({
                realm: seed.realm,
                worldId: seed.worldId,
              }),
            });
            expect(location.versionId).not.toBeNull();
            expect(Object.hasOwn(location, "documentFormat")).toBeFalsy();
            const encodedLocation = yield* Schema.encodeEffect(
              Schema.fromJsonString(ObjectLocation)
            )(location);
            yield* sql`UPDATE jobs.captures SET state = 'admitted', byte_length = ${bytes.byteLength}, expected_digest = ${digestBytes(bytes)}, object_location = ${encodedLocation}::jsonb WHERE capture_id = ${seed.capture}`;
            yield* sql`UPDATE authority.evidence SET byte_digest = ${digestBytes(bytes)} WHERE evidence_id = ${seed.evidence}`;
            yield* sql`INSERT INTO authority.claims ${sql.insert(claim)}`;
            yield* sql`INSERT INTO authority.pins ${sql.insert({ created_at: "2026-09-05T00:00:00.000Z", evidence_id: seed.evidence, owner_id: seed.evidence, owner_kind: "evidence", realm: seed.realm, world_id: seed.worldId })}`;
            const before = yield* snapshotHistory;
            const absentColumn =
              yield* sql`SELECT document_format FROM jobs.captures`.pipe(
                Effect.flip
              );
            expect(absentColumn).toMatchObject({
              _tag: "SqlError",
              reason: { cause: { code: "42703" } },
            });
            expect(
              yield* sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'jobs' AND table_name = 'captures' AND column_name = 'document_format'`
            ).toStrictEqual([]);
            const migrations = Layer.mergeAll(
              database.migration,
              NodeServices.layer
            );
            expect(
              yield* applyApplicationMigrations(database.names).pipe(
                Effect.provide(migrations)
              )
            ).toStrictEqual([[4, "evidence_document_format"]]);
            expect(yield* snapshotHistory).toStrictEqual(before);
            expect(
              yield* sql`SELECT document_format FROM jobs.captures WHERE capture_id = ${seed.capture}`
            ).toStrictEqual([{ document_format: "worlds.json.v1" }]);
            const [row] =
              yield* sql`SELECT object_location FROM jobs.captures WHERE capture_id = ${seed.capture}`;
            const stored = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ object_location: ObjectLocation })
            )(row);
            expect(stored.object_location).toStrictEqual(location);
            expect(yield* store.read(stored.object_location)).toStrictEqual(
              bytes
            );
            const observed = yield* sdk((signal) =>
              client.send(
                new GetObjectCommand({
                  Bucket: config.bucket,
                  Key: location.key,
                  VersionId: location.versionId ?? undefined,
                }),
                { abortSignal: signal }
              )
            );
            expect(observed.VersionId).toBe(location.versionId);
            expect(observed.ContentType).toBe("application/json");
            const body = yield* Effect.fromNullishOr(observed.Body);
            expect(yield* sdk(() => body.transformToByteArray())).toStrictEqual(
              bytes
            );
            for (const invalid of [
              "d01.xml.v1",
              "d01.json.v1",
              "d01.csv.v1",
              "",
              "D01.CSV.V1",
            ]) {
              expect(
                yield* sql`UPDATE jobs.captures SET document_format = ${invalid} WHERE capture_id = ${seed.capture}`.pipe(
                  Effect.flip
                )
              ).toMatchObject({
                _tag: "SqlError",
                reason: {
                  cause: {
                    code: "23514",
                    constraint: "captures_document_format_check",
                  },
                },
              });
            }
            expect(
              yield* sql`UPDATE jobs.captures SET document_format = NULL WHERE capture_id = ${seed.capture}`.pipe(
                Effect.flip
              )
            ).toMatchObject({
              _tag: "SqlError",
              reason: { cause: { code: "23502", column: "document_format" } },
            });
            expect(yield* snapshotHistory).toStrictEqual(before);
            const csvCapture = randomUUID();
            const csvBytes = new TextEncoder().encode(
              `schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo\nworlds.csv.v1,ex06,${seed.source},revision-1,SQL integrity fixture,${claim.external_id},${claim.subject_key},obligation.amount,Known,0,BRL,DateInterval,2026-01-01,2026-02-01\n`
            );
            yield* sql`INSERT INTO jobs.captures (world_id, realm, capture_id, principal_id, state, object_location, expected_digest, byte_length, expires_at, fence, document_format) SELECT world_id, realm, ${csvCapture}::uuid, principal_id, 'reserved', NULL, ${digestBytes(csvBytes)}, ${csvBytes.byteLength}, expires_at, 0, 'worlds.csv.v1' FROM jobs.captures WHERE capture_id = ${seed.capture}`;
            expect(
              yield* sql`SELECT document_format FROM jobs.captures WHERE capture_id = ${csvCapture}`
            ).toStrictEqual([{ document_format: "worlds.csv.v1" }]);
            const after = yield* snapshotHistory;
            const metadata =
              yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`;
            expect(
              yield* applyApplicationMigrations(database.names).pipe(
                Effect.provide(migrations)
              )
            ).toStrictEqual([]);
            expect(
              yield* applyWorldsBaselineMigrations(database.names).pipe(
                Effect.provide(migrations)
              )
            ).toStrictEqual([]);
            expect(yield* snapshotHistory).toStrictEqual(after);
            expect(
              yield* sql`SELECT * FROM public.effect_sql_migrations ORDER BY migration_id`
            ).toStrictEqual(metadata);
            expect(
              yield* sql`SELECT capture_id, document_format FROM jobs.captures ORDER BY capture_id`
            ).toStrictEqual(
              [
                { capture_id: seed.capture, document_format: "worlds.json.v1" },
                { capture_id: csvCapture, document_format: "worlds.csv.v1" },
              ].toSorted((a, b) => a.capture_id.localeCompare(b.capture_id))
            );
            expect(yield* store.read(location)).toStrictEqual(bytes);
          }).pipe(Effect.provide(database.migration))
        ),
      undefined,
      (database) =>
        applyWorldsBaselineMigrations(database.names).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        )
    )
);
