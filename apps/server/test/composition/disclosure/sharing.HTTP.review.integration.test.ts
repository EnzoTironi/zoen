import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  PrincipalRef,
  WorldAccessInspected,
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import {
  CorrectionApplied,
  CorrectionProposed,
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";
import type { HttpClientResponse } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const d01 = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
};
const d01Path = "/api/worlds/execute";
const sharingPath = "/api/d03/sharing";
const correctionPath = "/api/corrections/execute";
const denied = { _tag: "NotFoundOrDenied", code: "NOT_FOUND_OR_DENIED" };
const validTime = {
  _tag: "DateInterval",
  from: "2026-09-01",
  to: "2026-10-01",
};
const document = json({
  records: [
    {
      externalId: "invoice-1",
      predicate: "obligation.amount",
      subjectKey: "invoice-1",
      validTime,
      value: { _tag: "Known", amount: "123.45", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "billing",
    label: "Independent HTTP source — cobrança",
    namespace: "sharing-review",
    revision: "1",
  },
});

// Read-only observation of semantic rows. Operational disclosure coordination is deliberately separate.
const semanticRows = Effect.gen(function* semanticRows() {
  const sql = yield* SqlClient.SqlClient;
  const tables = yield* sql<{
    schema: string;
    name: string;
  }>`SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE (n.nspname = 'authority' OR (n.nspname = 'jobs' AND c.relname IN ('captures', 'outbox'))) AND c.relkind = 'r' ORDER BY 1, 2`;
  const snapshot: Record<string, unknown> = {};
  for (const table of tables) {
    snapshot[`${table.schema}.${table.name}`] =
      yield* sql`SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), '[]'::jsonb) AS rows FROM ${sql(table.schema)}.${sql(table.name)} r`;
  }
  return snapshot;
});

it.live(
  "independent SH01/02/04/06 HTTP sharing preserves audience, denies writes and private Frames, and separates historical replay from current access",
  () =>
    withD01Http(({ database, origin }) =>
      Effect.gen(function* publicSharingJourney() {
        const checked = Effect.fn("review.checkedJson")(function* checked(
          response: HttpClientResponse.HttpClientResponse,
          status = 200
        ) {
          expect(response.status).toBe(status);
          expect(response.headers["cache-control"]).toBe("no-store");
          expect(response.headers["referrer-policy"]).toBe("no-referrer");
          expect(response.headers["x-content-type-options"]).toBe("nosniff");
          expect(response.headers["content-type"]).toContain(
            "application/json"
          );
          expect(
            Schema.is(PrincipalRef)(response.headers["x-request-id"])
          ).toBeTruthy();
          const body = yield* jsonBody(response);
          const text = yield* response.text;
          expect(Number(response.headers["content-length"])).toBe(
            new TextEncoder().encode(text).byteLength
          );
          return body;
        });

        const signup = Effect.fn("review.signup")(function* signup(
          name: string
        ) {
          const response = yield* http(
            origin,
            "/api/auth/sign-up/email",
            json({
              email: `${randomUUID()}@example.test`,
              name,
              password: randomBytes(24).toString("base64url"),
            })
          );
          expect(response.status).toBe(200);
          // The provider's real signup response is the only source of the public account identifier.
          const account = yield* jsonBody(response).pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(
                Schema.Struct({ user: Schema.Struct({ id: PrincipalRef }) })
              )
            )
          );
          return {
            cookie: responseCookie(response),
            principal: account.user.id,
          };
        });
        const owner = yield* signup("Sharing owner");
        const viewer = yield* signup("Sharing viewer");
        const stranger = yield* signup("Sharing stranger");
        expect(
          new Set([owner.principal, viewer.principal, stranger.principal]).size
        ).toBe(3);
        const send = (
          path: string,
          request: unknown,
          account = owner,
          status = 200
        ) =>
          http(origin, path, json(request), account.cookie).pipe(
            Effect.flatMap((response) => checked(response, status))
          );
        const world = yield* send(d01Path, {
          ...d01,
          input: {},
          operation: "CreatePersonalWorld",
          operationId: randomUUID(),
        }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
        const { worldRef } = world;
        const importRequest = {
          ...d01,
          input: { document },
          operation: "ImportEvidence",
          operationId: randomUUID(),
          worldRef,
        };
        const evidence = yield* send(d01Path, importRequest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
        );
        const inspectRequest = (atFrame: string | null = null) => ({
          ...d01,
          input: { atFrame, subjectKey: "invoice-1" },
          operation: "Inspect",
          worldRef,
        });
        const ownerFrame = yield* send(d01Path, inspectRequest()).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        const [claim] = ownerFrame.frame.claims;
        if (claim === undefined) {
          throw new Error("Real import must produce a claim");
        }
        const consequence = {
          choice: { _tag: "selectClaim", claimRef: claim.claimRef },
          subjectKey: "invoice-1",
          validTime,
        };
        const proposalRequest = {
          ...d01,
          input: { consequence, frameRef: ownerFrame.frame.frameRef },
          operation: "ProposeCorrection",
          operationId: randomUUID(),
          worldRef,
        };
        const proposal = yield* send(correctionPath, proposalRequest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
        );
        const answerRequest = {
          ...d01,
          input: {
            answer: "confirm",
            consequenceDigest: proposal.consequenceDigest,
            questionRef: proposal.questionRef,
          },
          operation: "AnswerQuestion",
          operationId: randomUUID(),
          worldRef,
        };
        const applied = yield* send(correctionPath, answerRequest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
        );
        const correctedOwner = yield* send(d01Path, inspectRequest()).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        expect(correctedOwner.frame.scopedCorrections).toHaveLength(1);
        expect(correctedOwner.frame.scopedCorrections[0]?.correctionRef).toBe(
          applied.correctionRef
        );

        const access = (principalRef: string | null) => ({
          ...sharing,
          input: { principalRef },
          operation: "InspectWorldAccess",
          worldRef,
        });
        expect(
          yield* send(sharingPath, access(viewer.principal)).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WorldAccessInspected))
          )
        ).toStrictEqual({
          _tag: "WorldAccessInspected",
          membership: null,
          worldRef,
        });
        const grantRequest = {
          ...sharing,
          input: { expectedRevision: null, principalRef: viewer.principal },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          worldRef,
        };
        const grant = yield* send(sharingPath, grantRequest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
        );
        expect(grant.membershipAtCommit).toStrictEqual({
          principalRef: viewer.principal,
          revision: "0",
          role: "viewer",
          state: "active",
        });
        const self = yield* send(sharingPath, access(null), viewer).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldAccessInspected))
        );
        expect(self.membership).toStrictEqual(grant.membershipAtCommit);
        const viewed = yield* send(d01Path, inspectRequest(), viewer).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        expect(viewed.frame.claims).toStrictEqual(ownerFrame.frame.claims);
        expect(viewed.frame.scopedCorrections).toStrictEqual([]);
        expect(viewed.frame.verification).toBe("unverified");
        expect(viewed.frame.frameRef).not.toBe(ownerFrame.frame.frameRef);
        expect(
          yield* send(d01Path, inspectRequest(viewed.frame.frameRef), viewer)
        ).toStrictEqual(viewed);
        const openRequest = {
          ...d01,
          input: { evidenceRef: evidence.evidenceRef },
          operation: "OpenEvidence",
          worldRef,
        };
        const opened = yield* send(d01Path, openRequest, viewer).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceOpened))
        );
        expect(opened).toStrictEqual({
          _tag: "EvidenceOpened",
          document,
          evidenceRef: evidence.evidenceRef,
          mediaType: "application/json",
        });

        const beforeDenied = yield* semanticRows.pipe(
          Effect.provide(database.migration)
        );
        const deniedRequests = [
          {
            account: viewer,
            path: d01Path,
            request: inspectRequest(ownerFrame.frame.frameRef),
          },
          {
            account: viewer,
            path: d01Path,
            request: inspectRequest(correctedOwner.frame.frameRef),
          },
          {
            account: viewer,
            path: d01Path,
            request: { ...importRequest, operationId: randomUUID() },
          },
          {
            account: viewer,
            path: correctionPath,
            request: {
              ...proposalRequest,
              input: { consequence, frameRef: viewed.frame.frameRef },
              operationId: randomUUID(),
            },
          },
          { account: viewer, path: correctionPath, request: answerRequest },
          {
            account: viewer,
            path: correctionPath,
            request: {
              ...d01,
              input: {
                correctionRef: applied.correctionRef,
                frameRef: viewed.frame.frameRef,
              },
              operation: "UndoCorrection",
              operationId: randomUUID(),
              worldRef,
            },
          },
          {
            account: viewer,
            path: sharingPath,
            request: access(owner.principal),
          },
          {
            account: viewer,
            path: sharingPath,
            request: {
              ...grantRequest,
              input: {
                expectedRevision: null,
                principalRef: stranger.principal,
              },
              operationId: randomUUID(),
            },
          },
          {
            account: viewer,
            path: sharingPath,
            request: {
              ...grantRequest,
              input: { expectedRevision: "0", principalRef: viewer.principal },
              operation: "RevokeWorldReadAccess",
              operationId: randomUUID(),
            },
          },
          { account: stranger, path: d01Path, request: inspectRequest() },
          { account: stranger, path: d01Path, request: openRequest },
          { account: stranger, path: sharingPath, request: access(null) },
          { account: stranger, path: sharingPath, request: grantRequest },
          {
            account: stranger,
            path: d01Path,
            request: {
              ...inspectRequest(),
              worldRef: { ...worldRef, worldId: randomUUID() },
            },
          },
        ];
        for (const attempt of deniedRequests) {
          expect(
            yield* send(attempt.path, attempt.request, attempt.account, 404)
          ).toStrictEqual(denied);
        }
        expect(
          yield* semanticRows.pipe(Effect.provide(database.migration))
        ).toStrictEqual(beforeDenied);

        const revokeRequest = {
          ...grantRequest,
          input: { expectedRevision: "0", principalRef: viewer.principal },
          operation: "RevokeWorldReadAccess",
          operationId: randomUUID(),
        };
        const revoked = yield* send(sharingPath, revokeRequest).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessRevoked))
        );
        expect(revoked.membershipAtCommit).toStrictEqual({
          principalRef: viewer.principal,
          revision: "1",
          role: "viewer",
          state: "revoked",
        });
        for (const request of [
          inspectRequest(),
          inspectRequest(viewed.frame.frameRef),
          openRequest,
        ]) {
          expect(yield* send(d01Path, request, viewer, 404)).toStrictEqual(
            denied
          );
        }
        expect(
          yield* send(sharingPath, access(null), viewer, 404)
        ).toStrictEqual(denied);
        const beforeReplay = yield* semanticRows.pipe(
          Effect.provide(database.migration)
        );
        expect(yield* send(sharingPath, grantRequest)).toStrictEqual(grant);
        expect(
          yield* semanticRows.pipe(Effect.provide(database.migration))
        ).toStrictEqual(beforeReplay);
        expect(
          yield* send(sharingPath, access(viewer.principal))
        ).toStrictEqual({
          _tag: "WorldAccessInspected",
          membership: revoked.membershipAtCommit,
          worldRef,
        });
        expect(yield* send(d01Path, openRequest, viewer, 404)).toStrictEqual(
          denied
        );
        const regrant = yield* send(sharingPath, {
          ...grantRequest,
          input: { expectedRevision: "1", principalRef: viewer.principal },
          operationId: randomUUID(),
        }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldReadAccessGranted))
        );
        expect(regrant.membershipAtCommit).toStrictEqual({
          principalRef: viewer.principal,
          revision: "2",
          role: "viewer",
          state: "active",
        });
        expect(yield* send(d01Path, openRequest, viewer)).toStrictEqual(opened);
        expect(
          yield* send(d01Path, inspectRequest(viewed.frame.frameRef), viewer)
        ).toStrictEqual(viewed);
      })
    )
);
