import { readFile } from 'node:fs/promises';
const url = process.env.ZOEN_MIGRATOR_DATABASE_URL;
const names = ['zoen_authority', 'zoen_door', 'zoen_outbox'];
if (!url || process.env.ZOEN_ALLOW_ROLE_PROVISIONING !== 'yes') { console.error('BLOCKED: migrator URL and explicit ZOEN_ALLOW_ROLE_PROVISIONING=yes required.'); process.exit(2); }
const passwords = names.map(name => process.env[`${name.toUpperCase()}_PASSWORD`]);
if (passwords.some(secret => !secret || secret.length < 32)) { console.error('BLOCKED: provide three distinct runtime passwords, at least 32 characters.'); process.exit(2); }
if (new Set(passwords).size !== 3) { console.error('BLOCKED: runtime role passwords must differ.'); process.exit(2); }
const { Client } = await import('pg'); const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
try {
  await client.connect(); await client.query('BEGIN');
  const existing = (await client.query('SELECT rolname FROM pg_roles WHERE rolname=ANY($1::text[])', [names])).rows;
  // PostgreSQL roles are cluster-global: never rotate a possibly unrelated role.
  // An already-provisioned cluster must be verified, not reprovisioned by this script.
  if (existing.length) throw new Error('Runtime role names already exist; use a dedicated fresh cluster or independently verify existing roles.');
  await client.query(await readFile('db/roles.sql', 'utf8'));
  for (let i=0;i<names.length;i++) {
    const row = (await client.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1', [names[i]])).rows[0];
    if (!row || row.rolsuper || row.rolbypassrls || row.rolcreatedb || row.rolcreaterole) throw new Error('Preexisting runtime role has excessive authority');
    const memberships = (await client.query('SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=$1', [names[i]])).rows;
    if (memberships.length) throw new Error('Preexisting runtime role has inherited grants');
    const command = (await client.query("SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS command", [names[i], passwords[i]])).rows[0].command;
    await client.query(command);
  }
  await client.query('COMMIT'); console.log('Runtime roles provisioned. Secrets and URLs were not printed.');
} catch (error) { try { await client.query('ROLLBACK'); } catch {} console.error(JSON.stringify({ status: 'failed', code: typeof error.code === 'string' ? error.code : 'ROLE_PROVISION_FAILED' })); process.exitCode=1; }
finally { await client.end(); }
