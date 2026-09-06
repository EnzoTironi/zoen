import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Called by the migration owner only after erasure DDL exists. */
export const grantErasureRole = Effect.fn("grantErasureRole")(
  function* grantErasureRole(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT USAGE ON SCHEMA erasure_attempt TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON authority.world_erasure_progress, authority.world_erasure_receipts TO ${sql(authorityRole)}`;
  }
);
