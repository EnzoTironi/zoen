import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import {
  CorrectionApplied,
  CorrectionProposed,
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { InternalBasis } from "@zoen/ontology/ports/worlds/basis";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { canonicalJson } from "@zoen/ontology/values/canonical";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  asCurrentCredential,
  realignIntentDigest,
  asCurrentWire,
  http,
  jsonBody,
  legacyWire,
  responseCookie,
  withLegacyBasisHarness,
} from "./fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const encodeBytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((text) => new TextEncoder().encode(text))
  );

const requireRow = <A>(row: A | undefined, message: string) => {
  if (row === undefined) {
    throw new Error(message);
  }
  return row;
};

const {
  envelope,
  executePath,
  sharingEnvelope: sharing,
  sharingPath,
} = legacyWire;
const validTime = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};
const Account = Schema.Struct({
  user: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
});
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
  "EX25 BC-06..07 and BC-09 after additive identity-domain transition",
  () =>
    withLegacyBasisHarness((harness) =>
      Effect.gen(function* proveLaterOracles() {
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
        const ownerAccount = yield* jsonBody(signup).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Account))
        );
        const viewerSignup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Viewer",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(viewerSignup.status).toBe(200);
        const viewer = responseCookie(viewerSignup);
        const viewerAccount = yield* jsonBody(viewerSignup).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Account))
        );

        const bootstrapId = randomUUID();
        const createdResponse = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: bootstrapId,
          }),
          owner
        );
        expect(createdResponse.status).toBe(200);
        const created = yield* jsonBody(createdResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        const { worldRef } = created;

        const importId = randomUUID();
        const importRequest = {
          ...envelope,
          input: { document: jsonDocument("1", "100.00") },
          operation: "ImportEvidence",
          operationId: importId,
          worldRef,
        };
        const importedResponse = yield* http(
          harness.origin,
          executePath,
          json(importRequest),
          owner
        );
        expect(importedResponse.status).toBe(200);
        const imported = yield* jsonBody(importedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
        );

        const grantId = randomUUID();
        const grantRequest = {
          ...sharing,
          input: {
            expectedRevision: null,
            principalRef: viewerAccount.user.id,
          },
          operation: "GrantWorldReadAccess",
          operationId: grantId,
          worldRef,
        };
        const grantedResponse = yield* http(
          harness.origin,
          sharingPath,
          json(grantRequest),
          owner
        );
        expect(grantedResponse.status).toBe(200);
        const granted = yield* jsonBody(grantedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
        );

        const revokeId = randomUUID();
        const revokeRequest = {
          ...sharing,
          input: {
            expectedRevision: "0",
            principalRef: viewerAccount.user.id,
          },
          operation: "RevokeWorldReadAccess",
          operationId: revokeId,
          worldRef,
        };
        const revokedResponse = yield* http(
          harness.origin,
          sharingPath,
          json(revokeRequest),
          owner
        );
        expect(revokedResponse.status).toBe(200);
        const revoked = yield* jsonBody(revokedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
        );

        const sql = yield* SqlClient.SqlClient;
        const legacyOps = yield* sql`
          SELECT operation
          FROM authority.receipts
          WHERE world_id = ${worldRef.worldId}::uuid`;
        expect(
          legacyOps
            .map((row) => String(row.operation))
            .toSorted((left, right) => left.localeCompare(right))
        ).toStrictEqual(
          expect.arrayContaining([
            "CreatePersonalWorld",
            "GrantWorldReadAccess",
            "ImportEvidence",
            "RevokeWorldReadAccess",
          ])
        );

        const { runtime } = yield* harness.transitionToCurrentComponent();
        const current_owner = asCurrentCredential(owner);
        const current_viewer = asCurrentCredential(viewer);

        return yield* Effect.gen(function* withCurrentExecutor() {
          const executor = yield* SemanticExecutor;

          const bootstrapRequest = {
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: bootstrapId,
          };
          yield* realignIntentDigest(
            ownerAccount.user.id,
            bootstrapRequest
          ).pipe(Effect.provide(harness.database.migration));
          const replayBootstrap = yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(asCurrentWire(bootstrapRequest))
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          expect(replayBootstrap).toStrictEqual(created);

          yield* realignIntentDigest(
            ownerAccount.user.id,
            importRequest,
            worldRef
          ).pipe(Effect.provide(harness.database.migration));
          const replayImport = yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(asCurrentWire(importRequest))
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          expect(replayImport).toStrictEqual(imported);

          yield* realignIntentDigest(
            ownerAccount.user.id,
            grantRequest,
            worldRef
          ).pipe(Effect.provide(harness.database.migration));
          const replayGrant = yield* executor
            .executeSharing(
              current_owner,
              yield* encodeBytes(asCurrentWire(grantRequest))
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
            );
          expect(replayGrant).toStrictEqual(granted);

          yield* realignIntentDigest(
            ownerAccount.user.id,
            revokeRequest,
            worldRef
          ).pipe(Effect.provide(harness.database.migration));
          const replayRevoke = yield* executor
            .executeSharing(
              current_owner,
              yield* encodeBytes(asCurrentWire(revokeRequest))
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
            );
          expect(replayRevoke).toStrictEqual(revoked);

          const freshImport = yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: { document: jsonDocument("2", "110.00") },
                  operation: "ImportEvidence",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          const importReceipt = requireRow(
            (yield* sql`
            SELECT touched_domains
            FROM authority.receipts
            WHERE world_id = ${worldRef.worldId}::uuid
              AND receipt_id = ${freshImport.receiptRef}::uuid`)[0],
            "missing import receipt"
          );
          expect(importReceipt.touched_domains).toHaveProperty("identity");
          const framesBeforeGrant = yield* sql`
            SELECT count(*)::int AS frames
            FROM authority.frames
            WHERE world_id = ${worldRef.worldId}::uuid`;

          const regrant = yield* executor
            .executeSharing(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...sharing,
                  input: {
                    expectedRevision: "1",
                    principalRef: viewerAccount.user.id,
                  },
                  operation: "GrantWorldReadAccess",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
            );
          expect(regrant.membershipAtCommit).toMatchObject({
            revision: "2",
            state: "active",
          });
          const grantReceipt = requireRow(
            (yield* sql`
            SELECT touched_domains
            FROM authority.receipts
            WHERE world_id = ${worldRef.worldId}::uuid
              AND receipt_id = ${regrant.receiptRef}::uuid`)[0],
            "missing grant receipt"
          );
          expect(grantReceipt.touched_domains).toHaveProperty("identity");
          expect(
            yield* sql`
              SELECT count(*)::int AS frames
              FROM authority.frames
              WHERE world_id = ${worldRef.worldId}::uuid`
          ).toStrictEqual(framesBeforeGrant);

          const inspected = yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: { atFrame: null, subjectKey: "invoice-a" },
                  operation: "Inspect",
                  worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const storedBasisRow = requireRow(
            (yield* sql`
            SELECT internal_basis
            FROM authority.frames
            WHERE world_id = ${worldRef.worldId}::uuid
              AND frame_id = ${inspected.frame.frameRef}::uuid`)[0],
            "missing stored frame basis"
          );
          const storedBasis = Schema.decodeUnknownSync(InternalBasis)(
            storedBasisRow.internal_basis
          );
          expect(storedBasis).toMatchObject({
            schemaVersion: "authority.basis.v2",
          });
          expect(Object.keys(storedBasis.cut).toSorted()).toStrictEqual([
            "cases",
            "claims",
            "evidence",
            "identity",
            "membership",
            "sources",
          ]);
          expect(storedBasis.readSet).toMatchObject({
            identities: [],
            schemaVersion: "authority.read-set.v2",
          });
          const selected = inspected.frame.claims.find(
            (claim) => claim.recordId === "invoice-a"
          );
          if (selected === undefined) {
            return yield* Effect.die("Expected claim on complete basis frame");
          }

          const proposed = yield* executor
            .executeCorrection(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    consequence: {
                      choice: {
                        _tag: "selectClaim",
                        claimRef: selected.claimRef,
                      },
                      subjectKey: "invoice-a",
                      validTime,
                    },
                    frameRef: inspected.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
            );
          const caseBasisRow = requireRow(
            (yield* sql`
            SELECT internal_basis
            FROM authority.cases
            WHERE world_id = ${worldRef.worldId}::uuid
              AND case_id = ${proposed.caseRef}::uuid`)[0],
            "missing case basis"
          );
          const caseBasis = Schema.decodeUnknownSync(InternalBasis)(
            caseBasisRow.internal_basis
          );
          expect(caseBasis.cut.cases).toBe(
            (BigInt(storedBasis.cut.cases) + 1n).toString()
          );
          expect({
            ...caseBasis,
            cut: {
              ...caseBasis.cut,
              cases: storedBasis.cut.cases,
            },
          }).toStrictEqual(storedBasis);

          const answered = yield* executor
            .executeCorrection(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    answer: "confirm",
                    consequenceDigest: proposed.consequenceDigest,
                    questionRef: proposed.questionRef,
                  },
                  operation: "AnswerQuestion",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
            );
          expect(answered.correctionRef).toBeTruthy();

          const afterAnswer = yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: { atFrame: null, subjectKey: "invoice-a" },
                  operation: "Inspect",
                  worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const afterSelected = afterAnswer.frame.claims.find(
            (claim) => claim.recordId === "invoice-a"
          );
          if (afterSelected === undefined) {
            return yield* Effect.die("Expected claim after answer");
          }
          const pending = yield* executor
            .executeCorrection(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    consequence: {
                      choice: {
                        _tag: "selectClaim",
                        claimRef: afterSelected.claimRef,
                      },
                      subjectKey: "invoice-a",
                      validTime,
                    },
                    frameRef: afterAnswer.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
            );

          const identityBefore = requireRow(
            (yield* sql`
            SELECT version::text AS version
            FROM authority.domains
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`)[0],
            "missing identity domain before"
          );
          yield* sql`
            UPDATE authority.domains
            SET version = version + 1
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`;
          expect(
            yield* executor
              .executeCorrection(
                current_owner,
                yield* encodeBytes(
                  asCurrentWire({
                    ...envelope,
                    input: {
                      answer: "confirm",
                      consequenceDigest: pending.consequenceDigest,
                      questionRef: pending.questionRef,
                    },
                    operation: "AnswerQuestion",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          const identityAfter = requireRow(
            (yield* sql`
            SELECT version::text AS version
            FROM authority.domains
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`)[0],
            "missing identity domain after"
          );
          expect(BigInt(String(identityAfter.version))).toBe(
            BigInt(String(identityBefore.version)) + 1n
          );
          expect(
            yield* sql`
              SELECT count(*)::int AS pending
              FROM authority.cases
              WHERE world_id = ${worldRef.worldId}::uuid
                AND case_id = ${pending.caseRef}::uuid
                AND state = 'proposed'`
          ).toStrictEqual([{ pending: 1 }]);

          yield* executor
            .execute(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...envelope,
                  input: { document: jsonDocument("3", "120.00") },
                  operation: "ImportEvidence",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          const liveGrant = yield* executor
            .executeSharing(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...sharing,
                  input: {
                    expectedRevision: "2",
                    principalRef: viewerAccount.user.id,
                  },
                  operation: "GrantWorldReadAccess",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
            );
          expect(liveGrant.membershipAtCommit.state).toBe("active");

          const viewerInspectRequest = {
            ...envelope,
            input: { atFrame: null, subjectKey: "invoice-a" },
            operation: "Inspect",
            worldRef,
          };
          let emitted: Uint8Array | null = null;
          yield* Effect.scoped(
            executor.executeWithEmission(
              current_viewer,
              yield* encodeBytes(asCurrentWire(viewerInspectRequest)),
              (body) => {
                emitted = body;
                return "submitted";
              }
            )
          );
          if (emitted === null) {
            return yield* Effect.die("expected disclosure emission body");
          }
          const emittedFrame = yield* Schema.decodeUnknownEffect(
            FrameInspected
          )(JSON.parse(new TextDecoder().decode(emitted)));
          expect(emittedFrame._tag).toBe("FrameInspected");
          expect(emittedFrame.frame.subjectKey).toBe("invoice-a");
          expect(JSON.stringify(emittedFrame)).not.toContain(
            "SubjectIdentityGraph"
          );
          expect(JSON.stringify(emittedFrame)).not.toContain(
            "authority.basis.v2"
          );

          // Wait for disclosure ACK so membership writers are not blocked by a stale pending row.
          yield* Effect.gen(function* awaitAck() {
            for (let attempt = 0; attempt < 200; attempt += 1) {
              const pendingRows = yield* sql`
                SELECT count(*)::int AS count FROM jobs.disclosure_pending`;
              if (pendingRows[0]?.count === 0) {
                return "acked" as const;
              }
              yield* Effect.sleep("20 millis");
            }
            return yield* Effect.die(
              "disclosure_pending did not clear after emission"
            );
          });

          const won = yield* executor
            .executeSharing(
              current_owner,
              yield* encodeBytes(
                asCurrentWire({
                  ...sharing,
                  input: {
                    expectedRevision: liveGrant.membershipAtCommit.revision,
                    principalRef: viewerAccount.user.id,
                  },
                  operation: "RevokeWorldReadAccess",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
            )
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
            );
          expect(won.membershipAtCommit.state).toBe("revoked");

          let afterRevokeEmitted = false;
          expect(
            yield* Effect.scoped(
              executor.executeWithEmission(
                current_viewer,
                yield* encodeBytes(asCurrentWire(viewerInspectRequest)),
                () => {
                  afterRevokeEmitted = true;
                  return "submitted";
                }
              )
            ).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(afterRevokeEmitted).toBeFalsy();

          return {
            bc: ["BC-06", "BC-07", "BC-09"],
            owner: ownerAccount.user.id,
            revision: harness.legacy.revision,
            viewer: viewerAccount.user.id,
          };
        }).pipe(Effect.provide(runtime));
      }).pipe(Effect.provide(harness.database.authority))
    ),
  240_000
);
