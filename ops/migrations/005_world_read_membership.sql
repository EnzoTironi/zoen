-- Extend membership roles without selecting, deleting or rewriting an owner.
-- The migration runner executes this file atomically as the migration role.
DO $unique_world_owner$
BEGIN
  IF EXISTS (
    SELECT FROM authority.worlds w
    LEFT JOIN authority.memberships m USING (world_id, realm)
    GROUP BY w.world_id, w.realm
    HAVING count(*) FILTER (WHERE m.role = 'owner') <> 1
  ) THEN
    RAISE EXCEPTION 'World owner history is inconsistent'
      USING ERRCODE = '23514', CONSTRAINT = 'world_requires_one_owner';
  END IF;
END
$unique_world_owner$;

ALTER TABLE authority.memberships
  DROP CONSTRAINT memberships_role_check,
  ADD CONSTRAINT memberships_role_check CHECK (role IN ('owner', 'viewer'));

CREATE UNIQUE INDEX memberships_one_owner
  ON authority.memberships (world_id, realm)
  WHERE role = 'owner';
