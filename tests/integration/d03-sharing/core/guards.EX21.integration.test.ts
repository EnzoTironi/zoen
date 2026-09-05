import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { createAccount } from "../../../../apps/server/test/identity/d01/http.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../../packages/authority/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/authority/src/evidence/d01/import.js";
import { answerQuestion } from "../../../../packages/authority/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../../packages/authority/src/knowledge/corrections/propose.js";
import { inspect } from "../../../../packages/authority/src/knowledge/d01/inspect.js";
import {
  AnswerQuestion,
  ImportEvidence,
  Inspect,
  ProposeCorrection,
} from "../../../../packages/contracts/src/d01/operations.js";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
} from "../../../../packages/contracts/src/sharing/operations.js";
import { configuration } from "../../d01/commit/fixture.js";
import {
  genesisRequest,
  verifiedContext,
  withSharingDatabase,
} from "./fixture.js";

it.live(
  "SH membership no-op preserves a pending decision but a real revocation invalidates its complete read set",
  () =>
    withSharingDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* membershipGuard() {
          const owner = yield* createAccount(fixture.config.baseUrl);
          const viewer = yield* createAccount(fixture.config.baseUrl);
          const context = yield* verifiedContext(owner.credential);
          const genesis = yield* genesisRequest;
          const { worldRef } = yield* createPersonalWorld(context, genesis);
          yield* importEvidence(
            context,
            yield* Schema.decodeEffect(ImportEvidence)({
              ...genesis,
              input: {
                document:
                  '{"schemaVersion":"d01.v1","source":{"namespace":"manual","externalId":"guard","revision":"1","label":"Guard source"},"records":[{"externalId":"row-1","subjectKey":"unknown-billing","predicate":"obligation.amount","value":{"_tag":"Unknown"},"validTime":{"_tag":"DateInterval","from":"2026-09-01","to":"2026-10-01"}}]}',
              },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            })
          );
          const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
            input: { expectedRevision: null, principalRef: viewer.user.id },
            operation: "GrantWorldReadAccess",
            operationId: randomUUID(),
            purpose: "personal-records",
            schemaVersion: "d03.sharing.v1",
            worldRef,
          });
          yield* grantWorldReadAccess(context, grant);
          const read = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "unknown-billing" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "d01.v1",
            worldRef,
          });
          for (const transition of ["no-op", "revoke"] as const) {
            const frame = yield* inspect(context, read);
            const proposal = yield* proposeCorrection(
              context,
              yield* Schema.decodeEffect(ProposeCorrection)({
                ...genesis,
                input: {
                  consequence: {
                    choice: { _tag: "unknown" },
                    subjectKey: read.input.subjectKey,
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                  },
                  frameRef: frame.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const answer = yield* Schema.decodeEffect(AnswerQuestion)({
              ...genesis,
              input: {
                answer: "unknown",
                consequenceDigest: proposal.consequenceDigest,
                questionRef: proposal.questionRef,
              },
              operation: "AnswerQuestion",
              operationId: randomUUID(),
              worldRef,
            });
            if (transition === "no-op") {
              yield* grantWorldReadAccess(
                context,
                yield* Schema.decodeEffect(GrantWorldReadAccess)({
                  ...grant,
                  input: { ...grant.input, expectedRevision: "0" },
                  operationId: randomUUID(),
                })
              );
              expect((yield* answerQuestion(context, answer))._tag).toBe(
                "CorrectionApplied"
              );
            } else {
              yield* revokeWorldReadAccess(
                context,
                yield* Schema.decodeEffect(RevokeWorldReadAccess)({
                  ...grant,
                  input: { ...grant.input, expectedRevision: "0" },
                  operation: "RevokeWorldReadAccess",
                  operationId: randomUUID(),
                })
              );
              expect(
                yield* answerQuestion(context, answer).pipe(Effect.flip)
              ).toMatchObject({ _tag: "Stale" });
            }
          }
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              configuration,
              fixture.database.authority,
              fixture.runtime
            )
          )
        )
      )
    )
);
