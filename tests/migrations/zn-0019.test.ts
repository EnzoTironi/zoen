import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SQL = join(ROOT, 'db/migrations/zn-0019_schema.sql');

test('ZN-0019-migration-sql-present', () => {
  assert.equal(existsSync(SQL), true);
  const body = readFileSync(SQL, 'utf8');
  assert.match(body, /schema_migration_ledger/);
  assert.match(body, /zoen_progress/);
  assert.match(body, /zoen_authority/);
});
