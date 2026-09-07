import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase as withCorrectionsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/authority/src/evidence/worlds/import.js";
import { answerQuestion } from "../../../../packages/authority/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../../packages/authority/src/knowledge/corrections/propose.js";
import { undoCorrection } from "../../../../packages/authority/src/knowledge/corrections/undo.js";
import { inspect } from "../../../../packages/authority/src/knowledge/worlds/inspect.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  AnswerQuestion,
  ImportEvidence,
  Inspect,
  ProposeCorrection,
  UndoCorrection,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX13 September correction leaves October and another obligation unchanged; unknown and undo retain every authored event",
  () =>
    withCorrectionsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* scopedHistory() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          for (const revision of ["1", "2"]) {
            const document = yield* canonicalJson({
              records: [
                {
                  externalId: "sept",
                  predicate: "obligation.amount",
                  subjectKey: "A",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                  value: {
                    _tag: "Known",
                    amount: revision === "1" ? "100" : "200",
                    currency: "BRL",
                  },
                },
                {
                  externalId: "oct",
                  predicate: "obligation.amount",
                  subjectKey: "A",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-10-01",
                    to: "2026-11-01",
                  },
                  value: {
                    _tag: "Known",
                    amount: revision === "1" ? "300" : "400",
                    currency: "BRL",
                  },
                },
                {
                  externalId: "other",
                  predicate: "obligation.amount",
                  subjectKey: "B",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                  value: { _tag: "Known", amount: "999", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "billing",
                label: `Source ${revision}`,
                namespace: "test",
                revision,
              },
            });
            yield* importEvidence(
              context,
              yield* Schema.decodeEffect(ImportEvidence)({
                ...request,
                input: { document },
                operation: "ImportEvidence",
                operationId: randomUUID(),
                worldRef,
              })
            );
          }
          const inspectA = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "A" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef,
          });
          const inspectB = yield* Schema.decodeEffect(Inspect)({
            ...inspectA,
            input: { atFrame: null, subjectKey: "B" },
          });
          const before = yield* inspect(context, inspectA);
          const otherBefore = yield* inspect(context, inspectB);
          const selected = before.frame.claims.find(
            (claim) =>
              claim.recordId === "sept" && claim.source.revision === "1"
          );
          if (
            selected === undefined ||
            selected.validTime._tag !== "DateInterval"
          ) {
            return yield* Effect.die(
              "Expected actual imported September claim"
            );
          }
          const proposalRequest = yield* Schema.decodeEffect(ProposeCorrection)(
            {
              ...request,
              input: {
                consequence: {
                  choice: { _tag: "selectClaim", claimRef: selected.claimRef },
                  subjectKey: "A",
                  validTime: selected.validTime,
                },
                frameRef: before.frame.frameRef,
              },
              operation: "ProposeCorrection",
              operationId: randomUUID(),
              worldRef,
            }
          );
          const proposed = yield* proposeCorrection(context, proposalRequest);
          const answerRequest = yield* Schema.decodeEffect(AnswerQuestion)({
            ...request,
            input: {
              answer: "confirm",
              consequenceDigest: proposed.consequenceDigest,
              questionRef: proposed.questionRef,
            },
            operation: "AnswerQuestion",
            operationId: randomUUID(),
            worldRef,
          });
          const answers = yield* Effect.all(
            [
              answerQuestion(context, answerRequest),
              answerQuestion(context, answerRequest),
            ],
            { concurrency: 2 }
          );
          expect(answers[0]).toStrictEqual(answers[1]);
          const confirmed = yield* inspect(context, inspectA);
          expect(confirmed.frame).toMatchObject({
            claims: before.frame.claims,
            contested: true,
            scopedCorrections: [
              {
                authoredBy: "current-principal",
                choice: { _tag: "selectClaim", claimRef: selected.claimRef },
                subjectKey: "A",
                validTime: selected.validTime,
              },
            ],
            selection: { _tag: "unresolved" },
          });
          expect((yield* inspect(context, inspectB)).frame).toMatchObject({
            claims: otherBefore.frame.claims,
            scopedCorrections: [],
            selection: otherBefore.frame.selection,
          });
          const partial = yield* Schema.decodeEffect(ProposeCorrection)({
            ...proposalRequest,
            input: {
              consequence: {
                ...proposalRequest.input.consequence,
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-15",
                  to: "2026-10-01",
                },
              },
              frameRef: confirmed.frame.frameRef,
            },
            operationId: randomUUID(),
          });
          expect(
            yield* proposeCorrection(context, partial).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Unsupported" });
          const proposedUnknown = yield* proposeCorrection(context, {
            ...proposalRequest,
            input: {
              ...proposalRequest.input,
              frameRef: confirmed.frame.frameRef,
            },
            operationId: yield* Schema.decodeEffect(
              ProposeCorrection.fields.operationId
            )(randomUUID()),
          });
          const unknown = yield* answerQuestion(context, {
            ...answerRequest,
            input: {
              answer: "unknown",
              consequenceDigest: proposedUnknown.consequenceDigest,
              questionRef: proposedUnknown.questionRef,
            },
            operationId: yield* Schema.decodeEffect(
              AnswerQuestion.fields.operationId
            )(randomUUID()),
          });
          const unknownFrame = yield* inspect(context, inspectA);
          expect(
            unknownFrame.frame.scopedCorrections.map(
              (decision) => decision.choice
            )
          ).toStrictEqual([{ _tag: "unknown" }]);
          const undoRequest = yield* Schema.decodeEffect(UndoCorrection)({
            ...request,
            input: {
              correctionRef: unknown.correctionRef,
              frameRef: unknownFrame.frame.frameRef,
            },
            operation: "UndoCorrection",
            operationId: randomUUID(),
            worldRef,
          });
          yield* undoCorrection(context, undoRequest);
          const restored = yield* inspect(context, inspectA);
          expect(restored.frame.scopedCorrections).toStrictEqual(
            confirmed.frame.scopedCorrections
          );
          expect(
            yield* inspect(context, {
              ...inspectA,
              input: {
                ...inspectA.input,
                atFrame: unknownFrame.frame.frameRef,
              },
            })
          ).toStrictEqual(unknownFrame);
          expect(
            yield* inspect(context, {
              ...inspectA,
              input: { ...inspectA.input, atFrame: before.frame.frameRef },
            })
          ).toStrictEqual(before);
          const [currentDecision] = restored.frame.scopedCorrections;
          if (currentDecision === undefined) {
            return yield* Effect.die("Expected restored decision");
          }
          yield* undoCorrection(context, {
            ...undoRequest,
            input: {
              correctionRef: currentDecision.correctionRef,
              frameRef: restored.frame.frameRef,
            },
            operationId: yield* Schema.decodeEffect(
              UndoCorrection.fields.operationId
            )(randomUUID()),
          });
          expect(
            (yield* inspect(context, inspectA)).frame.scopedCorrections
          ).toStrictEqual([]);
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS events, count(DISTINCT receipt_id)::int AS receipts FROM authority.corrections`
          ).toStrictEqual([{ events: 4, receipts: 4 }]);
          expect(
            yield* sql`SELECT count(*)::int AS authored FROM authority.corrections e JOIN authority.receipts r USING (world_id, realm, receipt_id) WHERE r.principal_id = ${context.presence.principalId}`
          ).toStrictEqual([{ authored: 4 }]);
          return null;
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
