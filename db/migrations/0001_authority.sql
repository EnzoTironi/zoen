-- Candidate PostgreSQL 18 migration. Must run through tooling/migrate.mjs as migrator.
-- No production database was available in the delivery environment; real tests are mandatory.
CREATE SCHEMA IF NOT EXISTS ontology;
CREATE SCHEMA IF NOT EXISTS jobs;
CREATE SCHEMA IF NOT EXISTS door;
REVOKE ALL ON SCHEMA ontology, jobs, door FROM PUBLIC;

CREATE TABLE ontology.worlds (
  world_id uuid NOT NULL, realm text NOT NULL CHECK (realm IN ('live','evaluation')),
  owner_id uuid NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  release_digest text NOT NULL CHECK (release_digest ~ '^[a-f0-9]{64}$'),
  generation_id uuid NOT NULL, cell_epoch bigint NOT NULL DEFAULT 1 CHECK (cell_epoch > 0),
  security_revision bigint NOT NULL DEFAULT 0 CHECK (security_revision >= 0),
  emergency_deny boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (world_id,realm)
);
CREATE TABLE ontology.memberships (
  world_id uuid NOT NULL, realm text NOT NULL, principal_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','revoked')),
  PRIMARY KEY (world_id,realm,principal_id), FOREIGN KEY (world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE TABLE ontology.domains (
  world_id uuid NOT NULL, realm text NOT NULL, domain_id text NOT NULL CHECK (domain_id ~ '^[a-z][a-z0-9_.:-]{0,127}$'),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0), PRIMARY KEY (world_id,realm,domain_id),
  FOREIGN KEY (world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE TABLE ontology.commits (
  world_id uuid NOT NULL, realm text NOT NULL, commit_id uuid NOT NULL,
  head_digest text NOT NULL CHECK (head_digest ~ '^[a-f0-9]{64}$'), touched_domains jsonb NOT NULL CHECK (jsonb_typeof(touched_domains) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (world_id,realm,commit_id),
  FOREIGN KEY (world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE TABLE ontology.receipts (
  world_id uuid NOT NULL, realm text NOT NULL, receipt_id uuid NOT NULL, commit_id uuid NOT NULL,
  kind text NOT NULL, payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'), payload jsonb NOT NULL,
  PRIMARY KEY (world_id,realm,receipt_id), FOREIGN KEY (world_id,realm,commit_id) REFERENCES ontology.commits(world_id,realm,commit_id)
);
CREATE TABLE ontology.operations (
  world_id uuid NOT NULL, realm text NOT NULL, principal_id uuid NOT NULL, semantic_op text NOT NULL,
  operation_id uuid NOT NULL, intent_digest text NOT NULL CHECK (intent_digest ~ '^[a-f0-9]{64}$'),
  result_ref uuid NOT NULL, commit_id uuid NOT NULL,
  PRIMARY KEY (world_id,realm,principal_id,semantic_op,operation_id),
  FOREIGN KEY (world_id,realm,result_ref) REFERENCES ontology.receipts(world_id,realm,receipt_id),
  FOREIGN KEY (world_id,realm,commit_id) REFERENCES ontology.commits(world_id,realm,commit_id)
);
CREATE TABLE ontology.bootstrap_operations (
  principal_id uuid NOT NULL, semantic_op text NOT NULL CHECK (semantic_op = 'CreatePersonalWorld'),
  operation_id uuid NOT NULL, intent_digest text NOT NULL CHECK (intent_digest ~ '^[a-f0-9]{64}$'),
  world_id uuid NOT NULL, realm text NOT NULL, result_ref uuid NOT NULL,
  PRIMARY KEY (principal_id,semantic_op,operation_id),
  FOREIGN KEY (world_id,realm,result_ref) REFERENCES ontology.receipts(world_id,realm,receipt_id)
);
CREATE TABLE ontology.sources (
  world_id uuid NOT NULL, realm text NOT NULL, source_id uuid NOT NULL, family_id uuid NOT NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  visibility text NOT NULL CHECK (visibility IN ('shared','owner-only')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','quarantined')),
  created_by uuid NOT NULL, PRIMARY KEY (world_id,realm,source_id),
  FOREIGN KEY (world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE TABLE ontology.subjects (
  world_id uuid NOT NULL, realm text NOT NULL, subject_id uuid NOT NULL,
  type_id text NOT NULL, label text NOT NULL CHECK (length(label) BETWEEN 1 AND 160),
  PRIMARY KEY (world_id,realm,subject_id), FOREIGN KEY (world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE TABLE ontology.evidence (
  world_id uuid NOT NULL, realm text NOT NULL, evidence_id uuid NOT NULL, source_id uuid NOT NULL,
  object_key text NOT NULL CHECK (length(object_key) BETWEEN 1 AND 512),
  content_digest text NOT NULL CHECK (content_digest ~ '^[a-f0-9]{64}$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 5242880),
  media_type text NOT NULL, object_version text NOT NULL CHECK (length(object_version) > 0),
  PRIMARY KEY (world_id,realm,evidence_id), FOREIGN KEY (world_id,realm,source_id) REFERENCES ontology.sources(world_id,realm,source_id)
);
CREATE TABLE ontology.claims (
  world_id uuid NOT NULL, realm text NOT NULL, claim_id uuid NOT NULL,
  subject_id uuid NOT NULL, predicate_id text NOT NULL, source_id uuid NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  domain_id text NOT NULL, knowledge_version bigint NOT NULL CHECK (knowledge_version > 0),
  asserted_by uuid NOT NULL,
  PRIMARY KEY (world_id,realm,claim_id),
  CHECK ((payload->>'id' = claim_id::text) IS TRUE),
  CHECK ((payload->>'subjectId' = subject_id::text) IS TRUE),
  CHECK ((payload->>'predicateId' = predicate_id) IS TRUE),
  CHECK ((payload->>'sourceId' = source_id::text) IS TRUE),
  CHECK ((payload->>'knowledgeVersion' = knowledge_version::text) IS TRUE),
  CHECK ((payload->'world'->>'worldId' = world_id::text) IS TRUE),
  CHECK ((payload->'world'->>'realm' = realm) IS TRUE),
  FOREIGN KEY (world_id,realm,subject_id) REFERENCES ontology.subjects(world_id,realm,subject_id),
  FOREIGN KEY (world_id,realm,source_id) REFERENCES ontology.sources(world_id,realm,source_id),
  FOREIGN KEY (world_id,realm,domain_id) REFERENCES ontology.domains(world_id,realm,domain_id)
);
CREATE INDEX claims_subject_predicate ON ontology.claims(world_id,realm,subject_id,predicate_id,knowledge_version);
CREATE TABLE ontology.claim_evidence (
  world_id uuid NOT NULL, realm text NOT NULL, claim_id uuid NOT NULL, evidence_id uuid NOT NULL,
  PRIMARY KEY(world_id,realm,claim_id,evidence_id),
  FOREIGN KEY(world_id,realm,claim_id) REFERENCES ontology.claims(world_id,realm,claim_id),
  FOREIGN KEY(world_id,realm,evidence_id) REFERENCES ontology.evidence(world_id,realm,evidence_id)
);
CREATE TABLE ontology.claim_edges (
  world_id uuid NOT NULL, realm text NOT NULL, parent_id uuid NOT NULL, child_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('derived','supersedes','retracts')),
  domain_id text NOT NULL, knowledge_version bigint NOT NULL CHECK (knowledge_version > 0),
  PRIMARY KEY(world_id,realm,parent_id,child_id,kind), CHECK(parent_id <> child_id),
  FOREIGN KEY(world_id,realm,parent_id) REFERENCES ontology.claims(world_id,realm,claim_id),
  FOREIGN KEY(world_id,realm,child_id) REFERENCES ontology.claims(world_id,realm,claim_id),
  FOREIGN KEY(world_id,realm,domain_id) REFERENCES ontology.domains(world_id,realm,domain_id)
);
CREATE TABLE ontology.frames (
  world_id uuid NOT NULL, realm text NOT NULL, frame_id uuid NOT NULL, principal_id uuid NOT NULL,
  purpose text NOT NULL, head_digest text NOT NULL, basis jsonb NOT NULL, payload jsonb NOT NULL,
  source_ids uuid[] NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL, PRIMARY KEY(world_id,realm,frame_id),
  FOREIGN KEY(world_id,realm) REFERENCES ontology.worlds(world_id,realm)
);
CREATE INDEX frames_principal ON ontology.frames(world_id,realm,principal_id,expires_at);
CREATE TABLE jobs.outbox (
  world_id uuid NOT NULL, realm text NOT NULL, outbox_id uuid NOT NULL, owner text NOT NULL,
  commit_id uuid NOT NULL, event_ordinal integer NOT NULL CHECK (event_ordinal >= 0),
  payload_ref uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','delivered')),
  lease_owner uuid, fence bigint NOT NULL DEFAULT 0 CHECK (fence >= 0), lease_until timestamptz,
  PRIMARY KEY(world_id,realm,outbox_id), UNIQUE(owner,world_id,realm,commit_id,event_ordinal),
  FOREIGN KEY(world_id,realm,payload_ref) REFERENCES ontology.receipts(world_id,realm,receipt_id),
  CHECK ((state = 'leased' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL) OR (state <> 'leased' AND lease_owner IS NULL AND lease_until IS NULL))
);
CREATE INDEX outbox_claim ON jobs.outbox(owner,state,lease_until);

-- PostgreSQL RLS provides a second World/realm boundary. The trusted executor alone
-- has runtime credentials and sets this scope after verified presence; RLS is NOT
-- a replacement for Cedar, field/source disclosure or request authorization.
DO $block$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['worlds','memberships','domains','commits','receipts','operations','sources','subjects','evidence','claims','claim_evidence','claim_edges','frames'] LOOP
    EXECUTE format('ALTER TABLE ontology.%I ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('ALTER TABLE ontology.%I FORCE ROW LEVEL SECURITY', relation);
    EXECUTE format('CREATE POLICY world_scope ON ontology.%I USING (world_id::text = current_setting(''zoen.world_id'', true) AND realm = current_setting(''zoen.realm'', true)) WITH CHECK (world_id::text = current_setting(''zoen.world_id'', true) AND realm = current_setting(''zoen.realm'', true))', relation);
  END LOOP;
END
$block$;
ALTER TABLE ontology.bootstrap_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.bootstrap_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY bootstrap_principal ON ontology.bootstrap_operations USING (principal_id::text = current_setting('zoen.principal_id',true)) WITH CHECK (principal_id::text = current_setting('zoen.principal_id',true));
REVOKE ALL ON ALL TABLES IN SCHEMA ontology, jobs FROM PUBLIC;
