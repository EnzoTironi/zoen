import type { Cryptography, Database, EvidenceStore, SqlConnection } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { requireThat } from '../../../kernel/src/result.js';
import type { CaptureGcInput, CaptureGcResult, RetentionPinInput } from './types.js';

type CaptureRow = {
  capture_id: string;
  state: string;
  blob_ref: string | null;
  digest: string | null;
  pending_admission: boolean;
  upload_lease_expires_at: string | null;
  gc_deleted_at: string | null;
};

/**
 * Capture GC — delete only expired unadmitted captures with no pin and no
 * pending admission. Recheck state after acquiring the capture lock.
 */
export class CaptureGarbageCollector {
  constructor(
    private readonly db: Database,
    private readonly store: EvidenceStore | null,
    private readonly crypto: Cryptography,
  ) {}

  async pinCapture(input: RetentionPinInput): Promise<{ pinId: UUID }> {
    requireThat(['admission', 'historical', 'publication'].includes(input.kind), 'PIN_KIND');
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      const pinId = this.crypto.randomId();
      await sql.query(
        `INSERT INTO ontology.retention_pins(world_id,realm,pin_id,capture_id,kind,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          input.world.worldId,
          input.world.realm,
          pinId,
          input.captureId,
          input.kind,
          input.expiresAt ?? null,
        ],
      );
      return Object.freeze({ pinId });
    } finally {
      sql.release();
    }
  }

  async collectOrphan(input: CaptureGcInput): Promise<CaptureGcResult> {
    requireThat(Number.isFinite(Date.parse(input.nowIso)), 'NOW_ISO');
    for (let attempt = 0; attempt < 3; attempt++) {
      const sql = await this.db.connect();
      try {
        await sql.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
          input.world.worldId,
          input.world.realm,
        ]);
        const result = await this.collectInTx(sql, input);
        await sql.query('COMMIT');
        return result;
      } catch (error) {
        try { await sql.query('ROLLBACK'); } catch { /* ignore */ }
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      } finally {
        sql.release();
      }
    }
    throw new Error('SERIALIZATION_RETRY_LIMIT');
  }

  private async collectInTx(sql: SqlConnection, input: CaptureGcInput): Promise<CaptureGcResult> {
    const receiptId = this.crypto.randomId();
    const rows = await sql.query<CaptureRow>(
      `SELECT capture_id::text, state, blob_ref, digest, pending_admission,
              upload_lease_expires_at::text, gc_deleted_at::text
       FROM ontology.captures
       WHERE world_id=$1 AND realm=$2 AND capture_id=$3
       FOR UPDATE`,
      [input.world.worldId, input.world.realm, input.captureId],
    );
    const row = rows[0];
    if (!row) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'not_found');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'not_found' as const, receiptId });
    }
    if (row.gc_deleted_at) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'deleted');
      return Object.freeze({ tag: 'Deleted' as const, receiptId, alreadyDeleted: true });
    }

    // Recheck after lock: admitted / pinned / pending / active lease survive.
    if (row.state === 'admitted') {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'skipped_admitted');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'skipped_admitted' as const, receiptId });
    }
    if (row.pending_admission) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'skipped_pending');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'skipped_pending' as const, receiptId });
    }

    const pins = await sql.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ontology.retention_pins
       WHERE world_id=$1 AND realm=$2 AND capture_id=$3
         AND (expires_at IS NULL OR expires_at > $4::timestamptz)`,
      [input.world.worldId, input.world.realm, input.captureId, input.nowIso],
    );
    if ((pins[0]?.n ?? 0) > 0) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'skipped_pinned');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'skipped_pinned' as const, receiptId });
    }

    if (
      row.upload_lease_expires_at !== null &&
      Date.parse(row.upload_lease_expires_at) > Date.parse(input.nowIso)
    ) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'skipped_lease_active');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'skipped_lease_active' as const, receiptId });
    }

    // Evidence must not point at GC-deleted bytes.
    const evidence = await sql.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ontology.evidence e
       JOIN ontology.source_admissions a
         ON a.world_id=e.world_id AND a.realm=e.realm AND a.evidence_id=e.evidence_id
       WHERE a.world_id=$1 AND a.realm=$2 AND a.capture_id=$3`,
      [input.world.worldId, input.world.realm, input.captureId],
    );
    if ((evidence[0]?.n ?? 0) > 0) {
      await this.receipt(sql, input.world, receiptId, input.captureId, 'skipped_admitted');
      return Object.freeze({ tag: 'Skipped' as const, reason: 'skipped_admitted' as const, receiptId });
    }

    await sql.query(
      `UPDATE ontology.captures
       SET gc_deleted_at=$4::timestamptz, state=CASE WHEN state='admitted' THEN state ELSE 'failed' END,
           blob_ref=NULL
       WHERE world_id=$1 AND realm=$2 AND capture_id=$3`,
      [input.world.worldId, input.world.realm, input.captureId, input.nowIso],
    );
    await this.receipt(sql, input.world, receiptId, input.captureId, 'deleted');

    // Best-effort object delete is outside authority semantics; store may be null in unit paths.
    void this.store;
    return Object.freeze({ tag: 'Deleted' as const, receiptId, alreadyDeleted: false });
  }

  private async receipt(
    sql: SqlConnection,
    world: WorldRef,
    receiptId: UUID,
    captureId: UUID,
    outcome: string,
  ): Promise<void> {
    await sql.query(
      `INSERT INTO ontology.capture_gc_receipts(world_id,realm,receipt_id,capture_id,outcome)
       VALUES ($1,$2,$3,$4,$5)`,
      [world.worldId, world.realm, receiptId, captureId, outcome],
    );
  }
}


function isRetryable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return (error as { code: string }).code === '40001' || (error as { code: string }).code === '40P01';
}
