import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withIdentityDatabase } from "../../../../apps/server/test/identity/worlds/database.ts";
import { createAccount } from "../../../../apps/server/test/identity/worlds/http.ts";
import { SemanticExecutor } from "../../../../packages/authority/src/semantic/executor.ts";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.ts";
import { parseImportDocument } from "../../../../packages/authority/src/values/document.ts";
import {
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "../../../../packages/contracts/src/worlds/operations.ts";
import { configuration } from "../commit/fixture.ts";

const encoded = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((text) => new TextEncoder().encode(text))
  );
const envelope = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const header =
  "schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo";
const label = 'Cafe\u0301, "conta"\r\nlinha';
const quotedLabel = '"Cafe\u0301, ""conta""\r\nlinha"';
// These equivalent representations are independently authored, not produced by the parser under test.
const jsonDocument = {
  records: [
    {
      externalId: "r1",
      predicate: "obligation.amount",
      subjectKey: "invoice-1",
      validTime: { _tag: "Unknown" },
      value: { _tag: "Known", amount: "0.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: { externalId: "billing", label, namespace: "manual", revision: "1" },
};
const csv = (separator: "\n" | "\r\n", quoteZero = false) =>
  `${header}${separator}worlds.csv.v1,manual,billing,1,${quotedLabel},r1,invoice-1,obligation.amount,Known,${quoteZero ? '"0.00"' : "0.00"},BRL,Unknown,,${separator}`;

it.live(
  "independent CSV review: equivalent representations never erase byte identity or bypass input validation on replay",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* replayRepresentation() {
          const account = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const sql = yield* SqlClient.SqlClient;
          const json = yield* canonicalJson(jsonDocument);
          const representations = [
            { document: json },
            { document: csv("\n"), format: "worlds.csv.v1" },
            { document: csv("\r\n"), format: "worlds.csv.v1" },
            { document: csv("\n", true), format: "worlds.csv.v1" },
          ];
          for (const input of representations) {
            expect(yield* parseImportDocument(input)).toStrictEqual(
              jsonDocument
            );
          }
          for (const firstInput of representations.slice(0, 2)) {
            const created = yield* executor
              .execute(
                account.credential,
                yield* encoded({
                  ...envelope,
                  input: {},
                  operation: "CreatePersonalWorld",
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
            const request = {
              ...envelope,
              input: firstInput,
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            };
            const receipt = yield* executor
              .execute(account.credential, yield* encoded(request))
              .pipe(
                Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
              );
            const inspectRequest = {
              ...envelope,
              input: { atFrame: null, subjectKey: "invoice-1" },
              operation: "Inspect",
              worldRef: created.worldRef,
            };
            const saved = yield* executor
              .execute(account.credential, yield* encoded(inspectRequest))
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
            expect(saved.frame.claims).toHaveLength(1);
            expect(saved.frame.claims[0]).toMatchObject({
              recordIndex: 0,
              source: { label },
              validTime: { _tag: "Unknown" },
              value: { _tag: "Known", amount: "0", currency: "BRL" },
              verification: "unverified",
            });
            const snapshot = () =>
              sql`SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY receipt_id) FROM authority.receipts r WHERE world_id = ${created.worldRef.worldId}) AS receipts, (SELECT jsonb_agg(to_jsonb(c) ORDER BY claim_id) FROM authority.claims c WHERE world_id = ${created.worldRef.worldId}) AS claims, (SELECT jsonb_agg(to_jsonb(d) ORDER BY domain_key) FROM authority.domains d WHERE world_id = ${created.worldRef.worldId}) AS domains, (SELECT jsonb_agg(to_jsonb(o) ORDER BY operation_id) FROM authority.operations o WHERE world_id = ${created.worldRef.worldId}) AS operations`;
            const before = yield* snapshot();
            for (const input of representations.filter(
              (candidate) => candidate !== firstInput
            )) {
              for (const operationId of [request.operationId, randomUUID()]) {
                expect(
                  yield* executor
                    .execute(
                      account.credential,
                      yield* encoded({ ...request, input, operationId })
                    )
                    .pipe(Effect.flip)
                ).toMatchObject({ _tag: "Conflict" });
              }
            }
            for (const input of [
              { document: csv("\n") },
              { document: json, format: "worlds.csv.v1" },
              { document: csv("\n"), format: "worlds.json.v1" },
            ]) {
              expect(
                yield* executor
                  .execute(
                    account.credential,
                    yield* encoded({ ...request, input })
                  )
                  .pipe(Effect.flip)
              ).toMatchObject({ _tag: "InvalidInput" });
            }
            expect(
              yield* executor.execute(
                account.credential,
                yield* encoded(request)
              )
            ).toStrictEqual(receipt);
            expect(yield* snapshot()).toStrictEqual(before);
            expect(
              yield* executor.execute(
                account.credential,
                yield* encoded({
                  ...inspectRequest,
                  input: {
                    ...inspectRequest.input,
                    atFrame: saved.frame.frameRef,
                  },
                })
              )
            ).toStrictEqual(saved);
            const opened = yield* executor
              .execute(
                account.credential,
                yield* encoded({
                  ...envelope,
                  input: { evidenceRef: receipt.evidenceRef },
                  operation: "OpenEvidence",
                  worldRef: created.worldRef,
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceOpened)));
            expect(opened.document).toBe(firstInput.document);
            expect(opened.mediaType).toBe(
              "format" in firstInput ? "text/csv" : "application/json"
            );
          }
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
