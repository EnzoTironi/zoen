import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Migration owner only; identity does not receive authority or jobs privileges. */
export const grantIdentityRole = Effect.fn("identity.grantRole")(
  function* grantRole(role: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT USAGE ON SCHEMA identity TO ${sql(role)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE, DELETE ON identity."user", identity."session", identity."account", identity."verification", identity."rateLimit" TO ${sql(role)}`;
  }
);
