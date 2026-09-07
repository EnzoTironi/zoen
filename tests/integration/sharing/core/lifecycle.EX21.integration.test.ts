import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { createAccount } from "../../../../apps/server/test/identity/worlds/http.js";
import { inspectWorldAccess } from "../../../../packages/authority/src/access/sharing/inspect.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../../packages/authority/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  GrantWorldReadAccess,
  InspectWorldAccess,
  RevokeWorldReadAccess,
} from "../../../../packages/contracts/src/sharing/operations.js";
import { configuration } from "../../worlds/commit/fixture.js";
import {
  genesisRequest,
  verifiedContext,
  withSharingDatabase,
} from "./fixture.js";

const envelope = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
} as const;

it.live(
  "SH-04–06 membership revisions remain monotonic, receipts replay historical state, and eligibility is consulted only for a new grant",
  () =>
    withSharingDatabase((fixture) =>
      Effect.gen(function* membershipLifecycle() {
        const owner = yield* createAccount(fixture.config.baseUrl);
        const viewer = yield* createAccount(fixture.config.baseUrl);
        const third = yield* createAccount(fixture.config.baseUrl);
        const context = yield* verifiedContext(owner.credential);
        const { worldRef } = yield* createPersonalWorld(
          context,
          yield* genesisRequest
        );
        const sql = yield* SqlClient.SqlClient;
        const accessRequest = yield* Schema.decodeEffect(InspectWorldAccess)({
          ...envelope,
          input: { principalRef: viewer.user.id },
          operation: "InspectWorldAccess",
          worldRef,
        });
        expect(yield* inspectWorldAccess(context, accessRequest)).toMatchObject(
          { membership: null, worldRef }
        );
        const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          ...envelope,
          input: { expectedRevision: null, principalRef: viewer.user.id },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          worldRef,
        });
        const [first, retry] = yield* Effect.all(
          [
            grantWorldReadAccess(context, grant),
            grantWorldReadAccess(context, grant),
          ],
          { concurrency: 2 }
        );
        expect(retry).toStrictEqual(first);
        expect(first.membershipAtCommit).toStrictEqual({
          principalRef: viewer.user.id,
          revision: "0",
          role: "viewer",
          state: "active",
        });
        const noOpGrant = yield* grantWorldReadAccess(context, {
          ...grant,
          input: {
            ...grant.input,
            expectedRevision: first.membershipAtCommit.revision,
          },
          operationId: yield* Schema.decodeEffect(
            GrantWorldReadAccess.fields.operationId
          )(randomUUID()),
        });
        expect(noOpGrant.membershipAtCommit).toStrictEqual(
          first.membershipAtCommit
        );
        expect(noOpGrant.receiptRef).not.toBe(first.receiptRef);
        expect(
          yield* sql`SELECT version::text FROM authority.domains WHERE domain_key = 'membership'`
        ).toStrictEqual([{ version: "1" }]);
        const revoke = yield* Schema.decodeEffect(RevokeWorldReadAccess)({
          ...grant,
          input: { ...grant.input, expectedRevision: "0" },
          operation: "RevokeWorldReadAccess",
          operationId: randomUUID(),
        });
        const revoked = yield* revokeWorldReadAccess(context, revoke);
        expect(revoked.membershipAtCommit).toMatchObject({
          revision: "1",
          role: "viewer",
          state: "revoked",
        });
        expect(yield* grantWorldReadAccess(context, grant)).toStrictEqual(
          first
        );
        expect(
          (yield* inspectWorldAccess(context, accessRequest)).membership
        ).toStrictEqual(revoked.membershipAtCommit);
        const revokeAgain = yield* Schema.decodeEffect(RevokeWorldReadAccess)({
          ...revoke,
          input: { ...revoke.input, expectedRevision: "1" },
          operationId: randomUUID(),
        });
        expect(
          (yield* revokeWorldReadAccess(context, revokeAgain))
            .membershipAtCommit
        ).toStrictEqual(revoked.membershipAtCommit);
        expect(
          yield* sql`SELECT version::text FROM authority.domains WHERE domain_key = 'membership'`
        ).toStrictEqual([{ version: "2" }]);
        const staleGrant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          ...grant,
          input: { ...grant.input, expectedRevision: "0" },
          operationId: randomUUID(),
        });
        expect(
          yield* grantWorldReadAccess(context, staleGrant).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Stale" });
        const regrant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          ...staleGrant,
          input: { ...staleGrant.input, expectedRevision: "1" },
          operationId: randomUUID(),
        });
        const activeAgain = yield* grantWorldReadAccess(context, regrant);
        expect(activeAgain.membershipAtCommit).toMatchObject({
          revision: "2",
          state: "active",
        });
        expect(
          yield* revokeWorldReadAccess(context, {
            ...revoke,
            operationId: yield* Schema.decodeEffect(
              RevokeWorldReadAccess.fields.operationId
            )(randomUUID()),
          }).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Stale" });
        expect(
          yield* sql`SELECT domain_key, version::text FROM authority.domains ORDER BY domain_key`
        ).toStrictEqual([
          { domain_key: "cases", version: "0" },
          { domain_key: "claims", version: "0" },
          { domain_key: "evidence", version: "0" },
          { domain_key: "identity", version: "0" },
          { domain_key: "membership", version: "3" },
          { domain_key: "sources", version: "0" },
        ]);
        const ownerTarget = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          ...grant,
          input: { ...grant.input, principalRef: owner.user.id },
          operationId: randomUUID(),
        });
        expect(
          yield* grantWorldReadAccess(context, ownerTarget).pipe(Effect.flip)
        ).toMatchObject({ _tag: "InvalidInput" });
        expect(
          yield* grantWorldReadAccess(context, {
            ...ownerTarget,
            operationId: grant.operationId,
          }).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Conflict" });
        const absentRevoke = yield* Schema.decodeEffect(RevokeWorldReadAccess)({
          ...revoke,
          input: { expectedRevision: "0", principalRef: third.user.id },
          operationId: randomUUID(),
        });
        expect(
          yield* revokeWorldReadAccess(context, absentRevoke).pipe(Effect.flip)
        ).toMatchObject({ _tag: "NotFoundOrDenied" });
        const nonexistent = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          ...grant,
          input: { ...grant.input, principalRef: randomUUID() },
          operationId: randomUUID(),
        });
        expect(
          yield* grantWorldReadAccess(context, nonexistent).pipe(Effect.flip)
        ).toMatchObject({ _tag: "NotFoundOrDenied" });
        // A real identity SQL failure distinguishes a skipped replay lookup from an accidental second query.
        yield* SqlClient.SqlClient.use(
          (migration) =>
            migration`REVOKE SELECT ON identity."user" FROM ${migration(fixture.database.names.identity)}`
        ).pipe(Effect.provide(fixture.database.migration));
        yield* Effect.gen(function* unavailableDirectory() {
          expect(yield* grantWorldReadAccess(context, grant)).toStrictEqual(
            first
          );
          const newGrant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
            ...regrant,
            input: { ...regrant.input, expectedRevision: "2" },
            operationId: randomUUID(),
          });
          expect(
            yield* grantWorldReadAccess(context, newGrant).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Unavailable" });
        }).pipe(
          Effect.ensuring(
            SqlClient.SqlClient.use(
              (migration) =>
                migration`GRANT SELECT ON identity."user" TO ${migration(fixture.database.names.identity)}`
            ).pipe(Effect.provide(fixture.database.migration), Effect.orDie)
          )
        );
        expect(
          yield* sql`SELECT count(*)::int AS memberships FROM authority.memberships`
        ).toStrictEqual([{ memberships: 2 }]);
        expect(
          yield* sql`SELECT (SELECT count(*)::int FROM authority.operations) AS operations, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
        ).toStrictEqual([{ operations: 5, outbox: 6, receipts: 6 }]);
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
);

it.live(
  "SH-04 distinct concurrent grants protect absence with one winner and a stale loser",
  () =>
    withSharingDatabase((fixture) =>
      Effect.gen(function* concurrentAbsence() {
        const owner = yield* createAccount(fixture.config.baseUrl);
        const viewer = yield* createAccount(fixture.config.baseUrl);
        const context = yield* verifiedContext(owner.credential);
        const { worldRef } = yield* createPersonalWorld(
          context,
          yield* genesisRequest
        );
        const requests = yield* Effect.forEach(
          [randomUUID(), randomUUID()],
          (operationId) =>
            Schema.decodeEffect(GrantWorldReadAccess)({
              ...envelope,
              input: { expectedRevision: null, principalRef: viewer.user.id },
              operation: "GrantWorldReadAccess",
              operationId,
              worldRef,
            })
        );
        const results = yield* Effect.forEach(
          requests,
          (request) =>
            grantWorldReadAccess(context, request).pipe(
              Effect.match({
                onFailure: (error) => error._tag,
                onSuccess: (result) => result._tag,
              })
            ),
          { concurrency: 2 }
        );
        expect(results.toSorted()).toStrictEqual([
          "Stale",
          "WorldReadAccessGranted",
        ]);
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`SELECT role, state, revision::text FROM authority.memberships WHERE principal_id = ${viewer.user.id}`
        ).toStrictEqual([{ revision: "0", role: "viewer", state: "active" }]);
        expect(
          yield* sql`SELECT count(*)::int AS grants FROM authority.receipts WHERE operation = 'GrantWorldReadAccess'`
        ).toStrictEqual([{ grants: 1 }]);
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
);
