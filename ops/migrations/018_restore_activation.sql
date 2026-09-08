-- ZA-13 restore activation quarantine state (controller-scoped).
-- Promotion to Active is refused while H-01 / G-OPS / G-STORAGE-FENCE remain
-- Blocked/Unknown and restoreAfterErasure stays false. Object Lock does not
-- qualify restoreAfterErasure (Unknown). Quarantine is an admission state, not
-- a second truth system.
CREATE TABLE IF NOT EXISTS erasure_attempt.restore_activation (
  preparation_id uuid PRIMARY KEY,
  deployment_writer_id text COLLATE "C" NOT NULL
    CHECK (char_length(deployment_writer_id) BETWEEN 1 AND 128),
  backup_generation_id uuid,
  phase text COLLATE "C" NOT NULL
    CHECK (phase IN ('Quarantined', 'Preparing', 'PromotionBlocked', 'Active')),
  prepared_controller_head_digest text COLLATE "C"
    CHECK (
      prepared_controller_head_digest IS NULL
      OR prepared_controller_head_digest ~ '^[0-9a-f]{64}$'
    ),
  prepared_security_revision text COLLATE "C",
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS restore_activation_writer
  ON erasure_attempt.restore_activation (deployment_writer_id);

CREATE INDEX IF NOT EXISTS restore_activation_phase
  ON erasure_attempt.restore_activation (phase);
