-- ZA-03: one-shot rewrite of delivery-labeled World policy ids to descriptive
-- contracts. Idempotent; unknown ids are left untouched here and fail closed
-- at hosted installation.json align / DataPolicySchema decode.
UPDATE authority.worlds
  SET data_policy_id = 'worlds-local-erasable-v1'
  WHERE data_policy_id = 'd03-local-erasable-v1';

UPDATE authority.worlds
  SET data_policy_id = 'worlds-hosted-retained-v1'
  WHERE data_policy_id = 'd04-hosted-retained-v1';
