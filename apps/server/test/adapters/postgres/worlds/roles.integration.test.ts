import { randomUUID } from "node:crypto";

import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeD01PostgresLayer } from "../../../../src/adapters/postgres/worlds/postgres.ts";
import { withD01Database } from "./database.ts";
import { claimRow, seedEvidence } from "./seed.ts";

for (const misconfiguration of ["public-create", "replication"] as const) {
  it.live(`D01 runtime admission rejects ${misconfiguration} credentials`, () =>
    withD01Database(
      (database) =>
        Effect.gen(function* rejectMisconfiguration() {
          const failure = yield* Effect.void.pipe(
            Effect.provide(database.authority),
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "UnsafePostgresRole",
            code: "runtime_role_is_privileged",
          });
        }),
      misconfiguration
    )
  );
}

it.live(
  "D01 identity and progress cannot mint domain authority; progress updates only its granted columns",
  () =>
    withD01Database((database) =>
      Effect.gen(function* roles() {
        const seed = yield* Effect.gen(function* prepare() {
          const sql = yield* SqlClient.SqlClient;
          const seeded = yield* seedEvidence();
          yield* sql`INSERT INTO authority.claims ${sql.insert(claimRow(seeded))}`;
          yield* sql`INSERT INTO jobs.outbox ${sql.insert({
            event_kind: "receipt",
            fence: "0",
            lease_owner: null,
            lease_until: null,
            outbox_id: randomUUID(),
            payload_ref: seeded.receipt,
            realm: seeded.realm,
            receipt_id: seeded.receipt,
            state: "pending",
            world_id: seeded.worldId,
          })}`;
          for (const query of [
            sql`UPDATE authority.receipts SET operation = 'forged'`,
            sql`UPDATE authority.claims SET amount = 99`,
            sql`DELETE FROM authority.claims`,
          ]) {
            expect(yield* query.pipe(Effect.flip)).toMatchObject({
              _tag: "SqlError",
              reason: { _tag: "AuthorizationError" },
            });
          }
          return seeded;
        }).pipe(Effect.provide(database.authority));
        for (const layer of [database.identity, database.progress]) {
          yield* Effect.gen(function* deniedAuthority() {
            const sql = yield* SqlClient.SqlClient;
            for (const query of [
              sql`SELECT * FROM authority.worlds`,
              sql`UPDATE authority.memberships SET state = 'active'`,
              sql`INSERT INTO authority.sources ${sql.insert({ external_id: "forged", label: "forged", namespace: "forged", realm: seed.realm, source_id: randomUUID(), world_id: seed.worldId })}`,
              sql`CREATE SCHEMA forged`,
              sql`CREATE TEMP TABLE forged(id uuid)`,
            ]) {
              expect(yield* query.pipe(Effect.flip)).toMatchObject({
                _tag: "SqlError",
                reason: { _tag: "AuthorizationError" },
              });
            }
          }).pipe(Effect.provide(layer));
        }
        yield* Effect.gen(function* progress() {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`UPDATE jobs.outbox SET state = 'leased', fence = fence + 1, lease_owner = ${randomUUID()}, lease_until = '2026-09-05T01:00:00.000Z'`;
          yield* sql`UPDATE jobs.captures SET state = 'cleanup_pending', fence = fence + 1`;
          for (const query of [
            sql`UPDATE jobs.outbox SET payload_ref = ${randomUUID()}`,
            sql`UPDATE jobs.captures SET principal_id = ${randomUUID()}`,
            sql`UPDATE jobs.captures SET world_id = ${randomUUID()}`,
            sql`UPDATE jobs.captures SET expected_digest = ${"b".repeat(64)}`,
          ]) {
            expect(yield* query.pipe(Effect.flip)).toMatchObject({
              _tag: "SqlError",
              reason: { _tag: "AuthorizationError" },
            });
          }
          expect(
            yield* sql`SELECT state, fence FROM jobs.outbox`
          ).toStrictEqual([{ fence: "1", state: "leased" }]);
          expect(
            yield* sql`SELECT state, expected_digest FROM jobs.captures`
          ).toStrictEqual([
            { expected_digest: "a".repeat(64), state: "cleanup_pending" },
          ]);
        }).pipe(Effect.provide(database.progress));
      })
    )
);

it.live("D01 runtime admission rejects the real migration owner", () =>
  withD01Database((database) =>
    Effect.gen(function* rejectOwner() {
      const client = yield* PgClient.PgClient;
      if (client.config.url === undefined) {
        throw new Error("fixture must configure a URL");
      }
      const rejected = yield* Effect.void.pipe(
        Effect.provide(
          makeD01PostgresLayer({
            applicationName: "ex06-reject-owner",
            maxConnections: 1,
            url: client.config.url,
          })
        ),
        Effect.flip
      );
      expect(rejected).toMatchObject({
        _tag: "UnsafePostgresRole",
        code: "runtime_role_is_privileged",
      });
    }).pipe(Effect.provide(database.migration))
  )
);
