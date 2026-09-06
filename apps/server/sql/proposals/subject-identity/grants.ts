import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Called by the migration owner only after identity decision DDL exists. */
export const grantSubjectIdentityRole = Effect.fn("grantSubjectIdentityRole")(
  function* grantSubjectIdentityRole(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT SELECT, INSERT ON authority.identity_decisions TO ${sql(authorityRole)}`;
  }
);
