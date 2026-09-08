import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withIdentityDatabase } from "../../../apps/server/test/identity/database.js";
import { createAccount } from "../../../apps/server/test/identity/http.js";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
} from "../../../packages/contracts/src/sharing/operations.js";
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

const contextFromCredential = Effect.fn("ZA22.contextFromCredential")(
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

const bill = (
  externalId: string,
  subjectKey: string,
  amount: string,
  from: string,
  to: string,
  currency: "BRL" | "USD" = "BRL"
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
  "ZA-22 household commitment reconciliation: contested bills, non-comparable peers, undo and revocation",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setupHousehold() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* householdJourney() {
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

            const bankList = yield* canonicalJson({
              records: [
                bill(
                  "luz-2026-09",
                  "conta-luz-2026-09",
                  "189.90",
                  "2026-09-01",
                  "2026-10-01"
                ),
                bill(
                  "agua-2026-09",
                  "conta-agua-2026-09",
                  "72.40",
                  "2026-09-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-setembro-2026",
                label: "Extrato do banco — setembro",
                namespace: "household.bank",
                revision: "1",
              },
            });
            const sheetList = yield* canonicalJson({
              records: [
                bill(
                  "luz-2026-09",
                  "conta-luz-2026-09",
                  "210.00",
                  "2026-09-01",
                  "2026-10-01"
                ),
                bill(
                  "internet-2026-q3",
                  "internet-2026-q3",
                  "99.90",
                  "2026-07-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "planilha-contas-setembro-2026",
                label: "Planilha de contas — setembro",
                namespace: "household.spreadsheet",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, bankList)
            );
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, sheetList)
            );

            const luzKey = "conta-luz-2026-09";
            const luz = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(luz.frame.subjectKey).toBe(luzKey);
            expect(luz.frame.contested).toBeTruthy();
            expect(luz.frame.selection).toStrictEqual({ _tag: "unresolved" });
            expect(luz.frame.verification).toBe("unverified");
            expect(
              luz.frame.claims.map((claim) => claim.source.label).toSorted()
            ).toStrictEqual([
              "Extrato do banco — setembro",
              "Planilha de contas — setembro",
            ]);
            expect(
              luz.frame.claims
                .map((claim) =>
                  claim.value._tag === "Known"
                    ? `${claim.value.amount} ${claim.value.currency}`
                    : "Unknown"
                )
                .toSorted()
            ).toStrictEqual(["189.9 BRL", "210 BRL"]);

            const agua = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "conta-agua-2026-09")
            );
            expect(agua.frame.contested).toBeFalsy();
            expect(agua.frame.claims).toHaveLength(1);
            expect(agua.frame.selection._tag).toBe("selected");

            const internet = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "internet-2026-q3")
            );
            expect(internet.frame.contested).toBeFalsy();
            expect(internet.frame.claims).toHaveLength(1);

            const usdPeer = yield* canonicalJson({
              records: [
                bill(
                  "luz-usd",
                  luzKey,
                  "40.00",
                  "2026-09-01",
                  "2026-10-01",
                  "USD"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "cartao-internacional",
                label: "Fatura cartão USD",
                namespace: "household.card",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, usdPeer)
            );
            const luzWithUsd = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(luzWithUsd.frame.contested).toBeTruthy();
            expect(luzWithUsd.frame.claims).toHaveLength(3);
            expect(
              luzWithUsd.frame.claims.filter(
                (claim) =>
                  claim.value._tag === "Known" && claim.value.currency === "USD"
              )
            ).toHaveLength(1);

            const octoberOnly = yield* canonicalJson({
              records: [
                bill(
                  "luz-october",
                  "conta-luz-2026-10",
                  "195.00",
                  "2026-10-01",
                  "2026-11-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-outubro",
                label: "Extrato outubro",
                namespace: "household.bank",
                revision: "1",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, octoberOnly)
            );
            const october = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, "conta-luz-2026-10")
            );
            expect(october.frame.contested).toBeFalsy();
            expect(october.frame.claims).toHaveLength(1);

            // Re-read after later admissions so ProposeCorrection sees a current frame.
            const currentLuz = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(currentLuz.frame.contested).toBeTruthy();
            expect(currentLuz.frame.claims).toHaveLength(3);
            const bankClaim = currentLuz.frame.claims.find(
              (claim) => claim.source.namespace === "household.bank"
            );
            if (bankClaim === undefined) {
              throw new Error("Bank claim required for correction");
            }
            const proposed = yield* proposeCorrection(
              ownerContext,
              yield* Schema.decodeEffect(ProposeCorrection)({
                ...worldsEnvelope,
                input: {
                  consequence: {
                    choice: {
                      _tag: "selectClaim",
                      claimRef: bankClaim.claimRef,
                    },
                    subjectKey: luzKey,
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                  },
                  frameRef: currentLuz.frame.frameRef,
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
                  consequenceDigest: proposed.consequenceDigest,
                  questionRef: proposed.questionRef,
                },
                operation: "AnswerQuestion",
                operationId: randomUUID(),
                worldRef,
              })
            );
            const corrected = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(corrected.frame.scopedCorrections).toHaveLength(1);
            expect(corrected.frame.claims).toHaveLength(3);
            expect(corrected.frame.contested).toBeTruthy();

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
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(viewerWhileActive.frame.claims).toHaveLength(3);
            expect(viewerWhileActive.frame.scopedCorrections).toStrictEqual([]);

            // Grant advances membership revision; undo needs a post-grant owner frame.
            const afterGrant = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
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
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(undone.frame.scopedCorrections).toStrictEqual([]);
            const historical = yield* inspect(
              ownerContext,
              yield* Schema.decodeEffect(Inspect)({
                ...worldsEnvelope,
                input: {
                  atFrame: corrected.frame.frameRef,
                  subjectKey: luzKey,
                },
                operation: "Inspect",
                worldRef,
              })
            );
            expect(historical.frame.scopedCorrections).toHaveLength(1);
            expect(historical.frame.claims).toHaveLength(3);

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
                yield* inspectSubject(worldRef, luzKey)
              ).pipe(Effect.flip)
            ).toMatchObject({
              _tag: "NotFoundOrDenied",
              code: "NOT_FOUND_OR_DENIED",
            });

            const later = yield* canonicalJson({
              records: [
                bill(
                  "luz-revisao",
                  luzKey,
                  "189.90",
                  "2026-09-01",
                  "2026-10-01"
                ),
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "extrato-revisao",
                label: "Extrato revisado",
                namespace: "household.bank",
                revision: "2",
              },
            });
            yield* importEvidence(
              ownerContext,
              yield* importDocument(worldRef, later)
            );
            const ownerAfter = yield* inspect(
              ownerContext,
              yield* inspectSubject(worldRef, luzKey)
            );
            expect(ownerAfter.frame.claims.length).toBeGreaterThanOrEqual(3);
            expect(
              yield* inspect(
                viewerContext,
                yield* inspectSubject(worldRef, luzKey)
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
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
