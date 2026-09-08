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

const contextFromCredential = Effect.fn("ZA23.contextFromCredential")(
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

const order = (
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
  "ZA-23 bakery order reconciliation: contested quotes, unsupported grams, stale consent and hidden staff context",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setupBakery() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* bakeryJourney() {
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

            const customerOrders = yield* canonicalJson({
              records: [
                order(
                  "bolo-casamento-2026-09-20",
                  "pedido-bolo-casamento-2026-09-20",
                  "450.00",
                  "2026-09-20",
                  "2026-09-21"
                ),
                order(
                  "kit-festa-2026-09-20",
                  "pedido-kit-festa-2026-09-20",
                  "180.00",
                  "2026-09-20",
                  "2026-09-21"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "pedidos-clientes-2026-09-20",
                label: "Lista de pedidos dos clientes — 20/09",
                namespace: "bakery.orders",
                revision: "1",
              },
            });
            const shopList = yield* canonicalJson({
              records: [
                order(
                  "bolo-casamento-2026-09-20",
                  "pedido-bolo-casamento-2026-09-20",
                  "520.00",
                  "2026-09-20",
                  "2026-09-21"
                ),
                order(
                  "pao-frances-encomenda-2026-09-22",
                  "pedido-pao-frances-2026-09-22",
                  "95.00",
                  "2026-09-22",
                  "2026-09-23"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "lista-producao-2026-09-20",
                label: "Lista de produção da loja — 20/09",
                namespace: "bakery.shop",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, customerOrders)
            );
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, shopList)
            );

            const boloKey = "pedido-bolo-casamento-2026-09-20";
            const bolo = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(bolo.frame.subjectKey).toBe(boloKey);
            expect(bolo.frame.contested).toBeTruthy();
            expect(bolo.frame.selection).toStrictEqual({ _tag: "unresolved" });
            expect(bolo.frame.verification).toBe("unverified");
            expect(
              bolo.frame.claims.map((claim) => claim.source.label).toSorted()
            ).toStrictEqual([
              "Lista de pedidos dos clientes — 20/09",
              "Lista de produção da loja — 20/09",
            ]);
            expect(
              bolo.frame.claims
                .map((claim) =>
                  claim.value._tag === "Known"
                    ? `${claim.value.amount} ${claim.value.currency}`
                    : "Unknown"
                )
                .toSorted()
            ).toStrictEqual(["450 BRL", "520 BRL"]);

            const kit = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "pedido-kit-festa-2026-09-20")
            );
            expect(kit.frame.contested).toBeFalsy();
            expect(kit.frame.claims).toHaveLength(1);
            expect(kit.frame.selection._tag).toBe("selected");

            // ZA-23-02 — grams / mass units are not admitted currencies.
            expect(
              Option.isNone(
                Schema.decodeUnknownOption(ImportDocument)({
                  records: [
                    {
                      externalId: "farinha-receita",
                      predicate: "obligation.amount",
                      subjectKey: "estoque-farinha",
                      validTime: {
                        _tag: "DateInterval",
                        from: "2026-09-20",
                        to: "2026-09-21",
                      },
                      value: { _tag: "Known", amount: "500", currency: "g" },
                    },
                  ],
                  schemaVersion: "worlds.v1",
                  source: {
                    externalId: "receita-bolo",
                    label: "Pesos da receita",
                    namespace: "bakery.recipe",
                    revision: "1",
                  },
                })
              )
            ).toBeTruthy();

            const unknownStock = yield* canonicalJson({
              records: [
                {
                  externalId: "estoque-acucar-nota",
                  predicate: "obligation.amount",
                  subjectKey: "estoque-acucar",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-20",
                    to: "2026-09-21",
                  },
                  value: { _tag: "Unknown" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "nota-estoque",
                label: "Nota de estoque sem cotação",
                namespace: "bakery.stock-notes",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, unknownStock)
            );
            const stock = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "estoque-acucar")
            );
            expect(stock.frame.claims).toHaveLength(1);
            expect(stock.frame.claims[0]?.value).toStrictEqual({
              _tag: "Unknown",
            });
            expect(stock.frame.selection._tag).toBe("unknown");
            // Unknown stock is not inventing revenue / currency.
            expect(stock.frame.contested).toBeFalsy();

            // Re-read after ZA-23-02 admissions so ProposeCorrection sees a current frame.
            const boloForCorrection = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(boloForCorrection.frame.contested).toBeTruthy();
            const customerClaim = boloForCorrection.frame.claims.find(
              (claim) => claim.source.namespace === "bakery.orders"
            );
            if (customerClaim === undefined) {
              throw new Error("Customer order claim required for correction");
            }
            const proposed = yield* proposeCorrection(
              ownerContext,
              yield* Schema.decodeEffect(ProposeCorrection)({
                ...worldsEnvelope,
                input: {
                  consequence: {
                    choice: {
                      _tag: "selectClaim",
                      claimRef: customerClaim.claimRef,
                    },
                    subjectKey: boloKey,
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-20",
                      to: "2026-09-21",
                    },
                  },
                  frameRef: boloForCorrection.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                worldRef,
              })
            );

            // ZA-23-03 — wrong digest cannot confirm (Conflict) before basis moves.
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

            // Concurrent shop revision changes basis — old consent is Stale.
            const revisedShop = yield* canonicalJson({
              records: [
                order(
                  "bolo-casamento-2026-09-20",
                  boloKey,
                  "510.00",
                  "2026-09-20",
                  "2026-09-21"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "lista-producao-2026-09-20",
                label: "Lista de produção da loja — 20/09 (revisão)",
                namespace: "bakery.shop",
                revision: "2",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, revisedShop)
            );
            expect(
              yield* answerQuestion(ownerContext, answerRequest).pipe(
                Effect.flip
              )
            ).toMatchObject({ _tag: "Stale", code: "STALE" });

            // Fresh frame after basis change — authorized correction succeeds.
            const currentBolo = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(currentBolo.frame.contested).toBeTruthy();
            expect(currentBolo.frame.claims.length).toBeGreaterThanOrEqual(2);
            const freshCustomer = currentBolo.frame.claims.find(
              (claim) => claim.source.namespace === "bakery.orders"
            );
            if (freshCustomer === undefined) {
              throw new Error("Fresh customer claim required");
            }
            const proposedFresh = yield* proposeCorrection(
              ownerContext,
              yield* Schema.decodeEffect(ProposeCorrection)({
                ...worldsEnvelope,
                input: {
                  consequence: {
                    choice: {
                      _tag: "selectClaim",
                      claimRef: freshCustomer.claimRef,
                    },
                    subjectKey: boloKey,
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-20",
                      to: "2026-09-21",
                    },
                  },
                  frameRef: currentBolo.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const applied = yield* answerQuestion(
              ownerContext,
              yield* Schema.decodeEffect(AnswerQuestion)({
                ...worldsEnvelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: proposedFresh.consequenceDigest,
                  questionRef: proposedFresh.questionRef,
                },
                operation: "AnswerQuestion",
                operationId: randomUUID(),
                worldRef,
              })
            );

            const corrected = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(corrected.frame.scopedCorrections).toHaveLength(1);
            expect(corrected.frame.claims.length).toBeGreaterThanOrEqual(2);

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
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(
              viewerWhileActive.frame.claims.length
            ).toBeGreaterThanOrEqual(2);
            // Hidden staff context: viewers do not receive scoped corrections.
            expect(viewerWhileActive.frame.scopedCorrections).toStrictEqual([]);

            const afterGrant = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, boloKey)
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
              yield* inspectSubject(worldRef, boloKey)
            );
            expect(undone.frame.scopedCorrections).toStrictEqual([]);
            const historical = yield* inspect(
              ownerContext,
              yield* Schema.decodeEffect(Inspect)({
                ...worldsEnvelope,
                input: {
                  atFrame: corrected.frame.frameRef,
                  subjectKey: boloKey,
                },
                operation: "Inspect",
                worldRef,
              })
            );
            expect(historical.frame.scopedCorrections).toHaveLength(1);

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
                yield* inspectSubject(worldRef, boloKey)
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
