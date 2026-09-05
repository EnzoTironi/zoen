import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url = process.env.ZOEN_MIGRATOR_DATABASE_URL;
if (!url) { console.error('BLOCKED: ZOEN_MIGRATOR_DATABASE_URL is required. No fallback database.'); process.exit(2); }
if (process.env.ZOEN_ALLOW_SCHEMA_MIGRATIONS !== 'yes') { console.error('BLOCKED: explicitly set ZOEN_ALLOW_SCHEMA_MIGRATIONS=yes after reviewing the target.'); process.exit(2); }
const { Client } = await import('pg');
const client = new Client({ connectionString: url, application_name: 'zoen-migrator', connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const version = Number((await client.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
  if (Math.floor(version / 10000) !== 18) throw new Error('PostgreSQL 18 is required');
  await client.query('SELECT pg_advisory_lock(2059361284)');
  const existing = (await client.query("SELECT to_regclass('public.zoen_migrations') AS ledger")).rows[0].ledger;
  if (!existing) {
    const occupied = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname IN ('ontology','jobs','door') LIMIT 1")).rows;
    if (occupied.length) throw new Error('Untracked application tables found. Refuse to overwrite an existing database.');
    await client.query('CREATE TABLE public.zoen_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    await client.query('REVOKE ALL ON public.zoen_migrations FROM PUBLIC');
  }
  for (const name of (await readdir('db/migrations')).filter(n => /^\d{4}_[a-z_]+\.sql$/.test(n)).sort()) {
    const bytes = await readFile(`db/migrations/${name}`); const digest = createHash('sha256').update(bytes).digest('hex');
    const previous = (await client.query('SELECT sha256 FROM public.zoen_migrations WHERE name=$1', [name])).rows[0];
    if (previous) { if (previous.sha256 !== digest) throw new Error('Applied migration bytes changed'); continue; }
    await client.query('BEGIN');
    try { await client.query(bytes.toString('utf8')); await client.query('INSERT INTO public.zoen_migrations(name,sha256) VALUES($1,$2)', [name,digest]); await client.query('COMMIT'); console.log(JSON.stringify({ migration: name, sha256: digest, outcome: 'applied' })); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
  }
} catch (error) { console.error(JSON.stringify({ status: 'failed', code: typeof error.code === 'string' ? error.code : 'MIGRATION_FAILED', note: 'No down migration or destructive reset was attempted.' })); process.exitCode = 1; }
finally { try { await client.query('SELECT pg_advisory_unlock(2059361284)'); } catch {} await client.end(); }
