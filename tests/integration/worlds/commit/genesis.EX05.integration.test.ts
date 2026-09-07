import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { configuration, makeInput } from "./fixture.js";

it.live(
  "EX05 concurrent genesis commits one world, receipt and outbox through the runtime role",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* concurrentGenesis() {
        const { context, request } = yield* makeInput();
        const [first, second] = yield* Effect.all(
          [
            createPersonalWorld(context, request),
            createPersonalWorld(context, request),
          ],
          { concurrency: 2 }
        );
        expect(first).toStrictEqual(second);
        const sql = yield* SqlClient.SqlClient;
        const rows = yield* sql`
      SELECT
        (SELECT count(*)::int FROM authority.worlds) AS worlds,
        (SELECT count(*)::int FROM authority.memberships) AS memberships,
        (SELECT count(*)::int FROM authority.domains) AS domains,
        (SELECT count(*)::int FROM authority.receipts) AS receipts,
        (SELECT count(*)::int FROM jobs.outbox) AS outbox,
        (SELECT count(*)::int FROM authority.bootstrap_operations) AS operations
    `;
        expect(rows).toStrictEqual([
          {
            domains: 6,
            memberships: 1,
            operations: 1,
            outbox: 1,
            receipts: 1,
            worlds: 1,
          },
        ]);
        expect(yield* createPersonalWorld(context, request)).toStrictEqual(
          first
        );
      }).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);

it.live(
  "EX05 a current revocation prevents genesis replay from disclosing its retained receipt",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* revokedReplay() {
        const { context, request } = yield* makeInput();
        const created = yield* createPersonalWorld(context, request);
        const sql = yield* SqlClient.SqlClient;
        yield* sql.withTransaction(
          Effect.gen(function* revokeFixtureMembership() {
            yield* sql`UPDATE authority.worlds SET security_revision = security_revision + 1 WHERE world_id = ${created.worldRef.worldId} AND realm = 'live'`;
            yield* sql`UPDATE authority.domains SET version = version + 1 WHERE world_id = ${created.worldRef.worldId} AND realm = 'live' AND domain_key = 'membership'`;
            yield* sql`UPDATE authority.memberships SET state = 'revoked', revision = revision + 1 WHERE world_id = ${created.worldRef.worldId} AND realm = 'live' AND principal_id = ${context.presence.principalId}`;
          })
        );
        const error = yield* createPersonalWorld(context, request).pipe(
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "NotFoundOrDenied",
          code: "NOT_FOUND_OR_DENIED",
        });
        expect(Object.keys(error).toSorted()).toStrictEqual(["_tag", "code"]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM authority.receipts`
        ).toStrictEqual([{ count: 1 }]);
      }).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);
