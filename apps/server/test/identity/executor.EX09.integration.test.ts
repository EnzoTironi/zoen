import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { canonicalJson } from "@zoen/ontology/values/canonical";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { configuration } from "../../../../tests/integration/worlds/commit/fixture.ts";
import { withStorage } from "../adapters/object-storage/worlds/fixture.ts";
import { withIdentityDatabase } from "./database.ts";
import { createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 real session governs genesis, replay, world access, revocation and logout through the executor",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* authenticatedExecution() {
          const executor = yield* SemanticExecutor;
          const account = yield* createAccount(fixture.config.baseUrl);
          const other = yield* createAccount(fixture.config.baseUrl);
          const request = new TextEncoder().encode(
            yield* canonicalJson({
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          const created = yield* executor
            .execute(account.credential, request)
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const replay = yield* executor.execute(account.credential, request);
          const inspect = new TextEncoder().encode(
            yield* canonicalJson({
              input: { atFrame: null, subjectKey: "invoice-1" },
              operation: "Inspect",
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
              worldRef: created.worldRef,
            })
          );
          const foreign = yield* executor
            .execute(other.credential, inspect)
            .pipe(Effect.flip);
          const sql = yield* SqlClient.SqlClient;
          yield* sql`UPDATE authority.memberships SET state = 'revoked' WHERE world_id = ${created.worldRef.worldId} AND principal_id = ${account.user.id}`;
          const revoked = yield* executor
            .execute(account.credential, inspect)
            .pipe(Effect.flip);
          yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
          );
          const loggedOut = yield* executor
            .execute(account.credential, request)
            .pipe(Effect.flip);
          expect(replay).toStrictEqual(created);
          expect({ foreign, loggedOut, revoked }).toMatchObject({
            foreign: { _tag: "NotFoundOrDenied" },
            loggedOut: { _tag: "Unauthenticated", code: "PRESENCE_REQUIRED" },
            revoked: { _tag: "NotFoundOrDenied" },
          });
          expect(
            yield* sql`SELECT count(*)::integer AS count FROM authority.worlds`
          ).toStrictEqual([{ count: 1 }]);
        }).pipe(
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
