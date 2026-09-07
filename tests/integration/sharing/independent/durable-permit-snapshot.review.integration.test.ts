import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { expect, it } from "@effect/vitest";
import { Cause, Config, Effect, Exit, Redacted, Schema } from "effect";
import type * as Pg from "pg";

const require = createRequire(
  new URL("../../../../apps/server/package.json", import.meta.url)
);
// The server workspace owns the installed pg dependency; Node require is untyped.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const { Client } = require("pg") as typeof Pg;
const query = (client: Pg.Client, text: string, values?: string[]) =>
  Effect.tryPromise(() => client.query<Record<string, unknown>>(text, values));
const connect = (connectionString: string) =>
  Effect.acquireRelease(
    Effect.gen(function* openConnection() {
      const client = new Client({ connectionString });
      yield* Effect.tryPromise(() => client.connect());
      return client;
    }),
    (client) => Effect.promise(() => client.end())
  );
const state = (client: Pg.Client) =>
  query(client, "SELECT state FROM membership").pipe(
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(
        Schema.Array(Schema.Struct({ state: Schema.String }))
      )(result.rows)
    ),
    Effect.map((rows) => rows[0]?.state)
  );
const pending = (client: Pg.Client) =>
  query(client, "SELECT count(*) AS n FROM permits").pipe(
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(
        Schema.Array(Schema.Struct({ n: Schema.String }))
      )(result.rows)
    ),
    Effect.map((rows) => Number(rows[0]?.n))
  );

// Real PostgreSQL protocol experiment. This does not prove HTTP/provider acceptance.
it.live.each(["unsafe", "existing-subject", "absent-subject"] as const)(
  "durable permit snapshot review: %s",
  (mode) =>
    Effect.scoped(
      Effect.gen(function* reviewSnapshot() {
        const connectionString = Redacted.value(
          yield* Config.redacted("ZOEN_TEST_DATABASE_URL")
        );
        const schema = `review_${randomUUID().replaceAll("-", "")}`;
        const observer = yield* connect(connectionString);
        const reader = yield* connect(connectionString);
        const revoker = yield* connect(connectionString);
        yield* query(observer, `CREATE SCHEMA ${schema}`);
        yield* Effect.addFinalizer(() =>
          Effect.gen(function* cleanupSchema() {
            yield* query(revoker, "ROLLBACK");
            yield* query(observer, `DROP SCHEMA ${schema} CASCADE`);
          }).pipe(Effect.orDie)
        );
        for (const client of [observer, reader, revoker]) {
          yield* query(client, `SET search_path TO ${schema}`);
          yield* query(client, "SET statement_timeout TO '5s'");
        }
        yield* query(
          observer,
          "CREATE TABLE membership (state text NOT NULL); INSERT INTO membership VALUES ('active')"
        );
        yield* query(observer, "CREATE TABLE permits (id text PRIMARY KEY)");
        yield* query(
          observer,
          "CREATE TABLE subjects (key text PRIMARY KEY, revision bigint NOT NULL)"
        );
        if (mode === "existing-subject") {
          yield* query(
            observer,
            "INSERT INTO subjects VALUES ('membership', 0)"
          );
        }
        const bump =
          "INSERT INTO subjects VALUES ('membership', 1) ON CONFLICT (key) DO UPDATE SET revision = subjects.revision + 1";
        yield* query(revoker, "BEGIN ISOLATION LEVEL SERIALIZABLE");
        expect(yield* state(revoker)).toBe("active");
        yield* query(
          reader,
          "SELECT pg_advisory_lock_shared(hashtextextended($1, 0))",
          [schema]
        );
        yield* query(reader, "BEGIN");
        if (mode !== "unsafe") {
          yield* query(reader, bump);
        }
        yield* query(reader, "INSERT INTO permits VALUES ('pending-emission')");
        yield* query(reader, "COMMIT");
        // Physical connection closure releases the session lock; durable data remains.
        yield* Effect.tryPromise(() => reader.end());
        yield* query(
          revoker,
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [schema]
        );
        if (mode === "unsafe") {
          expect(yield* pending(revoker)).toBe(0);
          yield* query(revoker, "UPDATE membership SET state = 'revoked'");
          yield* query(revoker, "COMMIT");
          expect(yield* pending(observer)).toBe(1);
          expect(yield* state(observer)).toBe("revoked");
        } else {
          const result = yield* Effect.exit(query(revoker, bump));
          expect(Exit.isFailure(result)).toBeTruthy();
          if (Exit.isFailure(result)) {
            const errors = result.cause.reasons.filter(Cause.isFailReason);
            expect(errors).toHaveLength(1);
            const databaseError = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ code: Schema.String })
            )(errors[0]?.error.cause);
            expect(databaseError.code).toBe("40001");
          }
          yield* query(revoker, "ROLLBACK");
          yield* query(revoker, "BEGIN ISOLATION LEVEL SERIALIZABLE");
          yield* query(
            revoker,
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [schema]
          );
          yield* query(revoker, bump);
          expect(yield* pending(revoker)).toBe(1);
          // Pending emission requires refusal and rollback by the semantic executor.
          yield* query(revoker, "ROLLBACK");
          expect(yield* state(observer)).toBe("active");
          expect(yield* pending(observer)).toBe(1);
        }
      })
    ),
  20_000
);
