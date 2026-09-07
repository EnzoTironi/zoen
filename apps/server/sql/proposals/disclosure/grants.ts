import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Operational coordination remains owned by the authority runtime role. */
export const grantDisclosureRole = Effect.fn("grantDisclosureRole")(
  function* grantDisclosureRole(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT SELECT, INSERT ON jobs.disclosure_subjects TO ${sql(authorityRole)}`;
    yield* sql`GRANT UPDATE (revision) ON jobs.disclosure_subjects TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, DELETE ON jobs.disclosure_pending TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT ON jobs.disclosure_session_closing TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON jobs.disclosure_writer_epochs TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT ON jobs.disclosure_recovery TO ${sql(authorityRole)}`;
  }
);
