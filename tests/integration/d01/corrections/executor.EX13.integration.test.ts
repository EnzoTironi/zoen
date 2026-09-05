import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/d01/database.js";
import {
  createAccount,
  postAuth,
} from "../../../../apps/server/test/identity/d01/http.js";
import { SemanticExecutor } from "../../../../packages/authority/src/semantic/executor.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  CorrectionApplied,
  CorrectionProposed,
  FrameInspected,
  WorldCreated,
} from "../../../../packages/contracts/src/d01/operations.js";
import { configuration } from "../commit/fixture.js";
import { applyCorrectionsDelta } from "./fixture.js";

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

it.live(
  "EX13 real identity executes scoped correction through the shared executor, and logout denies retained replay",
  () =>
    withD01IdentityDatabase((fixture) =>
      applyCorrectionsDelta(fixture.database).pipe(
        Effect.andThen(
          withStorage(() =>
            Effect.gen(function* authenticatedCorrections() {
              const account = yield* createAccount(fixture.config.baseUrl);
              const executor = yield* SemanticExecutor;
              const envelope = {
                purpose: "personal-records",
                schemaVersion: "d01.v1",
              };
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
              const document = yield* canonicalJson({
                records: [
                  {
                    externalId: "one",
                    predicate: "obligation.amount",
                    subjectKey: "A",
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                    value: { _tag: "Known", amount: "100", currency: "BRL" },
                  },
                ],
                schemaVersion: "d01.v1",
                source: {
                  externalId: "billing",
                  label: "Billing",
                  namespace: "test",
                  revision: "1",
                },
              });
              yield* executor.execute(
                account.credential,
                yield* bytes({
                  ...envelope,
                  input: { document },
                  operation: "ImportEvidence",
                  operationId: randomUUID(),
                  worldRef,
                })
              );
              const inspectRequest = yield* bytes({
                ...envelope,
                input: { atFrame: null, subjectKey: "A" },
                operation: "Inspect",
                worldRef,
              });
              const inspected = yield* executor
                .execute(account.credential, inspectRequest)
                .pipe(
                  Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
                );
              const [claim] = inspected.frame.claims;
              if (claim === undefined) {
                return yield* Effect.die("Expected real imported claim");
              }
              const proposalBytes = yield* bytes({
                ...envelope,
                input: {
                  consequence: {
                    choice: { _tag: "selectClaim", claimRef: claim.claimRef },
                    subjectKey: "A",
                    validTime: claim.validTime,
                  },
                  frameRef: inspected.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                worldRef,
              });
              expect(
                yield* executor
                  .execute(account.credential, proposalBytes)
                  .pipe(Effect.flip)
              ).toMatchObject({ _tag: "InvalidInput" });
              const proposed = yield* executor
                .executeCorrection(account.credential, proposalBytes)
                .pipe(
                  Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
                );
              const answerBytes = yield* bytes({
                ...envelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: proposed.consequenceDigest,
                  questionRef: proposed.questionRef,
                },
                operation: "AnswerQuestion",
                operationId: randomUUID(),
                worldRef,
              });
              const applied = yield* executor
                .executeCorrection(account.credential, answerBytes)
                .pipe(
                  Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
                );
              expect(
                yield* executor.executeCorrection(
                  account.credential,
                  answerBytes
                )
              ).toStrictEqual(applied);
              const after = yield* executor
                .execute(account.credential, inspectRequest)
                .pipe(
                  Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
                );
              expect(after.frame.scopedCorrections).toMatchObject([
                {
                  authoredBy: "current-principal",
                  correctionRef: applied.correctionRef,
                  receiptRef: applied.receiptRef,
                },
              ]);
              const stranger = yield* createAccount(fixture.config.baseUrl);
              expect(
                yield* executor
                  .executeCorrection(stranger.credential, answerBytes)
                  .pipe(Effect.flip)
              ).toMatchObject({ _tag: "NotFoundOrDenied" });
              yield* postAuth(
                fixture.config.baseUrl,
                "sign-out",
                {},
                account.credential
              );
              expect(
                yield* executor
                  .executeCorrection(account.credential, answerBytes)
                  .pipe(Effect.flip)
              ).toMatchObject({ _tag: "Unauthenticated" });
              return null;
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
      )
    )
);
