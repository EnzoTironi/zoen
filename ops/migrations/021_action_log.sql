-- Migration 021: Action Log (W2 Engine write path).
-- Append-only kinetics record of Action attempts and outcomes (glossary Action Log).
-- Maps tip Receipt ideas → durable Action attempt + outcome without replacing
-- authority.receipts (dual path: SemanticExecutor receipts remain; Action Log wraps).
-- Inert-safe for Fly: CREATE IF NOT EXISTS only; no DROP; no Eve; no prod destroy.
CREATE TABLE IF NOT EXISTS authority.action_log (
  entry_id uuid PRIMARY KEY,
  action_type_id text COLLATE "C" NOT NULL
    CHECK (char_length(action_type_id) BETWEEN 1 AND 128),
  actor_principal_id uuid,
  operation_id uuid,
  semantic_operation text COLLATE "C" NOT NULL
    CHECK (char_length(semantic_operation) BETWEEN 1 AND 128),
  world_id uuid,
  realm text COLLATE "C"
    CHECK (realm IS NULL OR realm IN ('live', 'evaluation')),
  outcome text COLLATE "C" NOT NULL
    CHECK (outcome IN ('accepted', 'rejected', 'failed', 'committed')),
  rejection_code text COLLATE "C"
    CHECK (
      rejection_code IS NULL
      OR char_length(rejection_code) BETWEEN 1 AND 128
    ),
  receipt_ref uuid,
  result jsonb,
  attempted_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CHECK (completed_at >= attempted_at)
);

CREATE INDEX IF NOT EXISTS action_log_action_type_attempted
  ON authority.action_log (action_type_id, attempted_at);

CREATE INDEX IF NOT EXISTS action_log_actor_attempted
  ON authority.action_log (actor_principal_id, attempted_at)
  WHERE actor_principal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS action_log_operation
  ON authority.action_log (operation_id)
  WHERE operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS action_log_world_attempted
  ON authority.action_log (world_id, realm, attempted_at)
  WHERE world_id IS NOT NULL;
