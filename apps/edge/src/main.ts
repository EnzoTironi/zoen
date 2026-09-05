import { serve } from '@hono/node-server';
import { readConfig } from '../../../packages/adapters/src/config.js';
import { PgDatabase } from '../../../packages/adapters/src/pg.js';
import { S3EvidenceStore } from '../../../packages/adapters/src/s3.js';
import { WebCryptography } from '../../../packages/adapters/src/cryptography.js';
import { CedarAuthorizer, FOUNDATION_POLICY } from '../../../packages/adapters/src/cedar.js';
import { createDoor } from '../../../packages/door/src/door.js';
import { Authority } from '../../../packages/ontology/src/authority/transaction.js';
import { SemanticExecutor } from '../../../packages/ontology/src/surfaces/dispatch.js';
import { FOUNDATION } from '../../../packages/ontology/src/surfaces/registry.js';
import { createEdge } from './app.js';
import { toPublicFailure } from '../../../packages/kernel/src/result.js';
async function main(): Promise<void> {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Node 24 target required for service execution');
  const config = readConfig(process.env); const cryptography = new WebCryptography();
  const database = new PgDatabase({ connectionString: config.authorityUrl });
  const doorDatabase = new PgDatabase({ connectionString: config.doorUrl, options: '-c search_path=door' });
  const store = new S3EvidenceStore(config.bucket, config.region, config.bucketOwner, cryptography);
  try {
    await database.verifyRuntimeRole('zoen_authority'); await doorDatabase.verifyRuntimeRole('zoen_door'); await store.verifyBucket();
    const authorizer = new CedarAuthorizer();
    const release = await cryptography.digest({ foundation: FOUNDATION, policyDigest: await cryptography.sha256(new TextEncoder().encode(FOUNDATION_POLICY)) });
    const authority = new Authority(database, cryptography, { now: () => new Date().toISOString() }, authorizer, release);
    const executor = new SemanticExecutor(authority, store, release);
    const door = createDoor(doorDatabase.pool, config.publicOrigin, config.authSecret);
    const app = createEdge(door, executor, config.publicOrigin);
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: config.port });
    let closing = false;
    const shutdown = (): void => {
      if (closing) return; closing = true;
      const timeout = setTimeout(() => process.exit(1), 15_000); timeout.unref();
      server.close(() => { void Promise.all([database.close(), doorDatabase.close()]).finally(() => { store.close(); clearTimeout(timeout); }); });
    };
    process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
    console.info(JSON.stringify({ event: 'edge.started', bind: '127.0.0.1', port: config.port, qualification: 'candidate' }));
  } catch (error) { await Promise.all([database.close(), doorDatabase.close()]); store.close(); throw error; }
}
main().catch(error => { console.error(JSON.stringify({ event: 'startup.failed', failure: toPublicFailure(error) })); process.exitCode = 1; });
