import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Option, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withIdentityDatabase } from "../../../apps/server/test/identity/database.js";
import { createAccount } from "../../../apps/server/test/identity/http.js";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
} from "../../../packages/contracts/src/sharing/operations.js";
import { ImportDocument } from "../../../packages/contracts/src/worlds/evidence.js";
import {
  AnswerQuestion,
  CreatePersonalWorld,
  ImportEvidence,
  Inspect,
  ProposeCorrection,
  UndoCorrection,
} from "../../../packages/contracts/src/worlds/operations.js";
import type { WorldRef } from "../../../packages/contracts/src/worlds/values.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../packages/ontology/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../packages/ontology/src/commit/genesis.js";
import { importEvidence } from "../../../packages/ontology/src/evidence/import.js";
import { answerQuestion } from "../../../packages/ontology/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../packages/ontology/src/knowledge/corrections/propose.js";
import { undoCorrection } from "../../../packages/ontology/src/knowledge/corrections/undo.js";
import { inspect } from "../../../packages/ontology/src/knowledge/inspect.js";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../packages/ontology/src/ports/worlds/context.js";
import { canonicalJson } from "../../../packages/ontology/src/values/canonical.js";
import { configuration } from "../worlds/commit/fixture.js";

type Fixture = Parameters<Parameters<typeof withIdentityDatabase>[0]>[0];

const installSharing = (fixture: Fixture) =>
  Effect.gen(function* installSharingSchema() {
    const source = yield* FileSystem.FileSystem.use((fs) =>
      fs.readFileString(
        fileURLToPath(
          new URL(
            "../../../ops/migrations/005_world_read_membership.sql",
            import.meta.url
          )
        )
      )
    );
    yield* SqlClient.SqlClient.use((sql) =>
      sql.withTransaction(sql.unsafe(source))
    );
  }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeFileSystem.layer, fixture.database.migration)
    )
  );

const contextFromCredential = Effect.fn("ZA25.contextFromCredential")(
  function* contextFromCredential(credential: Redacted.Redacted) {
    const presence = yield* Presence;
    const verified = yield* presence.verify(credential);
    const now = yield* DateTime.now;
    return yield* Schema.decodeEffect(VerifiedRequestContext)({
      deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
      presence: verified,
      purpose: "personal-records",
    });
  }
);

const worldsEnvelope = {
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
} as const;
const sharingEnvelope = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
} as const;

const createRequest = () =>
  Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    ...worldsEnvelope,
  });

const moneyRecord = (
  externalId: string,
  subjectKey: string,
  amount: string,
  from: string,
  to: string,
  currency: "BRL" | "USD" | "EUR" = "BRL"
) => ({
  externalId,
  predicate: "obligation.amount" as const,
  subjectKey,
  validTime: { _tag: "DateInterval" as const, from, to },
  value: { _tag: "Known" as const, amount, currency },
});

const importDocument = (worldRef: WorldRef, document: string) =>
  Schema.decodeEffect(ImportEvidence)({
    ...worldsEnvelope,
    input: { document },
    operation: "ImportEvidence",
    operationId: randomUUID(),
    worldRef,
  });

const inspectSubject = (worldRef: WorldRef, subjectKey: string) =>
  Schema.decodeEffect(Inspect)({
    ...worldsEnvelope,
    input: { atFrame: null, subjectKey },
    operation: "Inspect",
    worldRef,
  });

it.live(
  "ZA-25 finance reconciliation: contested amounts, currency/recognition≠settlement, stale/conflict/replay without payment receipt",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setupFinance() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* financeJourney() {
            const owner = yield* createAccount(fixture.config.baseUrl);
            const viewer = yield* createAccount(fixture.config.baseUrl);
            const ownerContext = yield* contextFromCredential(owner.credential);
            const viewerContext = yield* contextFromCredential(
              viewer.credential
            );
            const { worldRef } = yield* createPersonalWorld(
              ownerContext,
              yield* createRequest()
            );

            const ledger = yield* canonicalJson({
              records: [
                moneyRecord(
                  "fatura-consultoria-2026-09",
                  "fatura-consultoria-2026-09",
                  "3500.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
                moneyRecord(
                  "fatura-software-2026-09",
                  "fatura-software-2026-09",
                  "890.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "livro-razao-faturas-2026-09",
                label: "Livro-razão / faturas — setembro (reconhecimento)",
                namespace: "finance.ledger",
                revision: "1",
              },
            });
            const statement = yield* canonicalJson({
              records: [
                moneyRecord(
                  "fatura-consultoria-2026-09",
                  "fatura-consultoria-2026-09",
                  "3200.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
                moneyRecord(
                  "fatura-software-2026-09",
                  "fatura-software-2026-09",
                  "890.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-autorizado-2026-09",
                label: "Extrato autorizado — setembro (liquidação reportada)",
                namespace: "finance.statement",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, ledger)
            );
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, statement)
            );

            const consultoriaKey = "fatura-consultoria-2026-09";
            const consultoria = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(consultoria.frame.subjectKey).toBe(consultoriaKey);
            expect(consultoria.frame.contested).toBeTruthy();
            expect(consultoria.frame.selection).toStrictEqual({
              _tag: "unresolved",
            });
            // ZA-25-01 / ZA-25-02 — retained sources, exact amounts; never a payment proof.
            expect(consultoria.frame.verification).toBe("unverified");
            expect(
              consultoria.frame.claims
                .map((claim) => claim.source.label)
                .toSorted()
            ).toStrictEqual([
              "Extrato autorizado — setembro (liquidação reportada)",
              "Livro-razão / faturas — setembro (reconhecimento)",
            ]);
            expect(
              consultoria.frame.claims
                .map((claim) =>
                  claim.value._tag === "Known"
                    ? `${claim.value.amount} ${claim.value.currency}`
                    : "Unknown"
                )
                .toSorted()
            ).toStrictEqual(["3200 BRL", "3500 BRL"]);

            // ZA-25-02 — matching recognized vs statement amounts are not forced
            // into a single selected winner and stay unverified (no settlement).
            const software = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "fatura-software-2026-09")
            );
            expect(software.frame.contested).toBeFalsy();
            expect(software.frame.claims).toHaveLength(2);
            expect(software.frame.selection._tag).toBe("set-valued");
            expect(software.frame.verification).toBe("unverified");

            // ZA-25-02 — same numeric different currency is admitted as a separate
            // currency observation (not coerced into BRL equivalence).
            expect(
              Option.isSome(
                Schema.decodeOption(ImportDocument)({
                  records: [
                    {
                      externalId: "fatura-software-usd",
                      predicate: "obligation.amount",
                      subjectKey: "fatura-software-2026-09",
                      validTime: {
                        _tag: "DateInterval",
                        from: "2026-09-01",
                        to: "2026-10-01",
                      },
                      value: {
                        _tag: "Known",
                        amount: "890.00",
                        currency: "USD",
                      },
                    },
                  ],
                  schemaVersion: "worlds.v1",
                  source: {
                    externalId: "extrato-usd",
                    label: "Extrato USD",
                    namespace: "finance.statement-usd",
                    revision: "1",
                  },
                })
              )
            ).toBeTruthy();
            const usdDoc = yield* canonicalJson({
              records: [
                moneyRecord(
                  "fatura-software-usd",
                  "fatura-software-2026-09",
                  "890.00",
                  "2026-09-01",
                  "2026-10-01",
                  "USD"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-usd-2026-09",
                label: "Extrato USD — setembro",
                namespace: "finance.statement-usd",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, usdDoc)
            );
            const softwareMixed = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "fatura-software-2026-09")
            );
            // BRL vs USD never forces contested equivalence.
            const brlClaims = softwareMixed.frame.claims.filter(
              (claim) =>
                claim.value._tag === "Known" && claim.value.currency === "BRL"
            );
            const usdClaims = softwareMixed.frame.claims.filter(
              (claim) =>
                claim.value._tag === "Known" && claim.value.currency === "USD"
            );
            expect(brlClaims.length).toBeGreaterThanOrEqual(2);
            expect(usdClaims).toHaveLength(1);
            expect(softwareMixed.frame.verification).toBe("unverified");

            // Re-read contested consultoria for correction on current frame.
            const forCorrection = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(forCorrection.frame.contested).toBeTruthy();
            const ledgerClaim = forCorrection.frame.claims.find(
              (claim) => claim.source.namespace === "finance.ledger"
            );
            if (ledgerClaim === undefined) {
              throw new Error("Ledger claim required for correction");
            }

            const proposeOperationId = randomUUID();
            const proposeRequest = yield* Schema.decodeEffect(
              ProposeCorrection
            )({
              ...worldsEnvelope,
              input: {
                consequence: {
                  choice: {
                    _tag: "selectClaim",
                    claimRef: ledgerClaim.claimRef,
                  },
                  subjectKey: consultoriaKey,
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                },
                frameRef: forCorrection.frame.frameRef,
              },
              operation: "ProposeCorrection",
              operationId: proposeOperationId,
              worldRef,
            });
            const proposed = yield* proposeCorrection(
              ownerContext,
              proposeRequest
            );

            // ZA-25-03 — same-intent replay: identical ProposeCorrection returns same proposal.
            const replayed = yield* proposeCorrection(
              ownerContext,
              proposeRequest
            );
            expect(replayed).toStrictEqual(proposed);

            // ZA-25-03 — wrong digest cannot confirm (Conflict); no fabricated receipt.
            const answerRequest = yield* Schema.decodeEffect(AnswerQuestion)({
              ...worldsEnvelope,
              input: {
                answer: "confirm",
                consequenceDigest: proposed.consequenceDigest,
                questionRef: proposed.questionRef,
              },
              operation: "AnswerQuestion",
              operationId: randomUUID(),
              worldRef,
            });
            const wrongDigest = yield* Schema.decodeEffect(
              AnswerQuestion.fields.input.fields.consequenceDigest
            )(
              `${proposed.consequenceDigest.startsWith("a") ? "b" : "a"}${proposed.consequenceDigest.slice(1)}`
            );
            expect(
              yield* answerQuestion(ownerContext, {
                ...answerRequest,
                input: {
                  ...answerRequest.input,
                  consequenceDigest: wrongDigest,
                },
              }).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Conflict", code: "CONFLICT" });

            // Concurrent statement revision changes basis — old consent is Stale.
            const revisedStatement = yield* canonicalJson({
              records: [
                moneyRecord(
                  "fatura-consultoria-2026-09",
                  consultoriaKey,
                  "3100.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-autorizado-2026-09",
                label:
                  "Extrato autorizado — setembro (liquidação reportada, revisão)",
                namespace: "finance.statement",
                revision: "2",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, revisedStatement)
            );
            expect(
              yield* answerQuestion(ownerContext, answerRequest).pipe(
                Effect.flip
              )
            ).toMatchObject({ _tag: "Stale", code: "STALE" });

            // Fresh frame after basis change — authorized correction succeeds,
            // still unverified (no payment receipt / provider settlement).
            const current = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(current.frame.contested).toBeTruthy();
            expect(current.frame.claims.length).toBeGreaterThanOrEqual(2);
            const freshLedger = current.frame.claims.find(
              (claim) => claim.source.namespace === "finance.ledger"
            );
            if (freshLedger === undefined) {
              throw new Error("Fresh ledger claim required");
            }
            const proposedFresh = yield* proposeCorrection(
              ownerContext,
              yield* Schema.decodeEffect(ProposeCorrection)({
                ...worldsEnvelope,
                input: {
                  consequence: {
                    choice: {
                      _tag: "selectClaim",
                      claimRef: freshLedger.claimRef,
                    },
                    subjectKey: consultoriaKey,
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                  },
                  frameRef: current.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const answerOpId = randomUUID();
            const answerFresh = yield* Schema.decodeEffect(AnswerQuestion)({
              ...worldsEnvelope,
              input: {
                answer: "confirm",
                consequenceDigest: proposedFresh.consequenceDigest,
                questionRef: proposedFresh.questionRef,
              },
              operation: "AnswerQuestion",
              operationId: answerOpId,
              worldRef,
            });
            const applied = yield* answerQuestion(ownerContext, answerFresh);
            // Same-intent AnswerQuestion replay — no second external action.
            const answerReplay = yield* answerQuestion(
              ownerContext,
              answerFresh
            );
            expect(answerReplay).toStrictEqual(applied);

            const corrected = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(corrected.frame.scopedCorrections).toHaveLength(1);
            expect(corrected.frame.claims.length).toBeGreaterThanOrEqual(2);
            expect(corrected.frame.verification).toBe("unverified");
            // Correction receipt is a scoped local decision — not a payment receipt.
            expect(applied.correctionRef).toBeTruthy();
            expect(Object.keys(applied).toSorted()).toStrictEqual(
              ["_tag", "correctionRef", "receiptRef"].toSorted()
            );

            const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
              ...sharingEnvelope,
              input: {
                expectedRevision: null,
                principalRef: viewer.user.id,
              },
              operation: "GrantWorldReadAccess",
              operationId: randomUUID(),
              worldRef,
            });
            const granted = yield* grantWorldReadAccess(ownerContext, grant);
            const viewerWhileActive = yield* inspect(
              viewerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(
              viewerWhileActive.frame.claims.length
            ).toBeGreaterThanOrEqual(2);
            expect(viewerWhileActive.frame.scopedCorrections).toStrictEqual([]);
            expect(viewerWhileActive.frame.verification).toBe("unverified");

            const afterGrant = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(afterGrant.frame.scopedCorrections).toHaveLength(1);

            yield* undoCorrection(
              ownerContext,
              yield* Schema.decodeEffect(UndoCorrection)({
                ...worldsEnvelope,
                input: {
                  correctionRef: applied.correctionRef,
                  frameRef: afterGrant.frame.frameRef,
                },
                operation: "UndoCorrection",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const undone = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, consultoriaKey)
            );
            expect(undone.frame.scopedCorrections).toStrictEqual([]);
            expect(undone.frame.verification).toBe("unverified");
            const historical = yield* inspect(
              ownerContext,
              yield* Schema.decodeEffect(Inspect)({
                ...worldsEnvelope,
                input: {
                  atFrame: corrected.frame.frameRef,
                  subjectKey: consultoriaKey,
                },
                operation: "Inspect",
                worldRef,
              })
            );
            expect(historical.frame.scopedCorrections).toHaveLength(1);
            expect(historical.frame.verification).toBe("unverified");

            yield* revokeWorldReadAccess(
              ownerContext,
              yield* Schema.decodeEffect(RevokeWorldReadAccess)({
                ...sharingEnvelope,
                input: {
                  expectedRevision: granted.membershipAtCommit.revision,
                  principalRef: viewer.user.id,
                },
                operation: "RevokeWorldReadAccess",
                operationId: randomUUID(),
                worldRef,
              })
            );
            expect(
              yield* inspect(
                viewerContext,
                yield* inspectSubject(worldRef, consultoriaKey)
              ).pipe(Effect.flip)
            ).toMatchObject({
              _tag: "NotFoundOrDenied",
              code: "NOT_FOUND_OR_DENIED",
            });
          }).pipe(
            Effect.provide(
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime
              )
            )
          )
        );
      })
    )
);
