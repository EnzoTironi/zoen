/* oxlint-disable unicorn/consistent-function-scoping */
import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
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
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
  asCurrentCredential,
  asCurrentWire,
  legacyWire,
} from "./harness.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const { envelope, executePath } = legacyWire;
const sharing = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
};
const sharingPath = "/api/sharing/execute";
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
      namespace: "independent-audience",
      revision,
    },
  });

const publicFrame = (frame: {
  readonly claims: readonly {
    readonly claimRef: string;
    readonly predicate: string;
    readonly recordId: string;
    readonly value: unknown;
  }[];
  readonly scopedCorrections: readonly unknown[];
  readonly subjectKey: string;
}) => ({
  claims: frame.claims.map((claim) => ({
    claimRef: claim.claimRef,
    predicate: claim.predicate,
    recordId: claim.recordId,
    value: claim.value,
  })),
  scopedCorrections: frame.scopedCorrections,
  subjectKey: frame.subjectKey,
});

it.live(
  "independent: grant-before-transition audience limits hold after identity basis cut",
  () =>
    withLegacyBasisHarness((harness) =>
      Effect.gen(function* refuteAudienceLeak() {
        const ownerSignup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Audience owner",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(ownerSignup.status).toBe(200);
        const owner = responseCookie(ownerSignup);
        const viewerSignup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Audience viewer",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(viewerSignup.status).toBe(200);
        const viewer = responseCookie(viewerSignup);
        const viewerAccount = yield* jsonBody(viewerSignup).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Account))
        );
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
        const imported = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: { document: jsonDocument("1", "100.00") },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          }),
          owner
        );
        expect(imported.status).toBe(200);
        yield* jsonBody(imported).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
        );
        const grantResponse = yield* http(
          harness.origin,
          sharingPath,
          json({
            ...sharing,
            input: {
              expectedRevision: null,
              principalRef: viewerAccount.user.id,
            },
            operation: "GrantWorldReadAccess",
            operationId: randomUUID(),
            worldRef,
          }),
          owner
        );
        expect(grantResponse.status).toBe(200);
        yield* jsonBody(grantResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
        );

        const ownerLegacy = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: { atFrame: null, subjectKey: "invoice-a" },
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
        const viewerLegacy = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: { atFrame: null, subjectKey: "invoice-a" },
            operation: "Inspect",
            worldRef,
          }),
          viewer
        ).pipe(
          Effect.flatMap((response) => {
            expect(response.status).toBe(200);
            return jsonBody(response);
          }),
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        expect(publicFrame(viewerLegacy.frame)).toStrictEqual(
          publicFrame(ownerLegacy.frame)
        );
        expect(viewerLegacy.frame.frameRef).not.toBe(
          ownerLegacy.frame.frameRef
        );

        const { runtime } = yield* harness.transitionToCurrentComponent();
        const current_owner = asCurrentCredential(owner);
        const current_stranger = asCurrentCredential(stranger);
        const current_viewer = asCurrentCredential(viewer);

        return yield* Effect.gen(function* withCurrentExecutor() {
          const executor = yield* SemanticExecutor;
          const bytes = (value: unknown) =>
            canonicalJson(value).pipe(
              Effect.map((text) => new TextEncoder().encode(text))
            );
          const inspectRequest = {
            ...envelope,
            input: { atFrame: null, subjectKey: "invoice-a" },
            operation: "Inspect",
            worldRef,
          };

          const viewerLive = yield* executor
            .execute(
              current_viewer,
              yield* bytes(asCurrentWire(inspectRequest))
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          expect(publicFrame(viewerLive.frame)).toStrictEqual(
            publicFrame(viewerLegacy.frame)
          );

          let emitted: Uint8Array | null = null;
          yield* Effect.scoped(
            executor.executeWithEmission(
              current_viewer,
              yield* bytes(asCurrentWire(inspectRequest)),
              (body) => {
                emitted = body;
                return "submitted";
              }
            )
          );
          expect(emitted).not.toBeNull();
          if (emitted === null) {
            return yield* Effect.die("Expected emission");
          }
          const text = new TextDecoder().decode(emitted);
          expect(text).not.toContain("SubjectIdentityGraph");
          expect(text).not.toContain("authority.basis.v2");
          expect(text).not.toContain("authority.read-set.v2");

          expect(
            yield* executor
              .execute(
                current_stranger,
                yield* bytes(asCurrentWire(inspectRequest))
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(
            yield* executor
              .execute(
                current_viewer,
                yield* bytes(
                  asCurrentWire({
                    ...envelope,
                    input: {
                      atFrame: ownerLegacy.frame.frameRef,
                      subjectKey: "invoice-a",
                    },
                    operation: "Inspect",
                    worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });

          const ownerLive = yield* executor
            .execute(current_owner, yield* bytes(asCurrentWire(inspectRequest)))
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const selected = ownerLive.frame.claims.find(
            (claim) => claim.recordId === "invoice-a"
          );
          if (selected === undefined) {
            return yield* Effect.die("Expected owner claim");
          }
          const proposed = yield* executor
            .executeCorrection(
              current_owner,
              yield* bytes(
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
                    frameRef: ownerLive.frame.frameRef,
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
          const applied = yield* executor
            .executeCorrection(
              current_owner,
              yield* bytes(
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
          expect(applied.correctionRef).toBeTruthy();

          const ownerAfter = yield* executor
            .execute(current_owner, yield* bytes(asCurrentWire(inspectRequest)))
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          expect(ownerAfter.frame.scopedCorrections.length).toBeGreaterThan(0);
          const viewerFrozen = yield* executor
            .execute(
              current_viewer,
              yield* bytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    atFrame: viewerLegacy.frame.frameRef,
                    subjectKey: "invoice-a",
                  },
                  operation: "Inspect",
                  worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          expect(publicFrame(viewerFrozen.frame)).toStrictEqual(
            publicFrame(viewerLegacy.frame)
          );
          expect(viewerFrozen.frame.scopedCorrections).toStrictEqual([]);

          expect(
            yield* executor
              .executeCorrection(
                current_viewer,
                yield* bytes(
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
                      frameRef: ownerLive.frame.frameRef,
                    },
                    operation: "ProposeCorrection",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });

          const sql = yield* SqlClient.SqlClient;
          yield* Effect.gen(function* awaitAck() {
            for (let attempt = 0; attempt < 200; attempt += 1) {
              const pending = yield* sql`
                SELECT count(*)::int AS count FROM jobs.disclosure_pending`;
              if (pending[0]?.count === 0) {
                return null;
              }
              yield* Effect.sleep("20 millis");
            }
            return yield* Effect.die("disclosure_pending did not clear");
          });

          const revoked = yield* executor
            .executeSharing(
              current_owner,
              yield* bytes(
                asCurrentWire({
                  ...sharing,
                  input: {
                    expectedRevision: "0",
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
          expect(revoked.membershipAtCommit.state).toBe("revoked");
          let afterRevoke = false;
          expect(
            yield* Effect.scoped(
              executor.executeWithEmission(
                current_viewer,
                yield* bytes(asCurrentWire(inspectRequest)),
                () => {
                  afterRevoke = true;
                  return "submitted";
                }
              )
            ).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(afterRevoke).toBeFalsy();

          return {
            oracles: [
              "pre-transition-grant",
              "viewer-frozen-frame",
              "private-basis-not-emitted",
              "viewer-denied-propose",
              "revoke-blocks-emission",
            ],
            revision: harness.legacy.revision,
          };
        }).pipe(Effect.provide(runtime));
      }).pipe(Effect.provide(harness.database.authority))
    ),
  300_000
);
