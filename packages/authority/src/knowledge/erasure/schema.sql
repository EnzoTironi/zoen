-- EX32 candidate DDL (non-numbered). Root owns ops/migrations numbering.
-- Local Closing progress + immutable receipt binding; separate from erasure_attempt register.
CREATE TABLE IF NOT EXISTS authority.world_erasure_progress (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  phase text COLLATE "C" NOT NULL
    CHECK (phase IN ('Active', 'Closing', 'Suppressed', 'Purging', 'Erased', 'Blocked', 'Unknown')),
  erasure_revision bigint NOT NULL CHECK (erasure_revision BETWEEN 0 AND 999999999999999999),
  closing_operation_id uuid,
  closing_receipt_id uuid,
  policy_version text COLLATE "C",
  updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm),
  CHECK (
    (phase = 'Active' AND closing_operation_id IS NULL AND closing_receipt_id IS NULL)
    OR (phase <> 'Active' AND closing_operation_id IS NOT NULL AND closing_receipt_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS authority.world_erasure_receipts (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  operation_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  intention_digest text COLLATE "C" NOT NULL
    CHECK (intention_digest ~ '^[0-9a-f]{64}$'),
  policy_version text COLLATE "C" NOT NULL,
  erasure_revision bigint NOT NULL CHECK (erasure_revision BETWEEN 0 AND 999999999999999999),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, operation_id),
  UNIQUE (world_id, realm, receipt_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);
