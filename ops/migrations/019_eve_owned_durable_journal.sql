-- ZA-18: actor-owned Eve interaction journal (operational, not domain truth).
-- Restricted schema: runtime uses a dedicated journal role (no authority.* access).
-- INV-01: never store model/API credentials or authority DB secrets here.
CREATE SCHEMA eve;
REVOKE ALL ON SCHEMA eve FROM PUBLIC;

CREATE TABLE eve.conversations (
  conversation_id uuid PRIMARY KEY,
  owner_principal_id uuid NOT NULL,
  relationship_id uuid NOT NULL,
  purpose text COLLATE "C" NOT NULL
    CHECK (purpose = 'personal-records'),
  world_id uuid,
  world_realm text COLLATE "C"
    CHECK (world_realm IS NULL OR world_realm IN ('live', 'evaluation')),
  profile_id text COLLATE "C" NOT NULL
    CHECK (profile_id IN (
      'eve-local-stub-v1',
      'eve-opencode-zen-v1',
      'eve-web-speech-v1'
    )),
  provider_admission text COLLATE "C" NOT NULL
    CHECK (provider_admission IN (
      'opencode-zen',
      'web-speech',
      'stub-local',
      'real-model-blocked',
      'voice-blocked'
    )),
  revision bigint NOT NULL
    CHECK (revision BETWEEN 1 AND 999999999999999999),
  schema_version text COLLATE "C" NOT NULL
    CHECK (schema_version = 'eve.v1'),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (world_id IS NULL AND world_realm IS NULL)
    OR (world_id IS NOT NULL AND world_realm IS NOT NULL)
  )
);

CREATE INDEX eve_conversations_owner
  ON eve.conversations (owner_principal_id, conversation_id);

CREATE TABLE eve.turns (
  conversation_id uuid NOT NULL
    REFERENCES eve.conversations (conversation_id),
  turn_id uuid NOT NULL,
  ingress_id uuid NOT NULL,
  intent_digest text COLLATE "C" NOT NULL
    CHECK (intent_digest ~ '^[0-9a-f]{64}$'),
  phase text COLLATE "C" NOT NULL
    CHECK (phase IN (
      'Accepted',
      'Settled',
      'Cancelled',
      'Interrupted'
    )),
  version bigint NOT NULL
    CHECK (version BETWEEN 0 AND 999999999999999999),
  lease_owner uuid,
  lease_epoch bigint NOT NULL DEFAULT 0
    CHECK (lease_epoch BETWEEN 0 AND 999999999999999999),
  lease_until timestamptz(3)
    CHECK (
      lease_until IS NULL
      OR lease_until BETWEEN TIMESTAMPTZ '0001-01-01 00:00:00+00'
        AND TIMESTAMPTZ '9999-12-31 23:59:59.999+00'
    ),
  PRIMARY KEY (conversation_id, turn_id),
  UNIQUE (conversation_id, ingress_id),
  CHECK (
    (phase IN ('Accepted') AND lease_owner IS NOT NULL AND lease_epoch >= 1)
    OR (phase IN ('Settled', 'Cancelled', 'Interrupted'))
  )
);

CREATE TABLE eve.messages (
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  message_id uuid NOT NULL,
  visible_text text NOT NULL
    CHECK (char_length(visible_text) BETWEEN 0 AND 16384),
  uncertainty text COLLATE "C" NOT NULL
    CHECK (uncertainty IN ('Known', 'Partial', 'Unknown')),
  state text COLLATE "C" NOT NULL
    CHECK (state IN ('Provisional', 'Visible', 'Superseded')),
  evidence_links jsonb NOT NULL,
  PRIMARY KEY (conversation_id, message_id),
  UNIQUE (conversation_id, turn_id),
  FOREIGN KEY (conversation_id, turn_id)
    REFERENCES eve.turns (conversation_id, turn_id)
);

CREATE TABLE eve.provider_attempts (
  conversation_id uuid NOT NULL,
  turn_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  lease_epoch bigint NOT NULL
    CHECK (lease_epoch BETWEEN 1 AND 999999999999999999),
  state text COLLATE "C" NOT NULL
    CHECK (state IN ('unresolved', 'settled', 'cancelled')),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz(3),
  PRIMARY KEY (conversation_id, turn_id, attempt_id),
  FOREIGN KEY (conversation_id, turn_id)
    REFERENCES eve.turns (conversation_id, turn_id),
  CHECK (
    (state = 'unresolved' AND resolved_at IS NULL)
    OR (state IN ('settled', 'cancelled') AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX eve_provider_attempts_unresolved
  ON eve.provider_attempts (conversation_id, turn_id)
  WHERE state = 'unresolved';
