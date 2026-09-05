import type { Database } from '../../../contracts/src/ports.js';
import { uuid, counter, type UUID } from '../../../kernel/src/ids.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';

/** Fenced lease token returned by ClaimOutbox. */
export type OutboxLease = Readonly<{
  worldId: UUID;
  realm: string;
  outboxId: UUID;
  payloadRef: UUID;
  /** Stream owner namespace (jobs.outbox.owner), not the worker UUID. */
  streamOwner: string;
  /** Worker that holds this lease generation. */
  owner: UUID;
  fence: string;
  until: string;
  commitId: UUID;
  eventOrdinal: number;
}>;

/** Stable event identity for consumer deduplication (owner-scoped cursor stream). */
export type OutboxEventIdentity = Readonly<{
  streamOwner: string;
  worldId: UUID;
  realm: string;
  commitId: UUID;
  eventOrdinal: number;
}>;

export type ConsumerAdmitResult = Readonly<{
  eventKey: string;
  firstAdmission: boolean;
}>;

export type ProgressRecord = Readonly<{
  streamOwner: string;
  cursor: string;
  fence: string;
  worker: UUID;
}>;

export function eventIdentity(lease: OutboxLease): OutboxEventIdentity {
  return Object.freeze({
    streamOwner: lease.streamOwner,
    worldId: lease.worldId,
    realm: lease.realm,
    commitId: lease.commitId,
    eventOrdinal: lease.eventOrdinal,
  });
}

export function eventKey(id: OutboxEventIdentity): string {
  return `${id.streamOwner}|${id.worldId}|${id.realm}|${id.commitId}|${id.eventOrdinal}`;
}

/**
 * Actual PostgreSQL queue. No payload or source credential is given to an unscoped worker.
 * Claim → consumer admit (dedup) → ProgressCommit / acknowledge; obsolete fences LostLease.
 */
export class OutboxQueue {
  constructor(private readonly db: Database) {}

  async claim(
    worker: UUID,
    owner: string,
    limit = 20,
    seconds = 30,
  ): Promise<readonly OutboxLease[]> {
    requireThat(
      Number.isInteger(limit) &&
        limit > 0 &&
        limit <= 100 &&
        Number.isInteger(seconds) &&
        seconds > 0 &&
        seconds <= 300,
      'OUTBOX_LIMIT',
    );
    requireThat(/^[a-z][a-z0-9_.:-]{0,63}$/.test(owner), 'OUTBOX_OWNER');
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{
        world_id: string;
        realm: string;
        outbox_id: string;
        payload_ref: string;
        stream_owner: string;
        fence: string;
        until: string;
        commit_id: string;
        event_ordinal: number;
      }>(
        `WITH ready AS (
           SELECT world_id, realm, outbox_id
           FROM jobs.outbox
           WHERE owner = $1
             AND (state = 'pending' OR (state = 'leased' AND lease_until <= clock_timestamp()))
           ORDER BY outbox_id
           LIMIT $2
           FOR UPDATE SKIP LOCKED
         )
         UPDATE jobs.outbox q
         SET state = 'leased',
             lease_owner = $3,
             fence = q.fence + 1,
             lease_until = clock_timestamp() + ($4::integer * interval '1 second')
         FROM ready
         WHERE q.world_id = ready.world_id
           AND q.realm = ready.realm
           AND q.outbox_id = ready.outbox_id
         RETURNING q.world_id, q.realm, q.outbox_id, q.payload_ref, q.owner AS stream_owner,
                   q.fence::text, q.commit_id, q.event_ordinal,
                   to_char(q.lease_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS until`,
        [owner, limit, worker, seconds],
      );
      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            worldId: uuid(row.world_id),
            realm: row.realm,
            outboxId: uuid(row.outbox_id),
            payloadRef: uuid(row.payload_ref),
            streamOwner: row.stream_owner,
            owner: worker,
            fence: counter(row.fence),
            until: row.until,
            commitId: uuid(row.commit_id),
            eventOrdinal: row.event_ordinal,
          }),
        ),
      );
    } finally {
      sql.release();
    }
  }

  /**
   * Record durable consumer deduplication by stable event identity BEFORE outbox acknowledgement.
   * Identical retries return firstAdmission=false; never double-admit.
   */
  async admitConsumer(lease: OutboxLease, consumer: string): Promise<ConsumerAdmitResult> {
    requireThat(/^[a-z][a-z0-9_.:-]{0,63}$/.test(consumer), 'CONSUMER_ID');
    await this.assertCurrentLease(lease);
    const id = eventIdentity(lease);
    const key = eventKey(id);
    const sql = await this.db.connect();
    try {
      const inserted = await sql.query<{ outbox_id: string }>(
        `INSERT INTO jobs.consumer_admissions(
           consumer, world_id, realm, outbox_id, stream_owner, commit_id, event_ordinal
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (consumer, stream_owner, world_id, realm, commit_id, event_ordinal) DO NOTHING
         RETURNING outbox_id`,
        [
          consumer,
          lease.worldId,
          lease.realm,
          lease.outboxId,
          lease.streamOwner,
          lease.commitId,
          lease.eventOrdinal,
        ],
      );
      return Object.freeze({
        eventKey: key,
        firstAdmission: inserted.length === 1,
      });
    } finally {
      sql.release();
    }
  }

  /**
   * ProgressCommit(leaseToken, progress) — owner-specific cursors stay separate.
   * Obsolete/zombie fence → LostLease; no progress mutation.
   */
  async progressCommit(lease: OutboxLease, cursor: string): Promise<ProgressRecord> {
    requireThat(typeof cursor === 'string' && cursor.length > 0 && cursor.length <= 512, 'PROGRESS_CURSOR');
    await this.assertCurrentLease(lease);
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{ stream_owner: string; cursor: string; fence: string; worker: string }>(
        `INSERT INTO jobs.consumer_cursors(stream_owner, worker, fence, cursor)
         VALUES ($1,$2,$3::bigint,$4)
         ON CONFLICT (stream_owner) DO UPDATE
           SET worker = EXCLUDED.worker,
               fence = EXCLUDED.fence,
               cursor = EXCLUDED.cursor,
               updated_at = clock_timestamp()
           WHERE jobs.consumer_cursors.stream_owner = EXCLUDED.stream_owner
         RETURNING stream_owner, cursor, fence::text, worker::text`,
        [lease.streamOwner, lease.owner, lease.fence, cursor],
      );
      const row = rows[0];
      if (!row) throw new KernelError('LostLease', 'OUTBOX_FENCE_LOST');
      return Object.freeze({
        streamOwner: row.stream_owner,
        cursor: row.cursor,
        fence: counter(row.fence),
        worker: uuid(row.worker),
      });
    } finally {
      sql.release();
    }
  }

  async acknowledge(lease: OutboxLease): Promise<void> {
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{ outbox_id: string }>(
        `UPDATE jobs.outbox
         SET state = 'delivered', lease_owner = NULL, lease_until = NULL
         WHERE world_id = $1 AND realm = $2 AND outbox_id = $3
           AND lease_owner = $4 AND fence = $5::bigint
           AND state = 'leased' AND lease_until > clock_timestamp()
         RETURNING outbox_id`,
        [lease.worldId, lease.realm, lease.outboxId, lease.owner, lease.fence],
      );
      if (rows.length !== 1) throw new KernelError('LostLease', 'OUTBOX_FENCE_LOST');
    } finally {
      sql.release();
    }
  }

  /** Reject zombie workers: lease must still be held by this fence generation. */
  async assertCurrentLease(lease: OutboxLease): Promise<void> {
    const sql = await this.db.connect();
    try {
      const rows = await sql.query<{ outbox_id: string }>(
        `SELECT outbox_id FROM jobs.outbox
         WHERE world_id = $1 AND realm = $2 AND outbox_id = $3
           AND lease_owner = $4 AND fence = $5::bigint
           AND state = 'leased' AND lease_until > clock_timestamp()`,
        [lease.worldId, lease.realm, lease.outboxId, lease.owner, lease.fence],
      );
      if (rows.length !== 1) throw new KernelError('LostLease', 'OUTBOX_FENCE_LOST');
    } finally {
      sql.release();
    }
  }
}
