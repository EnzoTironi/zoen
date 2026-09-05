-- Candidate D01 schema. The integrator owns migration numbering and execution.
-- Apply atomically to a dedicated application database as its migration owner.
CREATE SCHEMA identity;
CREATE SCHEMA authority;
CREATE SCHEMA jobs;
REVOKE ALL ON SCHEMA identity, authority, jobs FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
DO $database_permissions$
BEGIN
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM PUBLIC', current_database());
END
$database_permissions$;

CREATE TABLE authority.worlds (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm IN ('live', 'evaluation')),
  cell_id uuid NOT NULL,
  cell_epoch bigint NOT NULL CHECK (cell_epoch BETWEEN 0 AND 999999999999999999),
  release_digest text COLLATE "C" NOT NULL CHECK (release_digest ~ '^[0-9a-f]{64}$'),
  generation_id uuid NOT NULL,
  security_revision bigint NOT NULL CHECK (security_revision BETWEEN 0 AND 999999999999999999),
  emergency_deny boolean NOT NULL,
  data_policy_id text COLLATE "C" NOT NULL,
  created_at timestamptz(3) NOT NULL CHECK (created_at BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  PRIMARY KEY (world_id, realm)
);

CREATE TABLE authority.memberships (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  principal_id uuid NOT NULL,
  state text COLLATE "C" NOT NULL CHECK (state IN ('active', 'revoked')),
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 999999999999999999),
  role text COLLATE "C" NOT NULL CHECK (role = 'owner'),
  PRIMARY KEY (world_id, realm, principal_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.domains (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  domain_key text COLLATE "C" NOT NULL CHECK (domain_key IN ('membership', 'sources', 'evidence', 'claims', 'cases')),
  version bigint NOT NULL CHECK (version BETWEEN 0 AND 999999999999999999),
  PRIMARY KEY (world_id, realm, domain_key),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.receipts (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  receipt_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  operation text COLLATE "C" NOT NULL,
  commit_id uuid NOT NULL,
  committed_at timestamptz(3) NOT NULL CHECK (committed_at BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  result jsonb NOT NULL,
  touched_domains jsonb NOT NULL,
  PRIMARY KEY (world_id, realm, receipt_id),
  UNIQUE (world_id, realm, commit_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.bootstrap_operations (
  principal_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  semantic_operation text COLLATE "C" NOT NULL CHECK (semantic_operation = 'CreatePersonalWorld'),
  intent_digest text COLLATE "C" NOT NULL CHECK (intent_digest ~ '^[0-9a-f]{64}$'),
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  receipt_id uuid NOT NULL,
  PRIMARY KEY (principal_id, operation_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (world_id, realm, receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE authority.operations (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  principal_id uuid NOT NULL,
  semantic_operation text COLLATE "C" NOT NULL,
  operation_id uuid NOT NULL,
  intent_digest text COLLATE "C" NOT NULL CHECK (intent_digest ~ '^[0-9a-f]{64}$'),
  receipt_id uuid NOT NULL,
  PRIMARY KEY (world_id, realm, principal_id, semantic_operation, operation_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (world_id, realm, receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE jobs.outbox (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  outbox_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  state text COLLATE "C" NOT NULL CHECK (state IN ('pending', 'leased', 'delivered')),
  fence bigint NOT NULL CHECK (fence BETWEEN 0 AND 999999999999999999),
  lease_owner uuid,
  lease_until timestamptz(3) CHECK (lease_until BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  event_kind text COLLATE "C" NOT NULL,
  payload_ref uuid NOT NULL CHECK (payload_ref = receipt_id),
  CHECK ((state = 'leased' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL) OR (state <> 'leased' AND lease_owner IS NULL AND lease_until IS NULL)),
  PRIMARY KEY (world_id, realm, outbox_id),
  FOREIGN KEY (world_id, realm, receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE jobs.captures (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  capture_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  state text COLLATE "C" NOT NULL CHECK (state IN ('reserved', 'uploaded', 'admitted', 'cleanup_pending', 'removed')),
  object_location jsonb,
  expected_digest text COLLATE "C" NOT NULL CHECK (expected_digest ~ '^[0-9a-f]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 262144),
  expires_at timestamptz(3) NOT NULL CHECK (expires_at BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  fence bigint NOT NULL CHECK (fence BETWEEN 0 AND 999999999999999999),
  CHECK (state NOT IN ('uploaded', 'admitted') OR object_location IS NOT NULL),
  PRIMARY KEY (world_id, realm, capture_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.sources (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  source_id uuid NOT NULL,
  namespace text COLLATE "C" NOT NULL CHECK (namespace ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  external_id text COLLATE "C" NOT NULL CHECK (external_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  PRIMARY KEY (world_id, realm, source_id),
  UNIQUE (world_id, realm, namespace, external_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.evidence (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  evidence_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  source_id uuid NOT NULL,
  source_revision text COLLATE "C" NOT NULL CHECK (char_length(source_revision) BETWEEN 1 AND 128),
  source_label text NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 200),
  byte_digest text COLLATE "C" NOT NULL CHECK (byte_digest ~ '^[0-9a-f]{64}$'),
  state text COLLATE "C" NOT NULL CHECK (state IN ('admitted', 'unavailable', 'erasure_pending')),
  admitted_receipt_id uuid NOT NULL,
  PRIMARY KEY (world_id, realm, evidence_id),
  UNIQUE (world_id, realm, evidence_id, source_id),
  UNIQUE (world_id, realm, capture_id),
  UNIQUE (world_id, realm, source_id, source_revision),
  FOREIGN KEY (world_id, realm, capture_id) REFERENCES jobs.captures (world_id, realm, capture_id),
  FOREIGN KEY (world_id, realm, source_id) REFERENCES authority.sources (world_id, realm, source_id),
  FOREIGN KEY (world_id, realm, admitted_receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE authority.pins (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  evidence_id uuid NOT NULL,
  owner_kind text COLLATE "C" NOT NULL CHECK (owner_kind IN ('evidence', 'frame', 'case')),
  owner_id uuid NOT NULL,
  created_at timestamptz(3) NOT NULL CHECK (created_at BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  PRIMARY KEY (world_id, realm, evidence_id, owner_kind, owner_id),
  FOREIGN KEY (world_id, realm, evidence_id) REFERENCES authority.evidence (world_id, realm, evidence_id)
);

CREATE TABLE authority.claims (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  claim_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  source_id uuid NOT NULL,
  external_id text COLLATE "C" NOT NULL CHECK (external_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  subject_key text COLLATE "C" NOT NULL CHECK (subject_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  predicate text COLLATE "C" NOT NULL CHECK (predicate = 'obligation.amount'),
  record_index integer NOT NULL CHECK (record_index BETWEEN 0 AND 199),
  valid_from date CHECK (valid_from BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  valid_to date CHECK (valid_to BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'),
  value_tag text COLLATE "C" NOT NULL CHECK (value_tag IN ('Known', 'Unknown')),
  amount numeric(38,18),
  currency text COLLATE "C" CHECK (currency IN ('BRL', 'USD', 'EUR')),
  introduced_receipt_id uuid NOT NULL,
  CHECK ((valid_from IS NULL AND valid_to IS NULL) OR (valid_from IS NOT NULL AND valid_to IS NOT NULL AND valid_from < valid_to)),
  CHECK ((value_tag = 'Known' AND amount IS NOT NULL AND currency IS NOT NULL) OR (value_tag = 'Unknown' AND amount IS NULL AND currency IS NULL)),
  CHECK (amount IS NULL OR amount <> 'NaN'::numeric),
  PRIMARY KEY (world_id, realm, claim_id),
  UNIQUE (world_id, realm, evidence_id, external_id),
  FOREIGN KEY (world_id, realm, evidence_id, source_id) REFERENCES authority.evidence (world_id, realm, evidence_id, source_id),
  FOREIGN KEY (world_id, realm, introduced_receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX claims_subject ON authority.claims (world_id, realm, subject_key, predicate);

CREATE TABLE authority.frames (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  frame_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  purpose text COLLATE "C" NOT NULL CHECK (purpose = 'personal-records'),
  subject_key text COLLATE "C" NOT NULL CHECK (subject_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  internal_basis jsonb NOT NULL,
  visible_frame jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL CHECK (created_at BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00' AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'),
  PRIMARY KEY (world_id, realm, frame_id),
  FOREIGN KEY (world_id, realm) REFERENCES authority.worlds (world_id, realm)
);

CREATE TABLE authority.cases (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  case_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  frame_id uuid NOT NULL,
  subject_key text COLLATE "C" NOT NULL CHECK (subject_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  state text COLLATE "C" NOT NULL CHECK (state IN ('proposed', 'applied', 'blocked', 'cancelled')),
  question_ref uuid NOT NULL,
  question jsonb NOT NULL,
  consequence jsonb NOT NULL,
  introduced_receipt_id uuid NOT NULL,
  PRIMARY KEY (world_id, realm, case_id),
  UNIQUE (world_id, realm, question_ref),
  FOREIGN KEY (world_id, realm, frame_id) REFERENCES authority.frames (world_id, realm, frame_id),
  FOREIGN KEY (world_id, realm, introduced_receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE authority.corrections (
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL,
  correction_id uuid NOT NULL,
  case_id uuid NOT NULL,
  answer jsonb NOT NULL,
  previous_correction_id uuid,
  receipt_id uuid NOT NULL,
  PRIMARY KEY (world_id, realm, correction_id),
  UNIQUE (world_id, realm, case_id),
  FOREIGN KEY (world_id, realm, case_id) REFERENCES authority.cases (world_id, realm, case_id),
  FOREIGN KEY (world_id, realm, previous_correction_id) REFERENCES authority.corrections (world_id, realm, correction_id),
  FOREIGN KEY (world_id, realm, receipt_id) REFERENCES authority.receipts (world_id, realm, receipt_id) DEFERRABLE INITIALLY DEFERRED
);
