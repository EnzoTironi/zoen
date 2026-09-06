import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import {
  CorrectionApplied,
  CorrectionProposed,
  CorrectionUndone,
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { D01Auth } from "../../../../apps/server/src/identity/d01/identity.ts";
import {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
} from "./fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "d01.v1" };
const executePath = "/api/d01/execute";
const correctionsPath = "/api/d01/corrections";
const validTime = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};
const csvDocument =
  'schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo\r\nd01.csv.v1,manual,billing-csv,1,CSV source,row-1,invoice-a,obligation.amount,Known,50.00,BRL,DateInterval,2026-09-01,2026-10-01\r\n';

const jsonDocument = (revision: string, amount: string) =>
  json({
    records: [
      {
        externalId: "invoice-a",
        predicate: "obligation.amount",
        subjectKey: "invoice-a",
        validTime,
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "d01.v1",
    source: {
      externalId: "billing-json",
      label: "JSON source",
      namespace: "basis-compat",
      revision,
    },
  });

it.live(
  "EX25 BC-01..05 real legacy history survives additive basis transition",
  () =>
    withLegacyBasisHarness((harness) =>
      Effect.gen(function* proveBasisCompatibility() {
        const signup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Basis owner",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const owner = responseCookie(signup);
        const strangerSignup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Stranger",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(strangerSignup.status).toBe(200);
        const stranger = responseCookie(strangerSignup);

        const createdResponse = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          owner
        );
        expect(createdResponse.status).toBe(200);
        const { worldRef } = yield* jsonBody(createdResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );

        for (const request of [
          {
            ...envelope,
            input: { document: jsonDocument("1", "100.00") },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          },
          {
            ...envelope,
            input: { document: csvDocument, format: "d01.csv.v1" },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          },
        ]) {
          const imported = yield* http(
            harness.origin,
            executePath,
            json(request),
            owner
          );
          expect(imported.status).toBe(200);
          yield* jsonBody(imported).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
          );
        }

        const inspect = (atFrame: string | null = null) =>
          http(
            harness.origin,
            executePath,
            json({
              ...envelope,
              input: { atFrame, subjectKey: "invoice-a" },
              operation: "Inspect",
              worldRef,
            }),
            owner
          ).pipe(
            Effect.flatMap((response) => {
              expect(response.status).toBe(200);
              return jsonBody(response);
            }),
            Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
          );

        const original = yield* inspect();
        const selected = original.frame.claims.find(
          (claim) => claim.recordId === "invoice-a"
        );
        if (selected === undefined) {
          return yield* Effect.die("Expected JSON claim on legacy frame");
        }

        const proposeRequest = (frameRef: string, operationId: string) => ({
          ...envelope,
          input: {
            consequence: {
              choice: { _tag: "selectClaim", claimRef: selected.claimRef },
              subjectKey: "invoice-a",
              validTime,
            },
            frameRef,
          },
          operation: "ProposeCorrection",
          operationId,
          worldRef,
        });

        const appliedProposeId = randomUUID();
        const appliedProposeRequest = proposeRequest(
          original.frame.frameRef,
          appliedProposeId
        );
        const appliedProposedResponse = yield* http(
          harness.origin,
          correctionsPath,
          json(appliedProposeRequest),
          owner
        );
        expect(appliedProposedResponse.status).toBe(200);
        const appliedProposed = yield* jsonBody(appliedProposedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
        );

        const answerId = randomUUID();
        const answerRequest = {
          ...envelope,
          input: {
            answer: "confirm",
            consequenceDigest: appliedProposed.consequenceDigest,
            questionRef: appliedProposed.questionRef,
          },
          operation: "AnswerQuestion",
          operationId: answerId,
          worldRef,
        };
        const answeredResponse = yield* http(
          harness.origin,
          correctionsPath,
          json(answerRequest),
          owner
        );
        expect(answeredResponse.status).toBe(200);
        const answered = yield* jsonBody(answeredResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
        );

        const corrected = yield* inspect();
        const undoId = randomUUID();
        const undoRequest = {
          ...envelope,
          input: {
            correctionRef: answered.correctionRef,
            frameRef: corrected.frame.frameRef,
          },
          operation: "UndoCorrection",
          operationId: undoId,
          worldRef,
        };
        const undoneResponse = yield* http(
          harness.origin,
          correctionsPath,
          json(undoRequest),
          owner
        );
        expect(undoneResponse.status).toBe(200);
        const undone = yield* jsonBody(undoneResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionUndone))
        );

        const afterUndo = yield* inspect();
        const pendingProposeId = randomUUID();
        const pendingProposeRequest = proposeRequest(
          afterUndo.frame.frameRef,
          pendingProposeId
        );
        const pendingProposedResponse = yield* http(
          harness.origin,
          correctionsPath,
          json(pendingProposeRequest),
          owner
        );
        expect(pendingProposedResponse.status).toBe(200);
        const pendingProposed = yield* jsonBody(pendingProposedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
        );

        const sql = yield* SqlClient.SqlClient;
        const beforeDomains = yield* sql`
          SELECT domain_key
          FROM authority.domains
          WHERE world_id = ${worldRef.worldId}::uuid
          ORDER BY domain_key`;
        expect(beforeDomains.map((row) => row.domain_key)).toStrictEqual([
          "cases",
          "claims",
          "evidence",
          "membership",
          "sources",
        ]);
        const beforeFrames = yield* sql`
          SELECT frame_id::text AS frame_id, internal_basis, visible_frame
          FROM authority.frames
          WHERE world_id = ${worldRef.worldId}::uuid
          ORDER BY created_at`;
        expect(beforeFrames.length).toBeGreaterThan(0);
        for (const frame of beforeFrames) {
          expect(frame.internal_basis).not.toHaveProperty("schemaVersion");
          expect(frame.internal_basis.cut).not.toHaveProperty("identity");
        }
        const beforeReceipts = yield* sql`
          SELECT receipt_id::text AS receipt_id, operation, result
          FROM authority.receipts
          WHERE world_id = ${worldRef.worldId}::uuid
          ORDER BY committed_at`;
        const beforeCases = yield* sql`
          SELECT state
          FROM authority.cases
          WHERE world_id = ${worldRef.worldId}::uuid`;
        expect(beforeCases.some((row) => row.state === "proposed")).toBeTruthy();
        expect(beforeCases.some((row) => row.state === "applied")).toBeTruthy();
        const frameSnapshots = [];
        for (const frame of beforeFrames) {
          frameSnapshots.push({
            basis: yield* canonicalJson(frame.internal_basis),
            frameId: frame.frame_id,
            visible: yield* canonicalJson(frame.visible_frame),
          });
        }
        const receiptSnapshots = [];
        for (const receipt of beforeReceipts) {
          receiptSnapshots.push({
            operation: receipt.operation,
            receiptId: receipt.receipt_id,
            result: yield* canonicalJson(receipt.result),
          });
        }
        expect(
          beforeReceipts.some((row) => row.operation === "ProposeCorrection")
        ).toBeTruthy();
        expect(
          beforeReceipts.some((row) => row.operation === "AnswerQuestion")
        ).toBeTruthy();
        expect(
          beforeReceipts.some((row) => row.operation === "UndoCorrection")
        ).toBeTruthy();
        expect(receiptSnapshots.length).toBeGreaterThan(0);

        const countsBefore = yield* sql`
          SELECT
            (SELECT count(*)::int FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid) AS cases,
            (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
            (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
            (SELECT count(*)::int FROM jobs.outbox WHERE world_id = ${worldRef.worldId}::uuid) AS outbox`;

        const { runtime } = yield* harness.transitionToCurrentComponent();
        const afterDomains = yield* sql`
          SELECT domain_key, version::text AS version
          FROM authority.domains
          WHERE world_id = ${worldRef.worldId}::uuid
          ORDER BY domain_key`;
        expect(afterDomains.map((row) => row.domain_key)).toStrictEqual([
          "cases",
          "claims",
          "evidence",
          "identity",
          "membership",
          "sources",
        ]);
        expect(
          afterDomains.find((row) => row.domain_key === "identity")?.version
        ).toBe("0");

        const afterFrames = yield* sql`
          SELECT frame_id::text AS frame_id, internal_basis, visible_frame
          FROM authority.frames
          WHERE world_id = ${worldRef.worldId}::uuid
          ORDER BY created_at`;
        expect(afterFrames.map((frame) => frame.frame_id)).toStrictEqual(
          beforeFrames.map((frame) => frame.frame_id)
        );
        for (let index = 0; index < afterFrames.length; index += 1) {
          expect(yield* canonicalJson(afterFrames[index].internal_basis)).toBe(
            frameSnapshots[index].basis
          );
          expect(yield* canonicalJson(afterFrames[index].visible_frame)).toBe(
            frameSnapshots[index].visible
          );
        }

        return yield* Effect.gen(function* withCurrentExecutor() {
          const executor = yield* SemanticExecutor;
          const bytes = (value: unknown) =>
            canonicalJson(value).pipe(
              Effect.map((text) => new TextEncoder().encode(text))
            );

          const historical = yield* executor
            .execute(
              owner,
              yield* bytes({
                ...envelope,
                input: {
                  atFrame: original.frame.frameRef,
                  subjectKey: "invoice-a",
                },
                operation: "Inspect",
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          expect(historical.frame).toStrictEqual(original.frame);

          const replayPropose = yield* executor
            .executeCorrection(owner, yield* bytes(pendingProposeRequest))
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
            );
          expect(replayPropose).toStrictEqual(pendingProposed);
          const replayAnswer = yield* executor
            .executeCorrection(owner, yield* bytes(answerRequest))
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
            );
          expect(replayAnswer).toStrictEqual(answered);
          const replayUndo = yield* executor
            .executeCorrection(owner, yield* bytes(undoRequest))
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(CorrectionUndone)));
          expect(replayUndo).toStrictEqual(undone);

          const conflictIntent = {
            ...pendingProposeRequest,
            input: {
              ...pendingProposeRequest.input,
              consequence: {
                ...pendingProposeRequest.input.consequence,
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-02",
                  to: "2026-10-01",
                },
              },
            },
          };
          expect(
            yield* executor
              .executeCorrection(owner, yield* bytes(conflictIntent))
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Conflict" });
          expect(
            yield* executor
              .executeCorrection(stranger, yield* bytes(pendingProposeRequest))
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });

          expect(
            yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
                  ...pendingProposeRequest,
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          expect(
            yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
                  ...envelope,
                  input: {
                    answer: "confirm",
                    consequenceDigest: pendingProposed.consequenceDigest,
                    questionRef: pendingProposed.questionRef,
                  },
                  operation: "AnswerQuestion",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          expect(
            yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
                  ...undoRequest,
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });

          const countsAfter = yield* sql`
            SELECT
              (SELECT count(*)::int FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid) AS cases,
              (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
              (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
              (SELECT count(*)::int FROM jobs.outbox WHERE world_id = ${worldRef.worldId}::uuid) AS outbox`;
          expect(countsAfter).toStrictEqual(countsBefore);

          const auth = yield* D01Auth;
          const signOut = yield* auth.handle(
            new Request(`${harness.origin}/api/auth/sign-out`, {
              body: "{}",
              headers: {
                "content-type": "application/json",
                cookie: Redacted.value(owner),
                origin: harness.origin,
              },
              method: "POST",
            })
          );
          expect(signOut.status).toBe(200);
          expect(
            yield* executor
              .executeCorrection(owner, yield* bytes(pendingProposeRequest))
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Unauthenticated" });

          return {
            bc: ["BC-01", "BC-02", "BC-03", "BC-04", "BC-05"],
            frames: frameSnapshots.length,
            receipts: receiptSnapshots.length,
            revision: harness.legacy.revision,
          };
        }).pipe(Effect.provide(runtime));
      }).pipe(Effect.provide(harness.database.authority))
    ),
  180_000
);
