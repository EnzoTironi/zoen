import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export interface D01DatabaseRoles {
  readonly authority: string;
  readonly identity: string;
  readonly progress: string;
}

/** Called by the migration owner only; names come from deployment configuration. */
export const grantD01Roles = Effect.fn("grantD01Roles")(function* grantRoles(
  roles: D01DatabaseRoles
) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`GRANT USAGE ON SCHEMA authority, jobs TO ${sql(roles.authority)}`;
  yield* sql`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA authority TO ${sql(roles.authority)}`;
  yield* sql`GRANT UPDATE ON authority.worlds, authority.memberships, authority.domains TO ${sql(roles.authority)}`;
  yield* sql`GRANT UPDATE (label) ON authority.sources TO ${sql(roles.authority)}`;
  yield* sql`GRANT UPDATE (state) ON authority.evidence, authority.cases TO ${sql(roles.authority)}`;
  yield* sql`GRANT SELECT, INSERT ON jobs.captures, jobs.outbox TO ${sql(roles.authority)}`;
  yield* sql`GRANT UPDATE (state, object_location, fence) ON jobs.captures TO ${sql(roles.authority)}`;
  yield* sql`GRANT USAGE ON SCHEMA identity TO ${sql(roles.identity)}`;
  yield* sql`GRANT USAGE ON SCHEMA jobs TO ${sql(roles.progress)}`;
  yield* sql`GRANT SELECT ON jobs.captures, jobs.outbox TO ${sql(roles.progress)}`;
  yield* sql`GRANT UPDATE (state, fence, lease_owner, lease_until) ON jobs.outbox TO ${sql(roles.progress)}`;
  yield* sql`GRANT UPDATE (state, object_location, fence) ON jobs.captures TO ${sql(roles.progress)}`;
});
