import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Result, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withIdentityDatabase } from "../../../../apps/server/test/identity/worlds/database.ts";
import { createAccount } from "../../../../apps/server/test/identity/worlds/http.ts";
import { inspectWorldAccess } from "../../../../packages/authority/src/access/sharing/inspect.ts";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../../packages/authority/src/access/sharing/mutation.ts";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.ts";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.ts";
import { importEvidence } from "../../../../packages/authority/src/evidence/worlds/import.ts";
import { openEvidence } from "../../../../packages/authority/src/evidence/worlds/open.ts";
import { answerQuestion } from "../../../../packages/authority/src/knowledge/corrections/answer.ts";
import { proposeCorrection } from "../../../../packages/authority/src/knowledge/corrections/propose.ts";
import { undoCorrection } from "../../../../packages/authority/src/knowledge/corrections/undo.ts";
import { inspect } from "../../../../packages/authority/src/knowledge/worlds/inspect.ts";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/worlds/context.ts";
import {
  canonicalJson,
  digestBytes,
} from "../../../../packages/authority/src/values/canonical.ts";
import {
  GrantWorldReadAccess,
  InspectWorldAccess,
  RevokeWorldReadAccess,
} from "../../../../packages/contracts/src/sharing/operations.ts";
import {
  AnswerQuestion,
  CreatePersonalWorld,
  ImportEvidence,
  Inspect,
  OpenEvidence,
  ProposeCorrection,
  UndoCorrection,
} from "../../../../packages/contracts/src/worlds/operations.ts";
import type { WorldRef } from "../../../../packages/contracts/src/worlds/values.ts";
import { configuration } from "../../worlds/commit/fixture.ts";

type Fixture = Parameters<Parameters<typeof withIdentityDatabase>[0]>[0];
const installSharing = (fixture: Fixture) =>
  Effect.gen(function* installSharingSchema() {
    const source = yield* FileSystem.FileSystem.use((fs) =>
      fs.readFileString(
        fileURLToPath(
          new URL(
            "../../../../ops/migrations/005_world_read_membership.sql",
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
const contextFromCredential = Effect.fn("review.contextFromCredential")(
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
const createRequest = () =>
  Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "worlds.v1",
  });
const importRequest = (worldRef: WorldRef, revision = "1") =>
  Effect.gen(function* prepareImportRequest() {
    const document = yield* canonicalJson({
      records: [
        {
          externalId: "r1",
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
      ],
      schemaVersion: "worlds.v1",
      source: {
        externalId: "billing",
        label: `Original ${revision}`,
        namespace: "manual",
        revision,
      },
    });
    return yield* Schema.decodeEffect(ImportEvidence)({
      input: { document },
      operation: "ImportEvidence",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
      worldRef,
    });
  });
const grantRequest = (worldRef: WorldRef, principalRef: string) =>
  Schema.decodeEffect(GrantWorldReadAccess)({
    input: { expectedRevision: null, principalRef },
    operation: "GrantWorldReadAccess",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "d03.sharing.v1",
    worldRef,
  });

it.live(
  "independent sharing replay preserves the installation guards of the existing mutation path",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setup() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* installationReplay() {
            const owner = yield* createAccount(fixture.config.baseUrl);
            const viewer = yield* createAccount(fixture.config.baseUrl);
            const context = yield* contextFromCredential(owner.credential);
            const created = yield* createPersonalWorld(
              context,
              yield* createRequest()
            );
            const imported = yield* importRequest(created.worldRef);
            yield* importEvidence(context, imported);
            const grant = yield* grantRequest(created.worldRef, viewer.user.id);
            const granted = yield* grantWorldReadAccess(context, grant);
            expect(yield* grantWorldReadAccess(context, grant)).toStrictEqual(
              granted
            );
            const installation = yield* AuthorityInstallation;
            const observations: {
              dimension: string;
              importResult: string;
              sharingResult: string;
            }[] = [];
            for (const [dimension, changed] of [
              ["cellId", { ...installation, cellId: randomUUID() }],
              [
                "cellEpoch",
                {
                  ...installation,
                  cellEpoch: (BigInt(installation.cellEpoch) + 1n).toString(),
                },
              ],
              ["generationId", { ...installation, generationId: randomUUID() }],
              [
                "releaseDigest",
                {
                  ...installation,
                  releaseDigest: digestBytes(
                    new TextEncoder().encode(
                      "independent different executable release"
                    )
                  ),
                },
              ],
            ] as const) {
              const alternate = yield* Schema.decodeEffect(
                AuthorityInstallationSchema
              )(changed);
              const oldPath = yield* importEvidence(context, imported).pipe(
                Effect.provideService(AuthorityInstallation, alternate),
                Effect.result
              );
              const sharingPath = yield* grantWorldReadAccess(
                context,
                grant
              ).pipe(
                Effect.provideService(AuthorityInstallation, alternate),
                Effect.result
              );
              observations.push({
                dimension,
                importResult: Result.isFailure(oldPath)
                  ? oldPath.failure._tag
                  : oldPath.success._tag,
                sharingResult: Result.isFailure(sharingPath)
                  ? sharingPath.failure._tag
                  : sharingPath.success._tag,
              });
            }
            expect(observations).toStrictEqual(
              ["cellId", "cellEpoch", "generationId", "releaseDigest"].map(
                (dimension) => ({
                  dimension,
                  importResult: "Stale",
                  sharingResult: "Stale",
                })
              )
            );
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

it.live(
  "independent SH-02–04 viewer reads World evidence without observing private owner Questions corrections or Frames",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setupAudience() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* privateAudience() {
            const owner = yield* createAccount(fixture.config.baseUrl);
            const viewer = yield* createAccount(fixture.config.baseUrl);
            const stranger = yield* createAccount(fixture.config.baseUrl);
            const ownerContext = yield* contextFromCredential(owner.credential);
            const viewerContext = yield* contextFromCredential(
              viewer.credential
            );
            const strangerContext = yield* contextFromCredential(
              stranger.credential
            );
            const { worldRef } = yield* createPersonalWorld(
              ownerContext,
              yield* createRequest()
            );
            const firstInput = yield* importRequest(worldRef);
            const first = yield* importEvidence(ownerContext, firstInput);
            yield* importEvidence(
              ownerContext,
              yield* importRequest(worldRef, "2")
            );
            yield* grantWorldReadAccess(
              ownerContext,
              yield* grantRequest(worldRef, viewer.user.id)
            );
            const inspectInput = yield* Schema.decodeEffect(Inspect)({
              input: { atFrame: null, subjectKey: "A" },
              operation: "Inspect",
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef,
            });
            const openInput = yield* Schema.decodeEffect(OpenEvidence)({
              input: { evidenceRef: first.evidenceRef },
              operation: "OpenEvidence",
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef,
            });
            const visibleBefore = yield* inspect(viewerContext, inspectInput);
            const ownerBefore = yield* inspect(ownerContext, inspectInput);
            const originalBytes = yield* openEvidence(viewerContext, openInput);
            expect(originalBytes.document).toBe(firstInput.input.document);
            expect(visibleBefore.frame.claims).toHaveLength(2);
            expect(visibleBefore.frame.scopedCorrections).toStrictEqual([]);
            const proposalInput = yield* Schema.decodeEffect(ProposeCorrection)(
              {
                input: {
                  consequence: {
                    choice: { _tag: "unknown" },
                    subjectKey: "A",
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                  },
                  frameRef: ownerBefore.frame.frameRef,
                },
                operation: "ProposeCorrection",
                operationId: randomUUID(),
                purpose: "personal-records",
                schemaVersion: "worlds.v1",
                worldRef,
              }
            );
            const proposal = yield* proposeCorrection(
              ownerContext,
              proposalInput
            );
            const pending = yield* inspect(viewerContext, inspectInput);
            const answerInput = yield* Schema.decodeEffect(AnswerQuestion)({
              input: {
                answer: "confirm",
                consequenceDigest: proposal.consequenceDigest,
                questionRef: proposal.questionRef,
              },
              operation: "AnswerQuestion",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef,
            });
            for (const questionRef of [proposal.questionRef, randomUUID()]) {
              expect(
                yield* answerQuestion(
                  viewerContext,
                  yield* Schema.decodeEffect(AnswerQuestion)({
                    ...answerInput,
                    input: { ...answerInput.input, questionRef },
                  })
                ).pipe(Effect.flip)
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            yield* answerQuestion(ownerContext, answerInput);
            const ownerAfter = yield* inspect(ownerContext, inspectInput);
            const visibleAfter = yield* inspect(viewerContext, inspectInput);
            expect(ownerAfter.frame.scopedCorrections).toHaveLength(1);
            const { frameRef: _beforeRef, ...beforePayload } =
              visibleBefore.frame;
            const { frameRef: _pendingRef, ...pendingPayload } = pending.frame;
            const { frameRef: _afterRef, ...afterPayload } = visibleAfter.frame;
            // Only independently generated Frame IDs are normalized; all functional DTO fields remain compared.
            expect(pendingPayload).toStrictEqual(beforePayload);
            expect(afterPayload).toStrictEqual(beforePayload);
            expect(yield* openEvidence(viewerContext, openInput)).toStrictEqual(
              originalBytes
            );
            const ownFrame = {
              ...inspectInput,
              input: {
                ...inspectInput.input,
                atFrame: visibleBefore.frame.frameRef,
              },
            };
            expect(yield* inspect(viewerContext, ownFrame)).toStrictEqual(
              visibleBefore
            );
            for (const context of [viewerContext, strangerContext]) {
              expect(
                yield* inspect(context, {
                  ...inspectInput,
                  input: {
                    ...inspectInput.input,
                    atFrame: ownerAfter.frame.frameRef,
                  },
                }).pipe(Effect.flip)
              ).toMatchObject({ _tag: "NotFoundOrDenied" });
            }
            expect(
              yield* inspect(ownerContext, ownFrame).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            expect(
              yield* openEvidence(strangerContext, openInput).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            expect(
              yield* importEvidence(
                viewerContext,
                yield* importRequest(worldRef, "3")
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            expect(
              yield* proposeCorrection(viewerContext, {
                ...proposalInput,
                input: {
                  ...proposalInput.input,
                  frameRef: visibleAfter.frame.frameRef,
                },
              }).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            expect(
              yield* grantWorldReadAccess(
                viewerContext,
                yield* grantRequest(worldRef, stranger.user.id)
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            expect(
              yield* revokeWorldReadAccess(
                viewerContext,
                yield* Schema.decodeEffect(RevokeWorldReadAccess)({
                  input: {
                    expectedRevision: "0",
                    principalRef: viewer.user.id,
                  },
                  operation: "RevokeWorldReadAccess",
                  operationId: randomUUID(),
                  purpose: "personal-records",
                  schemaVersion: "d03.sharing.v1",
                  worldRef,
                })
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            const [correction] = ownerAfter.frame.scopedCorrections;
            if (correction === undefined) {
              throw new Error("Expected an actual owner correction");
            }
            expect(
              yield* undoCorrection(
                viewerContext,
                yield* Schema.decodeEffect(UndoCorrection)({
                  input: {
                    correctionRef: correction.correctionRef,
                    frameRef: ownerAfter.frame.frameRef,
                  },
                  operation: "UndoCorrection",
                  operationId: randomUUID(),
                  purpose: "personal-records",
                  schemaVersion: "worlds.v1",
                  worldRef,
                })
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "NotFoundOrDenied" });
            const selfAccess = yield* inspectWorldAccess(
              viewerContext,
              yield* Schema.decodeEffect(InspectWorldAccess)({
                input: { principalRef: null },
                operation: "InspectWorldAccess",
                purpose: "personal-records",
                schemaVersion: "d03.sharing.v1",
                worldRef,
              })
            );
            expect(selfAccess.membership).toStrictEqual({
              principalRef: viewer.user.id,
              revision: "0",
              role: "viewer",
              state: "active",
            });
            for (const principalRef of [
              owner.user.id,
              stranger.user.id,
              randomUUID(),
            ]) {
              expect(
                yield* inspectWorldAccess(
                  viewerContext,
                  yield* Schema.decodeEffect(InspectWorldAccess)({
                    input: { principalRef },
                    operation: "InspectWorldAccess",
                    purpose: "personal-records",
                    schemaVersion: "d03.sharing.v1",
                    worldRef,
                  })
                ).pipe(Effect.flip)
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            const laterInput = yield* importRequest(worldRef, "3");
            const later = yield* importEvidence(ownerContext, laterInput);
            expect(
              (yield* inspect(viewerContext, inspectInput)).frame.claims
            ).toHaveLength(3);
            expect(
              (yield* openEvidence(viewerContext, {
                ...openInput,
                input: { evidenceRef: later.evidenceRef },
              })).document
            ).toBe(laterInput.input.document);
            expect(yield* inspect(viewerContext, ownFrame)).toStrictEqual(
              visibleBefore
            );
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
