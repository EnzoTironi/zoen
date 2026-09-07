import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  Cause,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Schema,
  Schedule,
  Tracer,
} from "effect";
import { SqlClient, SqlError } from "effect/unstable/sql";

import { createAccount } from "../../../../apps/server/test/identity/worlds/http.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../../packages/authority/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
} from "../../../../packages/authority/src/ports/disclosure/keys.js";
import type { VerifiedRequestContext } from "../../../../packages/authority/src/ports/worlds/context.js";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
} from "../../../../packages/contracts/src/sharing/operations.js";
import { configuration } from "../../worlds/commit/fixture.js";
import {
  genesisRequest,
  verifiedContext,
  withSharingDatabase,
} from "./fixture.js";

const executeMutation = Effect.fn("SH.executeMutation")(
  function* executeMutation(
    context: VerifiedRequestContext,
    request:
      | typeof GrantWorldReadAccess.Type
      | typeof RevokeWorldReadAccess.Type
  ) {
    if (request.operation === "GrantWorldReadAccess") {
      return yield* grantWorldReadAccess(context, request);
    }
    return yield* revokeWorldReadAccess(context, request);
  }
);

// Operational barrier data, not a fabricated provider or proof of an HTTP emission.
const registerPending = Effect.fn("SH.registerPending")(
  function* registerPending(
    sessionKey: string,
    membershipKey: string,
    permitId: string
  ) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.withTransaction(
      Effect.gen(function* registerAtomically() {
        for (const key of [sessionKey, membershipKey]) {
          yield* sql`INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${key}, 0)
        ON CONFLICT (subject_key) DO UPDATE SET revision = jobs.disclosure_subjects.revision + 1`;
        }
        yield* sql`INSERT INTO jobs.disclosure_pending (permit_id, session_key, membership_key) VALUES (${permitId}, ${sessionKey}, ${membershipKey})`;
      })
    );
  }
);

it.live.each(["grant", "grant-no-op", "revoke", "revoke-no-op"] as const)(
  "SH durable pending blocks %s atomically, exact ACK allows retry, and registered replay bypasses new mutation",
  (mode) =>
    withSharingDatabase((fixture) =>
      Effect.gen(function* durableGuard() {
        const owner = yield* createAccount(fixture.config.baseUrl);
        const recipient = yield* createAccount(fixture.config.baseUrl);
        const context = yield* verifiedContext(owner.credential);
        const recipientContext = yield* verifiedContext(recipient.credential);
        const { worldRef } = yield* createPersonalWorld(
          context,
          yield* genesisRequest
        );
        const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
          input: { expectedRevision: null, principalRef: recipient.user.id },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "sharing.v1",
          worldRef,
        });
        if (mode !== "grant") {
          yield* grantWorldReadAccess(context, grant);
        }
        const revoke = yield* Schema.decodeEffect(RevokeWorldReadAccess)({
          ...grant,
          input: { ...grant.input, expectedRevision: "0" },
          operation: "RevokeWorldReadAccess",
          operationId: randomUUID(),
        });
        if (mode === "revoke-no-op") {
          yield* revokeWorldReadAccess(context, revoke);
        }
        const request =
          mode === "grant" || mode === "grant-no-op"
            ? yield* Schema.decodeEffect(GrantWorldReadAccess)({
                ...grant,
                input: {
                  ...grant.input,
                  expectedRevision: mode === "grant" ? null : "0",
                },
                operationId: randomUUID(),
              })
            : yield* Schema.decodeEffect(RevokeWorldReadAccess)({
                ...revoke,
                input: {
                  ...revoke.input,
                  expectedRevision: mode === "revoke" ? "0" : "1",
                },
                operationId: randomUUID(),
              });
        const membershipKey = membershipDisclosureKey(
          worldRef,
          recipientContext.presence.principalId
        );
        const sessionKey = sessionDisclosureKey(recipientContext.presence);
        const permitId = randomUUID();
        yield* registerPending(sessionKey, membershipKey, permitId);
        const sql = yield* SqlClient.SqlClient;
        const snapshot = sql`SELECT
      (SELECT jsonb_agg(jsonb_build_object('principal', principal_id, 'role', role, 'state', state, 'revision', revision::text) ORDER BY principal_id) FROM authority.memberships) AS memberships,
      (SELECT jsonb_object_agg(domain_key, version::text) FROM authority.domains) AS domains,
      (SELECT count(*)::int FROM authority.operations) AS operations,
      (SELECT count(*)::int FROM authority.receipts) AS receipts,
      (SELECT count(*)::int FROM jobs.outbox) AS outbox,
      (SELECT jsonb_object_agg(subject_key, revision::text) FROM jobs.disclosure_subjects) AS subjects,
      (SELECT count(*)::int FROM jobs.disclosure_pending WHERE permit_id = ${permitId}) AS pending`;
        const baseline = yield* snapshot;
        expect(
          yield* executeMutation(context, request).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        expect(yield* snapshot).toStrictEqual(baseline);
        yield* sql`DELETE FROM jobs.disclosure_pending WHERE permit_id = ${permitId}`;
        const committed = yield* executeMutation(context, request);
        expect(committed.membershipAtCommit).toMatchObject({
          role: "viewer",
          state: mode.startsWith("grant") ? "active" : "revoked",
        });
        yield* registerPending(sessionKey, membershipKey, permitId);
        const beforeReplay = yield* snapshot;
        expect(yield* executeMutation(context, request)).toStrictEqual(
          committed
        );
        expect(yield* snapshot).toStrictEqual(beforeReplay);
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

it.live.each(["existing", "absent"] as const)(
  "SH core mutation restarts its stale SERIALIZABLE snapshot on a concurrently committed %s subject and refuses the pending emission",
  (mode) =>
    withSharingDatabase((fixture) =>
      Effect.scoped(
        Effect.gen(function* staleCoreSnapshot() {
          const owner = yield* createAccount(fixture.config.baseUrl);
          const recipient = yield* createAccount(fixture.config.baseUrl);
          const context = yield* verifiedContext(owner.credential);
          const recipientContext = yield* verifiedContext(recipient.credential);
          const { worldRef } = yield* createPersonalWorld(
            context,
            yield* genesisRequest
          );
          const request = yield* Schema.decodeEffect(GrantWorldReadAccess)({
            input: { expectedRevision: null, principalRef: recipient.user.id },
            operation: "GrantWorldReadAccess",
            operationId: randomUUID(),
            purpose: "personal-records",
            schemaVersion: "sharing.v1",
            worldRef,
          });
          const membershipKey = membershipDisclosureKey(
            worldRef,
            recipientContext.presence.principalId
          );
          const sessionKey = sessionDisclosureKey(recipientContext.presence);
          const permitId = randomUUID();
          const sql = yield* SqlClient.SqlClient;
          if (mode === "existing") {
            yield* sql`INSERT INTO jobs.disclosure_subjects (subject_key, revision) VALUES (${membershipKey}, 0)`;
          }
          const snapshot = sql`SELECT
      (SELECT count(*)::int FROM authority.memberships) AS memberships,
      (SELECT version::text FROM authority.domains WHERE domain_key = 'membership') AS revision,
      (SELECT count(*)::int FROM authority.operations) AS operations,
      (SELECT count(*)::int FROM authority.receipts) AS receipts,
      (SELECT count(*)::int FROM jobs.outbox) AS outbox`;
          const baseline = yield* snapshot;
          expect(baseline).toStrictEqual([
            {
              memberships: 1,
              operations: 0,
              outbox: 1,
              receipts: 1,
              revision: "0",
            },
          ]);
          const held = yield* Deferred.make<boolean>();
          const publish = yield* Deferred.make<boolean>();
          const reader = yield* sql
            .withTransaction(
              Effect.gen(function* publishAfterOldSnapshot() {
                yield* sql`SELECT pg_advisory_xact_lock_shared(hashtextextended(${sessionKey}, 0))`;
                yield* sql`SELECT pg_advisory_xact_lock_shared(hashtextextended(${membershipKey}, 0))`;
                yield* Deferred.succeed(held, true);
                yield* Deferred.await(publish);
                yield* registerPending(sessionKey, membershipKey, permitId);
              })
            )
            .pipe(Effect.forkScoped);
          yield* Deferred.await(held);
          // Native spans observe the actual driver failure; no query, result or retry is replaced.
          const spans: Tracer.NativeSpan[] = [];
          const tracer = Tracer.make({
            span: (options) => {
              const span = new Tracer.NativeSpan(options);
              spans.push(span);
              return span;
            },
          });
          const mutation = yield* grantWorldReadAccess(context, request).pipe(
            Effect.withTracer(tracer),
            Effect.withTracerEnabled(true),
            Effect.result,
            Effect.forkScoped
          );
          yield* sql`SELECT count(*)::int AS waiting FROM pg_locks WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND locktype = 'advisory' AND NOT granted`.pipe(
            Effect.map((rows) => rows[0]?.waiting === 1),
            Effect.repeat({
              schedule: Schedule.spaced("20 millis"),
              until: (waiting) => waiting,
            }),
            Effect.timeout("8 seconds")
          );
          yield* Deferred.succeed(publish, true);
          yield* Fiber.join(reader);
          expect(yield* Fiber.join(mutation)).toMatchObject({
            _tag: "Failure",
            failure: { _tag: "Unavailable" },
          });
          const serializationErrors = spans
            .filter((span) => span.name === "sql.execute")
            .flatMap((span) =>
              span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
                ? span.status.exit.cause.reasons
                : []
            )
            .filter(Cause.isFailReason)
            .map((reason) => reason.error)
            .filter(SqlError.isSqlError)
            .filter((error) => error.reason._tag === "SerializationError");
          expect(
            serializationErrors.map((error) => error.reason)
          ).toMatchObject([
            { _tag: "SerializationError", cause: { code: "40001" } },
          ]);
          expect(yield* snapshot).toStrictEqual(baseline);
          expect(
            yield* sql`SELECT revision::text FROM jobs.disclosure_subjects WHERE subject_key = ${membershipKey}`
          ).toStrictEqual([{ revision: mode === "existing" ? "1" : "0" }]);
          expect(
            yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending WHERE permit_id = ${permitId}`
          ).toStrictEqual([{ pending: 1 }]);
          yield* sql`DELETE FROM jobs.disclosure_pending WHERE permit_id = ${permitId}`;
          const accepted = yield* grantWorldReadAccess(context, request);
          expect(accepted.membershipAtCommit).toMatchObject({
            revision: "0",
            role: "viewer",
            state: "active",
          });
          expect(yield* snapshot).toStrictEqual([
            {
              memberships: 2,
              operations: 1,
              outbox: 2,
              receipts: 2,
              revision: "1",
            },
          ]);
        })
      ).pipe(
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
