-- ZN-0014 repair index for genesis bootstrap → world lookup (0001 declares the table).
CREATE INDEX IF NOT EXISTS bootstrap_operations_world
  ON ontology.bootstrap_operations (world_id, realm);
