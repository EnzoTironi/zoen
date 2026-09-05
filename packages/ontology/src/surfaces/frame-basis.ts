import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import type { FrameBasis, FrameCut, FrameHead, FramePin, SparseRow } from './types.js';

export const FRAME_BASIS_IMPL = 'frame-basis-v1';
export const DEFAULT_SPARSE_LIMIT = 64;

export type AcquireFrameBasisInput = Readonly<{
  world: WorldRef;
  operationId: UUID;
  principalId: UUID;
  purpose: string;
  perspective: string;
  domainId: string;
  /** Hard cap on sparse rows; overflow => incomplete, never silent truncation as complete. */
  rowLimit?: number;
  /** Optional barrier callback invoked while the REPEATABLE READ snapshot is still open (tests only). */
  whileSnapshotOpen?: () => Promise<void>;
}>;

export type ResolveOpaqueRefInput = Readonly<{
  world: WorldRef;
  principalId: UUID;
  opaqueRef: string;
}>;

export type FrameBasisOk = Readonly<{ tag: 'Ok'; value: FrameBasis }>;
export type FrameBasisStale = Readonly<{ tag: 'Stale'; reason: 'SNAPSHOT_CONFLICT' }>;
export type FrameBasisDenied = Readonly<{
  tag: 'Denied';
  reason: 'INVALID_INPUT' | 'NOT_FOUND_OR_DENIED' | 'UNSUPPORTED_LIMIT';
  detail?: string;
}>;
export type FrameBasisOutcome = FrameBasisOk | FrameBasisStale | FrameBasisDenied;

export type OpaqueRefOutcome =
  | Readonly<{ tag: 'Ok'; value: SparseRow }>
  | Readonly<{ tag: 'Denied'; reason: 'NOT_FOUND_OR_DENIED' | 'INVALID_INPUT' }>;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function isRetryable(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return code === '40001' || code === '40P01';
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

/**
 * Bounded Frame basis acquisition (SPEC-007 / ZN-0042).
 * Opens one REPEATABLE READ snapshot for head/rights/domain cut/sparse/admitted
 * refs, materializes pins + plan digest, then closes the TX before any unbounded work.
 */
export class FrameBasisService {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async acquire(input: AcquireFrameBasisInput): Promise<FrameBasisOutcome> {
    if (!input.purpose || input.purpose.length > 64) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'PURPOSE' });
    }
    if (!input.perspective || input.perspective.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'PERSPECTIVE' });
    }
    if (!/^[a-z][a-z0-9_.:-]{0,127}$/.test(input.domainId)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'DOMAIN' });
    }
    const rowLimit = input.rowLimit ?? DEFAULT_SPARSE_LIMIT;
    if (!Number.isInteger(rowLimit) || rowLimit < 1) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const, detail: 'LIMIT' });
    }
    if (rowLimit > 256) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'UNSUPPORTED_LIMIT' as const });
    }

    const opDigest = sha256Text(
      canonicalJson({
        op: 'acquire-frame-basis',
        operationId: String(input.operationId),
        purpose: input.purpose,
        perspective: input.perspective,
        domainId: input.domainId,
        rowLimit,
        impl: FRAME_BASIS_IMPL,
      } as never),
    );

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.acquireOnce(input, opDigest, rowLimit);
      } catch (error: unknown) {
        if (isRetryable(error) && attempt < 2) continue;
        if (isRetryable(error)) {
          return Object.freeze({ tag: 'Stale' as const, reason: 'SNAPSHOT_CONFLICT' as const });
        }
        throw error;
      }
    }
    return Object.freeze({ tag: 'Stale' as const, reason: 'SNAPSHOT_CONFLICT' as const });
  }

  async resolveOpaqueRef(input: ResolveOpaqueRefInput): Promise<OpaqueRefOutcome> {
    if (!input.opaqueRef || input.opaqueRef.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      // Membership required — absence and unauthorized collapse to the same denial (no existence leak).
      const members = await sql.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ontology.memberships
         WHERE world_id=$1 AND realm=$2 AND principal_id=$3 AND state='active'`,
        [input.world.worldId, input.world.realm, input.principalId],
      );
      if (!members[0] || members[0].n < 1) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
      }
      const rows = await sql.query<{
        row_id: string;
        domain_id: string;
        ordinal: string;
        body: string;
        opaque_ref: string;
        admitted: boolean;
      }>(
        `SELECT row_id::text, domain_id, ordinal::text, body, opaque_ref, admitted
         FROM ontology.frame_sparse_rows
         WHERE world_id=$1 AND realm=$2 AND opaque_ref=$3`,
        [input.world.worldId, input.world.realm, input.opaqueRef],
      );
      const row = rows[0];
      if (!row || !row.admitted) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
      }
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          rowId: uuid(row.row_id),
          domainId: row.domain_id,
          ordinal: row.ordinal,
          body: row.body,
          opaqueRef: row.opaque_ref,
        }),
      });
    } finally {
      sql.release();
    }
  }

  /** Test helper: insert admitted sparse row outside Frame acquire. */
  async seedSparseRow(input: {
    world: WorldRef;
    rowId: UUID;
    domainId: string;
    ordinal: number;
    body: string;
    opaqueRef: string;
    admitted?: boolean;
  }): Promise<void> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      await sql.query(
        `INSERT INTO ontology.frame_sparse_rows(
           world_id, realm, row_id, domain_id, ordinal, body, admitted, opaque_ref
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (world_id, realm, opaque_ref) DO UPDATE SET
           body=EXCLUDED.body, ordinal=EXCLUDED.ordinal, admitted=EXCLUDED.admitted`,
        [
          input.world.worldId,
          input.world.realm,
          input.rowId,
          input.domainId,
          input.ordinal,
          input.body,
          input.admitted !== false,
          input.opaqueRef,
        ],
      );
    } finally {
      sql.release();
    }
  }

  /** Test helper: ingest that bumps domain version and adds a sparse row (concurrent with acquire). */
  async ingestSparse(input: {
    world: WorldRef;
    domainId: string;
    rowId: UUID;
    ordinal: number;
    body: string;
    opaqueRef: string;
  }): Promise<void> {
    const sql = await this.db.connect();
    try {
      await sql.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);
      await sql.query(
        `UPDATE ontology.domains SET version = version + 1
         WHERE world_id=$1 AND realm=$2 AND domain_id=$3`,
        [input.world.worldId, input.world.realm, input.domainId],
      );
      await sql.query(
        `INSERT INTO ontology.frame_sparse_rows(
           world_id, realm, row_id, domain_id, ordinal, body, admitted, opaque_ref
         ) VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
        [
          input.world.worldId,
          input.world.realm,
          input.rowId,
          input.domainId,
          input.ordinal,
          input.body,
          input.opaqueRef,
        ],
      );
      await sql.query('COMMIT');
    } catch (error) {
      try {
        await sql.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      sql.release();
    }
  }

  private async loadByOperationDigest(world: WorldRef, opDigest: string): Promise<FrameBasisOutcome | null> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        world.worldId,
        world.realm,
      ]);
      const prior = await sql.query<{ frame_id: string; basis: FrameBasis }>(
        `SELECT frame_id::text, basis
         FROM ontology.frames
         WHERE world_id=$1 AND realm=$2 AND (basis->>'operationDigest')=$3`,
        [world.worldId, world.realm, opDigest],
      );
      if (!prior[0]) return null;
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          ...prior[0].basis,
          frameId: uuid(prior[0].frame_id),
          firstRun: false,
        }),
      });
    } finally {
      sql.release();
    }
  }

  private async acquireOnce(
    input: AcquireFrameBasisInput,
    opDigest: string,
    rowLimit: number,
  ): Promise<FrameBasisOutcome> {
    const sql = await this.db.connect();
    try {
      await sql.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await sql.query("SET LOCAL statement_timeout = '10s'");
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      // Idempotent replay by operation digest stored in basis
      const prior = await sql.query<{ frame_id: string; basis: FrameBasis; head_digest: string; payload: { resultDigest: string } }>(
        `SELECT frame_id::text, basis, head_digest, payload
         FROM ontology.frames
         WHERE world_id=$1 AND realm=$2 AND (basis->>'operationDigest')=$3`,
        [input.world.worldId, input.world.realm, opDigest],
      );
      if (prior[0]) {
        await sql.query('COMMIT');
        const b = prior[0].basis;
        return Object.freeze({
          tag: 'Ok' as const,
          value: Object.freeze({
            ...b,
            frameId: uuid(prior[0].frame_id),
            firstRun: false,
          }),
        });
      }

      const members = await sql.query<{ role: string }>(
        `SELECT role FROM ontology.memberships
         WHERE world_id=$1 AND realm=$2 AND principal_id=$3 AND state='active'`,
        [input.world.worldId, input.world.realm, input.principalId],
      );
      if (!members[0]) {
        await sql.query('ROLLBACK');
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
      }

      const worlds = await sql.query<{
        release_digest: string;
        generation_id: string;
        cell_epoch: string;
        security_revision: string;
      }>(
        `SELECT release_digest, generation_id::text, cell_epoch::text, security_revision::text
         FROM ontology.worlds WHERE world_id=$1 AND realm=$2`,
        [input.world.worldId, input.world.realm],
      );
      const w = worlds[0];
      if (!w) {
        await sql.query('ROLLBACK');
        return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
      }
      const head: FrameHead = Object.freeze({
        releaseDigest: w.release_digest,
        generationId: w.generation_id,
        cellEpoch: w.cell_epoch,
        securityRevision: w.security_revision,
      });

      const versions = await sql.query<{ domain_id: string; version: string }>(
        `SELECT domain_id, version::text FROM ontology.domains
         WHERE world_id=$1 AND realm=$2 ORDER BY domain_id`,
        [input.world.worldId, input.world.realm],
      );
      const cut: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const v of versions) cut[v.domain_id] = v.version;
      const frozenCut: FrameCut = Object.freeze({ ...cut });

      // Fetch limit+1 to detect overflow without silent truncation-as-complete
      const sparse = await sql.query<{
        row_id: string;
        domain_id: string;
        ordinal: string;
        body: string;
        opaque_ref: string;
      }>(
        `SELECT row_id::text, domain_id, ordinal::text, body, opaque_ref
         FROM ontology.frame_sparse_rows
         WHERE world_id=$1 AND realm=$2 AND domain_id=$3 AND admitted=true
         ORDER BY ordinal ASC, row_id ASC
         LIMIT $4`,
        [input.world.worldId, input.world.realm, input.domainId, rowLimit + 1],
      );
      const incomplete = sparse.length > rowLimit;
      const limited = sparse.slice(0, rowLimit);
      const sparseRows = Object.freeze(
        limited.map((r) =>
          Object.freeze({
            rowId: uuid(r.row_id),
            domainId: r.domain_id,
            ordinal: r.ordinal,
            body: r.body,
            opaqueRef: r.opaque_ref,
          }),
        ),
      ) as readonly SparseRow[];

      if (input.whileSnapshotOpen) {
        await input.whileSnapshotOpen();
      }

      const rightsBasis = sha256Text(
        canonicalJson({
          principalId: String(input.principalId),
          role: members[0].role,
          securityRevision: head.securityRevision,
        } as never),
      );
      const pins = Object.freeze([
        Object.freeze({ pinRef: `head:${head.releaseDigest}`, retentionClass: 'snapshot' as const }),
        Object.freeze({
          pinRef: `cut:${sha256Text(canonicalJson(frozenCut as never))}`,
          retentionClass: 'snapshot' as const,
        }),
        ...sparseRows.map((r) =>
          Object.freeze({ pinRef: `sparse:${r.opaqueRef}`, retentionClass: 'sparse' as const }),
        ),
      ]) as readonly FramePin[];
      const planDigest = sha256Text(
        canonicalJson({
          purpose: input.purpose,
          perspective: input.perspective,
          domainId: input.domainId,
          cut: frozenCut,
          sparse: sparseRows.map((r) => ({ id: String(r.rowId), body: r.body, ord: r.ordinal })),
          incomplete,
          impl: FRAME_BASIS_IMPL,
        } as never),
      );
      const headDigest = sha256Text(
        canonicalJson({ head, cut: frozenCut, rightsBasis, planDigest } as never),
      );
      const resultDigest = sha256Text(
        canonicalJson({ headDigest, planDigest, pins: pins.map((p) => p.pinRef), incomplete } as never),
      );

      const frameId = this.crypto.randomId();
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const basisPayload = {
        frameId: String(frameId),
        head,
        cut: frozenCut,
        planDigest,
        rightsBasis,
        perspective: input.perspective,
        sparseRows,
        pins,
        incomplete,
        headDigest,
        resultDigest,
        firstRun: true,
        operationDigest: opDigest,
        operationId: String(input.operationId),
        impl: FRAME_BASIS_IMPL,
      };

      try {
        await sql.query(
          `INSERT INTO ontology.frames(
             world_id, realm, frame_id, principal_id, purpose, head_digest, basis, payload, source_ids, expires_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::uuid[],$10::timestamptz)`,
          [
            input.world.worldId,
            input.world.realm,
            frameId,
            input.principalId,
            input.purpose,
            headDigest,
            JSON.stringify(basisPayload),
            JSON.stringify({ resultDigest, incomplete, planDigest }),
            [],
            expires,
          ],
        );
        for (const pin of pins) {
          await sql.query(
            `INSERT INTO ontology.frame_pins(world_id, realm, frame_id, pin_ref, retention_class)
             VALUES ($1,$2,$3,$4,$5)`,
            [input.world.worldId, input.world.realm, frameId, pin.pinRef, pin.retentionClass],
          );
        }
        await sql.query('COMMIT');
      } catch (error: unknown) {
        try { await sql.query('ROLLBACK'); } catch { /* ignore */ }
        if (isUniqueViolation(error)) {
          const replay = await this.loadByOperationDigest(input.world, opDigest);
          if (replay) return replay;
          return this.acquire(input);
        }
        throw error;
      }

      // Transaction closed — no LLM / unbounded work held the snapshot.
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          frameId,
          head,
          cut: frozenCut,
          planDigest,
          rightsBasis,
          perspective: input.perspective,
          sparseRows,
          pins,
          incomplete,
          headDigest,
          resultDigest,
          firstRun: true,
        }),
      });
    } catch (error: unknown) {
      try {
        await sql.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      sql.release();
    }
  }
}
