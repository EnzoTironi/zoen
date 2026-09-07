import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import {
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Deferred, Effect, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/worlds/database.ts";
import {
  createAccount,
  postAuth,
} from "../../../../apps/server/test/identity/worlds/http.ts";
import { configuration } from "../commit/fixture.ts";

const encode = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

it.live(
  "independent EX08/EX09 deny retained frame, evidence and import replay after membership revocation, including an in-flight read",
  () =>
    withD01IdentityDatabase((fixture) =>
      withStorage(() =>
        Effect.scoped(
          Effect.gen(function* disclosureReview() {
            const executor = yield* SemanticExecutor;
            const account = yield* createAccount(fixture.config.baseUrl);
            const other = yield* createAccount(fixture.config.baseUrl);
            const envelope = {
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            };
            const created = yield* executor
              .execute(
                account.credential,
                yield* encode({
                  ...envelope,
                  input: {},
                  operation: "CreatePersonalWorld",
                  operationId: randomUUID(),
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
            const document = yield* canonicalJson({
              records: [
                {
                  externalId: "record",
                  predicate: "obligation.amount",
                  subjectKey: "private-obligation",
                  validTime: { _tag: "Unknown" },
                  value: { _tag: "Known", amount: "123", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "private-source",
                label: "Private source",
                namespace: "review",
                revision: "1",
              },
            });
            const importedInput = yield* encode({
              ...envelope,
              input: { document },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            });
            const imported = yield* executor
              .execute(account.credential, importedInput)
              .pipe(
                Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
              );
            const inspectInput = {
              ...envelope,
              input: { atFrame: null, subjectKey: "private-obligation" },
              operation: "Inspect",
              worldRef: created.worldRef,
            };
            const inspected = yield* executor
              .execute(account.credential, yield* encode(inspectInput))
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
            const historicalBytes = yield* encode({
              ...inspectInput,
              input: {
                ...inspectInput.input,
                atFrame: inspected.frame.frameRef,
              },
            });
            const openBytes = yield* encode({
              ...envelope,
              input: { evidenceRef: imported.evidenceRef },
              operation: "OpenEvidence",
              worldRef: created.worldRef,
            });
            const sql = yield* SqlClient.SqlClient;
            for (const bytes of [historicalBytes, openBytes, importedInput]) {
              expect(
                yield* executor
                  .execute(other.credential, bytes)
                  .pipe(Effect.flip)
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            expect(
              yield* sql`SELECT count(*)::int AS memberships FROM authority.memberships WHERE principal_id = ${other.user.id}`
            ).toStrictEqual([{ memberships: 0 }]);
            const held = yield* Deferred.make<null>();
            const release = yield* Deferred.make<null>();
            const holder = yield* Effect.forkScoped(
              Effect.gen(function* holdFrameWrite() {
                const migration = yield* SqlClient.SqlClient;
                yield* migration.withTransaction(
                  Effect.gen(function* lockFrames() {
                    yield* migration`LOCK TABLE authority.frames IN SHARE MODE`;
                    yield* Deferred.succeed(held, null);
                    yield* Deferred.await(release);
                  })
                );
              }).pipe(Effect.provide(fixture.database.migration))
            );
            yield* Deferred.await(held);
            const queryBytes = yield* encode(inspectInput);
            const pending = yield* Effect.forkScoped(
              executor
                .execute(account.credential, queryBytes)
                .pipe(Effect.result)
            );
            let waiting = false;
            for (let attempt = 0; attempt < 80 && !waiting; attempt += 1) {
              const rows =
                yield* sql`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE relation = 'authority.frames'::regclass AND NOT granted) AS waiting`;
              waiting = rows[0]?.waiting === true;
              if (!waiting) {
                yield* Effect.sleep("25 millis");
              }
            }
            expect(waiting).toBeTruthy();
            yield* sql`UPDATE authority.memberships SET state = 'revoked', revision = revision + 1 WHERE world_id = ${created.worldRef.worldId} AND principal_id = ${account.user.id}`;
            yield* Deferred.succeed(release, null);
            yield* Fiber.join(holder);
            expect(yield* Fiber.join(pending)).toMatchObject({
              _tag: "Failure",
              failure: { _tag: "NotFoundOrDenied" },
            });
            for (const bytes of [historicalBytes, openBytes, importedInput]) {
              expect(
                yield* executor
                  .execute(account.credential, bytes)
                  .pipe(Effect.flip)
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            expect(
              yield* sql`SELECT (SELECT count(*)::int FROM authority.evidence) AS evidence, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.captures) AS captures`
            ).toStrictEqual([{ captures: 1, evidence: 1, receipts: 2 }]);
            yield* postAuth(
              fixture.config.baseUrl,
              "sign-out",
              {},
              account.credential
            );
            expect(
              yield* executor
                .execute(account.credential, historicalBytes)
                .pipe(Effect.flip)
            ).toMatchObject({
              _tag: "Unauthenticated",
              code: "PRESENCE_REQUIRED",
            });
          })
        ).pipe(
          Effect.provide(
            SemanticExecutor.layer.pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  configuration,
                  fixture.database.authority,
                  fixture.runtime
                )
              )
            )
          )
        )
      )
    )
);
