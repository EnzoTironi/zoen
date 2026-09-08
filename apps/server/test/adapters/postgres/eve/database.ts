import { Effect } from "effect";

import { grantEveJournalMigrations } from "../../../../../../ops/migrations/run.ts";
import type { WorldsTestDatabase } from "../worlds/database.ts";

/** After applyErasureMigrations (includes 019), grant the restricted journal role. */
export const grantTestEveJournalRole = (database: WorldsTestDatabase) =>
  grantEveJournalMigrations(database.names.eveJournal).pipe(
    Effect.provide(database.migration)
  );
