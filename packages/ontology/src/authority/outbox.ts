import type { Database } from '../../../contracts/src/ports.js';
import { uuid, counter, type UUID } from '../../../kernel/src/ids.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
export type OutboxLease = Readonly<{ worldId: UUID; realm: string; outboxId: UUID; payloadRef: UUID; owner: UUID; fence: string; until: string }>;
/** Actual PostgreSQL queue. No payload or source credential is given to an unscoped worker. */
export class OutboxQueue {
  constructor(private readonly db: Database) {}
  async claim(worker: UUID, owner: string, limit = 20, seconds = 30): Promise<readonly OutboxLease[]> {
    requireThat(Number.isInteger(limit) && limit > 0 && limit <= 100 && Number.isInteger(seconds) && seconds > 0 && seconds <= 300, 'OUTBOX_LIMIT');
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{ world_id: string; realm: string; outbox_id: string; payload_ref: string; fence: string; until: string }>(
        `WITH ready AS (SELECT world_id,realm,outbox_id FROM jobs.outbox WHERE owner=$1 AND (state='pending' OR (state='leased' AND lease_until<=clock_timestamp())) ORDER BY outbox_id LIMIT $2 FOR UPDATE SKIP LOCKED)
         UPDATE jobs.outbox q SET state='leased',lease_owner=$3,fence=q.fence+1,lease_until=clock_timestamp()+($4::integer * interval '1 second') FROM ready
         WHERE q.world_id=ready.world_id AND q.realm=ready.realm AND q.outbox_id=ready.outbox_id
         RETURNING q.world_id,q.realm,q.outbox_id,q.payload_ref,q.fence::text,to_char(q.lease_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS until`, [owner, limit, worker, seconds]);
      return Object.freeze(rows.map(row => Object.freeze({ worldId: uuid(row.world_id), realm: row.realm, outboxId: uuid(row.outbox_id), payloadRef: uuid(row.payload_ref), owner: worker, fence: counter(row.fence), until: row.until })));
    } finally { sql.release(); }
  }
  async acknowledge(lease: OutboxLease): Promise<void> {
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{ outbox_id: string }>("UPDATE jobs.outbox SET state='delivered',lease_owner=NULL,lease_until=NULL WHERE world_id=$1 AND realm=$2 AND outbox_id=$3 AND lease_owner=$4 AND fence=$5::bigint AND state='leased' AND lease_until>clock_timestamp() RETURNING outbox_id", [lease.worldId, lease.realm, lease.outboxId, lease.owner, lease.fence]);
      if (rows.length !== 1) throw new KernelError('LostLease', 'OUTBOX_FENCE_LOST');
    } finally { sql.release(); }
  }
}
