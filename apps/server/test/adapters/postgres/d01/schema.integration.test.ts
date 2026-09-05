import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "./database.ts";

it.live(
  "D01 migrates the dedicated database and admits only restricted runtime",
  () =>
    withD01Database((database) =>
      Effect.gen(function* verifyMigration() {
        const sql = yield* SqlClient.SqlClient;
        const tables =
          yield* sql`SELECT tablename FROM pg_tables WHERE schemaname IN ('authority', 'jobs') ORDER BY tablename`;
        expect(tables).toStrictEqual(
          [
            "bootstrap_operations",
            "captures",
            "cases",
            "claims",
            "corrections",
            "domains",
            "evidence",
            "frames",
            "memberships",
            "operations",
            "outbox",
            "pins",
            "receipts",
            "sources",
            "worlds",
          ].map((tablename) => ({ tablename }))
        );
        const denied = yield* sql`CREATE TABLE public.forbidden(id uuid)`.pipe(
          Effect.flip
        );
        expect(denied).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "AuthorizationError" },
        });
        const temporary = yield* sql`CREATE TEMP TABLE forbidden(id uuid)`.pipe(
          Effect.flip
        );
        expect(temporary).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "AuthorizationError" },
        });
      }).pipe(Effect.provide(database.authority))
    )
);
