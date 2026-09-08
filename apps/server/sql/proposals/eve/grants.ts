import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * Migration-owner only. Journal role may touch eve.* and nothing in
 * authority/identity/jobs — operational journal is not Ontology truth (INV-01).
 */
export const grantEveJournalRole = Effect.fn("grantEveJournalRole")(
  function* grantEveJournalRole(journalRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT USAGE ON SCHEMA eve TO ${sql(journalRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA eve TO ${sql(journalRole)}`;
  }
);
