import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  PutBucketVersioningCommand,
} from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/d01/database.js";
import { createAccount } from "../../../../apps/server/test/identity/d01/http.js";
import { ObjectLocation } from "../../../../packages/authority/src/ports/d01/storage.js";
import { SemanticExecutor } from "../../../../packages/authority/src/semantic/executor.js";
import {
  canonicalJson,
  digestBytes,
} from "../../../../packages/authority/src/values/canonical.js";
import { parseImportDocument } from "../../../../packages/authority/src/values/document.js";
import {
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "../../../../packages/contracts/src/d01/operations.js";
import { configuration } from "../commit/fixture.js";

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );
const envelope = { purpose: "personal-records", schemaVersion: "d01.v1" };
const document =
  'schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo\r\nd01.csv.v1,manual,billing,1,"Fatura, ""setembro""\r\noriginal",row-1,invoice-1,obligation.amount,Known,100.00,BRL,DateInterval,2026-09-01,2026-10-01\r\nd01.csv.v1,manual,billing,1,"Fatura, ""setembro""\r\noriginal",row-2,invoice-1,obligation.amount,Unknown,,,Unknown,,\r\n';

it.live(
  "CSV-07–09 real signup retains versioned CSV bytes, logical records and replay under current authority",
  () =>
    withD01IdentityDatabase((fixture) =>
      withStorage(({ client, config }) =>
        Effect.gen(function* realCsvJourney() {
          yield* sdk((signal) =>
            client.send(
              new PutBucketVersioningCommand({
                Bucket: config.bucket,
                VersioningConfiguration: { Status: "Enabled" },
              }),
              { abortSignal: signal }
            )
          );
          const account = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const sql = yield* SqlClient.SqlClient;
          const created = yield* executor
            .execute(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const { worldRef } = created;
          const request = {
            ...envelope,
            input: { document, format: "d01.csv.v1" },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          };
          const encoded = yield* bytes(request);
          const [first, concurrent] = yield* Effect.all(
            [
              executor.execute(account.credential, encoded),
              executor.execute(account.credential, encoded),
            ],
            { concurrency: "unbounded" }
          );
          const imported =
            yield* Schema.decodeUnknownEffect(EvidenceImported)(first);
          expect(concurrent).toStrictEqual(imported);
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM authority.evidence) AS evidence, (SELECT count(*)::int FROM authority.claims) AS claims, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
          ).toStrictEqual([{ claims: 2, evidence: 1, outbox: 2, receipts: 2 }]);
          const inspected = yield* executor
            .execute(
              account.credential,
              yield* bytes({
                ...envelope,
                input: { atFrame: null, subjectKey: "invoice-1" },
                operation: "Inspect",
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          expect(inspected.frame.verification).toBe("unverified");
          const ordered = inspected.frame.claims.toSorted(
            (left, right) => left.recordIndex - right.recordIndex
          );
          expect(ordered).toMatchObject([
            {
              recordId: "row-1",
              recordIndex: 0,
              source: { label: 'Fatura, "setembro"\r\noriginal' },
              validTime: {
                _tag: "DateInterval",
                from: "2026-09-01",
                to: "2026-10-01",
              },
              value: { _tag: "Known", amount: "100", currency: "BRL" },
            },
            {
              recordId: "row-2",
              recordIndex: 1,
              validTime: { _tag: "Unknown" },
              value: { _tag: "Unknown" },
            },
          ]);
          const open = {
            ...envelope,
            input: { evidenceRef: imported.evidenceRef },
            operation: "OpenEvidence",
            worldRef,
          };
          const opened = yield* executor
            .execute(account.credential, yield* bytes(open))
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceOpened)));
          expect(opened).toStrictEqual({
            _tag: "EvidenceOpened",
            document,
            evidenceRef: imported.evidenceRef,
            mediaType: "text/csv",
          });
          const [stored] =
            yield* sql`SELECT c.document_format, c.object_location FROM jobs.captures c JOIN authority.evidence e USING (world_id, realm, capture_id) WHERE e.evidence_id = ${imported.evidenceRef}`.pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(
                  Schema.Tuple([
                    Schema.Struct({
                      document_format: Schema.Literal("d01.csv.v1"),
                      object_location: ObjectLocation,
                    }),
                  ])
                )
              )
            );
          expect(stored.object_location.documentFormat).toBe("d01.csv.v1");
          expect(stored.object_location.versionId).not.toBeNull();
          const object = yield* sdk((signal) =>
            client.send(
              new GetObjectCommand({
                Bucket: config.bucket,
                Key: stored.object_location.key,
                VersionId: stored.object_location.versionId ?? undefined,
              }),
              { abortSignal: signal }
            )
          );
          const body = yield* Effect.fromNullishOr(object.Body);
          const retained = yield* sdk(() => body.transformToByteArray());
          expect({
            bytes: retained,
            digest: stored.object_location.digest,
            length: object.ContentLength,
            mime: object.ContentType,
          }).toStrictEqual({
            bytes: new TextEncoder().encode(document),
            digest: digestBytes(retained),
            length: new TextEncoder().encode(document).byteLength,
            mime: "text/csv",
          });
          const duplicate = yield* executor
            .execute(
              account.credential,
              yield* bytes({ ...request, operationId: randomUUID() })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          expect(duplicate.evidenceRef).toBe(imported.evidenceRef);
          expect(duplicate.receiptRef).not.toBe(imported.receiptRef);
          expect(
            yield* executor
              .execute(
                account.credential,
                yield* bytes({
                  ...request,
                  input: {
                    ...request.input,
                    document: document.replace("100.00", "200.00"),
                  },
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Conflict" });
          const equivalentJson = yield* canonicalJson(
            yield* parseImportDocument(request.input)
          );
          expect(
            yield* executor
              .execute(
                account.credential,
                yield* bytes({
                  ...request,
                  input: { document: equivalentJson },
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Conflict" });
          const stranger = yield* createAccount(fixture.config.baseUrl);
          const foreignWorld = yield* executor
            .execute(
              stranger.credential,
              yield* bytes({
                ...envelope,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          for (const foreignRequest of [
            open,
            { ...open, worldRef: foreignWorld.worldRef },
            request,
          ]) {
            expect(
              yield* executor
                .execute(stranger.credential, yield* bytes(foreignRequest))
                .pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
          }
          yield* sql`UPDATE authority.memberships SET state = 'revoked', revision = revision + 1 WHERE world_id = ${worldRef.worldId} AND principal_id = ${account.user.id}`;
          expect(
            yield* executor
              .execute(account.credential, encoded)
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(
            yield* executor
              .execute(account.credential, yield* bytes(open))
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
        }).pipe(
          Effect.provide(
            Layer.provideMerge(
              SemanticExecutor.layer,
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime
              )
            )
          )
        )
      )
    )
);

it.live(
  "CSV-05 and CSV-11 reject the complete invalid document before any reservation or semantic publication",
  () =>
    withD01IdentityDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* invalidCsvIsAtomic() {
          const account = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const sql = yield* SqlClient.SqlClient;
          const created = yield* executor
            .execute(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const invalidDocuments = [
            document.replace("row-2", "row-1"),
            document.replace("Unknown,,,Unknown", "Known,1e3,BRL,Unknown"),
            `${document}\n`,
            "界".repeat(90_000),
          ];
          for (const invalidDocument of invalidDocuments) {
            const rejected = yield* executor
              .execute(
                account.credential,
                yield* bytes({
                  ...envelope,
                  input: { document: invalidDocument, format: "d01.csv.v1" },
                  operation: "ImportEvidence",
                  operationId: randomUUID(),
                  worldRef: created.worldRef,
                })
              )
              .pipe(Effect.flip);
            expect(rejected._tag).toBe(
              invalidDocument === invalidDocuments.at(-1)
                ? "QuotaExceeded"
                : "InvalidInput"
            );
          }
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM jobs.captures) AS captures, (SELECT count(*)::int FROM authority.evidence) AS evidence, (SELECT count(*)::int FROM authority.claims) AS claims, (SELECT count(*)::int FROM authority.pins) AS pins, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
          ).toStrictEqual([
            {
              captures: 0,
              claims: 0,
              evidence: 0,
              outbox: 1,
              pins: 0,
              receipts: 1,
            },
          ]);
        }).pipe(
          Effect.provide(
            Layer.provideMerge(
              SemanticExecutor.layer,
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime
              )
            )
          )
        )
      )
    )
);
