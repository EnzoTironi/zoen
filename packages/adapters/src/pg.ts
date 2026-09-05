import { Pool, type PoolConfig } from 'pg';
import type { Database, SqlConnection } from '../../contracts/src/ports.js';
import { KernelError } from '../../kernel/src/result.js';
/** Only a real PostgreSQL pool. There is no memory/SQLite/fallback branch. */
export class PgDatabase implements Database {
  readonly pool: Pool;
  constructor(config: PoolConfig) {
    this.pool = new Pool({ ...config, max: 8, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30_000, application_name: 'zoen-candidate' });
    this.pool.on('error', () => { console.error(JSON.stringify({ event: 'postgres.pool.error' })); });
  }
  async connect(): Promise<SqlConnection> {
    const client = await this.pool.connect();
    return {
      async query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: readonly unknown[] = []): Promise<readonly Row[]> {
        const result = await client.query<Row>(sql, [...values]); return result.rows;
      },
      release(): void { client.release(); },
    };
  }
  async close(): Promise<void> { await this.pool.end(); }
  async verifyRuntimeRole(expected: 'zoen_authority' | 'zoen_door' | 'zoen_outbox'): Promise<void> {
    const result = await this.pool.query<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean; server_version_num: string }>(`SELECT current_user,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,current_setting('server_version_num') AS server_version_num FROM pg_roles r WHERE r.rolname=current_user`);
    const row = result.rows[0];
    if (!row || row.current_user !== expected || row.rolsuper || row.rolbypassrls || row.rolcreatedb || row.rolcreaterole) throw new KernelError('Blocked', 'RUNTIME_DATABASE_ROLE');
    if (Math.floor(Number(row.server_version_num) / 10000) !== 18) throw new KernelError('Blocked', 'POSTGRES_VERSION_NOT_ADMITTED');
  }
}
