-- EX13 candidate delta. Root owns migration numbering and composition.
-- No correction Cases/events exist before EX13 is enabled in this new profile.
ALTER TABLE authority.cases ADD COLUMN internal_basis jsonb NOT NULL;

ALTER TABLE authority.corrections
  DROP CONSTRAINT corrections_world_id_realm_case_id_key,
  ADD COLUMN revision bigint NOT NULL CHECK (revision >= 0),
  ADD CONSTRAINT corrections_revision_unique UNIQUE (world_id, realm, revision),
  ADD CONSTRAINT corrections_answer_kind CHECK (answer->>'_tag' IN ('Answer', 'Undo')),
  ADD CONSTRAINT corrections_undo_target CHECK (
    answer->>'_tag' <> 'Undo' OR
    (previous_correction_id IS NOT NULL AND answer->>'correctionRef' = previous_correction_id::text)
  );

CREATE UNIQUE INDEX corrections_one_answer_per_case
  ON authority.corrections (world_id, realm, case_id)
  WHERE answer->>'_tag' = 'Answer';
CREATE UNIQUE INDEX corrections_one_undo_per_target
  ON authority.corrections (world_id, realm, previous_correction_id)
  WHERE answer->>'_tag' = 'Undo';
CREATE INDEX corrections_case_revision
  ON authority.corrections (world_id, realm, case_id, revision DESC);
