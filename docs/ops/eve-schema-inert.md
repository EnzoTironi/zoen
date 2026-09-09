# Eve schema inert (migration 019)

**Choice:** keep `ops/migrations/019_eve_owned_durable_journal.sql` in the migration chain and continue applying the DDL on install. Do **not** DROP the `eve` schema on live Fly volumes.

**Why:** product Eve / OpenCode / voice / WhatsApp chat surface is removed from tip (Worlds only). Dropping a live journal schema risks Fly volume / migration-history divergence for installs that already applied 019. An inert schema with no runtime grants, no `/api/eve`, and no journal role is the safer subtract.

**Privilege cleanup:** `ops/migrations/020_revoke_eve_journal_privileges.sql` revokes leftover `USAGE` / table DML previously granted to dedicated journal roles (discovery-based; no-op if schema or role absent). Optional `revokeEveJournalMigrations(role)` covers a known role name the same way. Neither path DROP ROLE nor DROP tables.

**Not claimed:** D05 activated, `fullHostedErased`, G-PROVIDER live, or Eve as application surface.
