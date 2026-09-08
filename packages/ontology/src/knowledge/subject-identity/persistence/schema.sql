-- EX27 candidate delta. Root owns migration numbering and composition.
-- Private identity decisions; projection is append-only through effect items.
CREATE TABLE authority.identity_decisions (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  decision_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  purpose text COLLATE "C" NOT NULL CHECK (purpose = 'personal-records'),
  kind text COLLATE "C" NOT NULL CHECK (kind IN ('resolution', 'split', 'undo')),
  interval_from date NOT NULL,
  interval_to date NOT NULL,
  target_decision_id uuid,
  revision bigint NOT NULL CHECK (revision >= 0),
  effect_items jsonb NOT NULL,
  case_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  PRIMARY KEY (world_id, realm, decision_id),
  UNIQUE (world_id, realm, principal_id, purpose, revision),
  CHECK (
    (kind = 'undo' AND target_decision_id IS NOT NULL) OR
    (kind <> 'undo' AND target_decision_id IS NULL)
  ),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm),
  FOREIGN KEY (world_id, realm, case_id) REFERENCES authority.cases (world_id, realm, case_id),
  FOREIGN KEY (world_id, realm, receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id)
    DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (world_id, realm, target_decision_id)
    REFERENCES authority.identity_decisions (world_id, realm, decision_id)
);

CREATE INDEX identity_decisions_scope_revision
  ON authority.identity_decisions (world_id, realm, principal_id, purpose, revision);
