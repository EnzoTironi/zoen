-- Authority basis v2 adds real, initially empty identity state to each World.
-- The caller must quiesce old writers first: their five-domain reader is not
-- compatible with this state. This DDL does not admit a runtime/World upgrade.
-- Saved bases, Frames, Cases, receipts, events and World bindings stay intact.
LOCK TABLE authority.worlds, authority.domains IN ACCESS EXCLUSIVE MODE;

ALTER TABLE authority.domains
  DROP CONSTRAINT domains_domain_key_check,
  ADD CONSTRAINT domains_domain_key_check
    CHECK (domain_key IN ('membership', 'sources', 'evidence', 'claims', 'cases', 'identity'));

INSERT INTO authority.domains (world_id, realm, domain_key, version)
SELECT world_id, realm, 'identity', 0 FROM authority.worlds;
