import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import {
  CorrectionApplied,
  CorrectionProposed,
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import {
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
} from "./fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "d01.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
};
const executePath = "/api/d01/execute";
const sharingPath = "/api/d03/sharing";
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
          legacyOps.map((row) => row.operation).sort()
        ).toEqual(
          expect.arrayContaining([
            "CreatePersonalWorld",
            "GrantWorldReadAccess",
            "ImportEvidence",
            "RevokeWorldReadAccess",
          ])
        );

        const { runtime } = yield* harness.transitionToCurrentComponent();

        return yield* Effect.gen(function* withCurrentExecutor() {
          const executor = yield* SemanticExecutor;
          const bytes = (value: unknown) =>
            canonicalJson(value).pipe(
              Effect.map((text) => new TextEncoder().encode(text))
            );

          const replayBootstrap = yield* executor
            .execute(
              owner,
              yield* bytes({
                ...envelope,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: bootstrapId,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          expect(replayBootstrap).toStrictEqual(created);

          const replayImport = yield* executor
            .execute(owner, yield* bytes(importRequest))
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          expect(replayImport).toStrictEqual(imported);

          const replayGrant = yield* executor
            .executeSharing(owner, yield* bytes(grantRequest))
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
            );
          expect(replayGrant).toStrictEqual(granted);

          const replayRevoke = yield* executor
            .executeSharing(owner, yield* bytes(revokeRequest))
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
            );
          expect(replayRevoke).toStrictEqual(revoked);

          const freshImport = yield* executor
            .execute(
              owner,
              yield* bytes({
                ...envelope,
                input: { document: jsonDocument("2", "110.00") },
                operation: "ImportEvidence",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          const [importReceipt] = yield* sql`
            SELECT touched_domains
            FROM authority.receipts
            WHERE world_id = ${worldRef.worldId}::uuid
              AND receipt_id = ${freshImport.receiptRef}::uuid`;
          expect(importReceipt.touched_domains).toHaveProperty("identity");
          const framesBeforeGrant = yield* sql`
            SELECT count(*)::int AS frames
            FROM authority.frames
            WHERE world_id = ${worldRef.worldId}::uuid`;

          const regrant = yield* executor
            .executeSharing(
              owner,
              yield* bytes({
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
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
            );
          expect(regrant.membershipAtCommit).toMatchObject({
            revision: "2",
            state: "active",
          });
          const [grantReceipt] = yield* sql`
            SELECT touched_domains
            FROM authority.receipts
            WHERE world_id = ${worldRef.worldId}::uuid
              AND receipt_id = ${regrant.receiptRef}::uuid`;
          expect(grantReceipt.touched_domains).toHaveProperty("identity");
          expect(
            yield* sql`
              SELECT count(*)::int AS frames
              FROM authority.frames
              WHERE world_id = ${worldRef.worldId}::uuid`
          ).toStrictEqual(framesBeforeGrant);

          const inspected = yield* executor
            .execute(
              owner,
              yield* bytes({
                ...envelope,
                input: { atFrame: null, subjectKey: "invoice-a" },
                operation: "Inspect",
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const [storedBasis] = yield* sql`
            SELECT internal_basis
            FROM authority.frames
            WHERE world_id = ${worldRef.worldId}::uuid
              AND frame_id = ${inspected.frame.frameRef}::uuid`;
          expect(storedBasis.internal_basis).toMatchObject({
            schemaVersion: "authority.basis.v2",
          });
          expect(
            Object.keys(storedBasis.internal_basis.cut).sort()
          ).toStrictEqual([
            "cases",
            "claims",
            "evidence",
            "identity",
            "membership",
            "sources",
          ]);
          expect(storedBasis.internal_basis.readSet).toMatchObject({
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
              owner,
              yield* bytes({
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
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
            );
          const [caseBasis] = yield* sql`
            SELECT internal_basis
            FROM authority.cases
            WHERE world_id = ${worldRef.worldId}::uuid
              AND case_id = ${proposed.caseRef}::uuid`;
          expect(caseBasis.internal_basis.cut.cases).toBe(
            (BigInt(storedBasis.internal_basis.cut.cases) + 1n).toString()
          );
          expect({
            ...caseBasis.internal_basis,
            cut: {
              ...caseBasis.internal_basis.cut,
              cases: storedBasis.internal_basis.cut.cases,
            },
          }).toStrictEqual(storedBasis.internal_basis);

          const answered = yield* executor
            .executeCorrection(
              owner,
              yield* bytes({
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
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
            );
          expect(answered.correctionRef).toBeTruthy();

          const afterAnswer = yield* executor
            .execute(
              owner,
              yield* bytes({
                ...envelope,
                input: { atFrame: null, subjectKey: "invoice-a" },
                operation: "Inspect",
                worldRef,
              })
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
              owner,
              yield* bytes({
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
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
            );

          const [identityBefore] = yield* sql`
            SELECT version::text AS version
            FROM authority.domains
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`;
          yield* sql`
            UPDATE authority.domains
            SET version = version + 1
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`;
          expect(
            yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
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
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          const [identityAfter] = yield* sql`
            SELECT version::text AS version
            FROM authority.domains
            WHERE world_id = ${worldRef.worldId}::uuid
              AND domain_key = 'identity'`;
          expect(BigInt(identityAfter.version)).toBe(
            BigInt(identityBefore.version) + 1n
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
              owner,
              yield* bytes({
                ...envelope,
                input: { document: jsonDocument("3", "120.00") },
                operation: "ImportEvidence",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported)));
          const liveGrant = yield* executor
            .executeSharing(
              owner,
              yield* bytes({
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
              viewer,
              yield* bytes(viewerInspectRequest),
              (body) => {
                emitted = body;
                return "submitted";
              }
            )
          );
          expect(emitted).not.toBeNull();
          const emittedFrame = yield* Schema.decodeUnknownEffect(
            FrameInspected
          )(JSON.parse(new TextDecoder().decode(emitted as Uint8Array)));
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
              const pending = yield* sql`
                SELECT count(*)::int AS count FROM jobs.disclosure_pending`;
              if (pending[0]?.count === 0) {
                return;
              }
              yield* Effect.sleep("20 millis");
            }
            return yield* Effect.die("disclosure_pending did not clear after emission");
          });

          const won = yield* executor
            .executeSharing(
              owner,
              yield* bytes({
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
            .pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
            );
          expect(won.membershipAtCommit.state).toBe("revoked");

          let afterRevokeEmitted = false;
          expect(
            yield* Effect.scoped(
              executor.executeWithEmission(
                viewer,
                yield* bytes(viewerInspectRequest),
                () => {
                  afterRevokeEmitted = true;
                  return "submitted";
                }
              )
            ).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(afterRevokeEmitted).toBe(false);

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
