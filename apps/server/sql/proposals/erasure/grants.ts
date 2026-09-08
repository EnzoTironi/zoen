import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Called by the migration owner only after erasure DDL exists. */
export const grantErasureRole = Effect.fn("grantErasureRole")(
  function* grantErasureRole(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`GRANT USAGE ON SCHEMA erasure_attempt TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON authority.world_erasure_progress, authority.world_erasure_receipts TO ${sql(authorityRole)}`;
    yield* sql`GRANT SELECT, INSERT, UPDATE ON authority.controlled_copy_coverage, authority.controlled_copy_entries TO ${sql(authorityRole)}`;
    const role = authorityRole.replaceAll('"', "");
    yield* sql.unsafe(
      `GRANT DELETE ON authority.frames, authority.cases, authority.corrections,
        authority.claims, authority.pins, authority.evidence, authority.sources,
        authority.receipts, authority.operations, authority.bootstrap_operations,
        authority.memberships, authority.identity_decisions TO "${role}";
       GRANT DELETE ON jobs.captures, jobs.outbox TO "${role}";
       GRANT SELECT, INSERT, UPDATE ON jobs.object_write_attempts TO "${role}"`
    );
  }
);

/** Admit grants for ZA-09/ZA-10 capture barrier + object-write ledger on retained installs (F02). */
export const grantContentBarrierAdmit = Effect.fn("grantContentBarrierAdmit")(
  function* grantContentBarrierAdmit(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    const role = authorityRole.replaceAll('"', "");
    // FOR SHARE / progress reads + object-write admission; keep aligned with grantErasureRole.
    yield* sql.unsafe(
      `GRANT USAGE ON SCHEMA erasure_attempt TO "${role}";
       GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO "${role}";
       GRANT SELECT, INSERT, UPDATE ON authority.world_erasure_progress, authority.world_erasure_receipts TO "${role}";
       GRANT SELECT, INSERT, UPDATE ON jobs.object_write_attempts TO "${role}"`
    );
  }
);
