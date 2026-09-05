import type { Cryptography, Database, EvidenceStore, SqlConnection, StoredArtifact } from '../../../contracts/src/ports.js';
import { uuid } from '../../../kernel/src/ids.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import type {
  AuthorizedStream,
  EvidenceReceiptMeta,
  ReadEvidenceInput,
  ReadEvidenceResult,
} from './types.js';

type DisclosureRow = {
  evidence_id: string;
  content_digest: string;
  size_bytes: string;
  media_type: string;
  object_key: string;
  rights_ref: string;
  retention_ref: string;
  content_state: string;
  retention_expires_at: string | null;
  erased_at: string | null;
  blob_version_id: string | null;
  receipt_id: string;
  capture_id: string;
  security_basis: string;
};

type WorldRow = { security_revision: string };
type GrantRow = {
  grant_hash: string;
  principal_id: string;
  purpose: string;
  expires_at: string;
  security_revision: string;
};

/**
 * ReadEvidence — resolve opaque EvidenceRef through Ontology after current
 * disclosure checks. Never returns storage locators. Expired/erased content
 * yields HistoricalContentUnavailable with permitted non-content metadata.
 */
export class EvidenceReader {
  constructor(
    private readonly db: Database,
    private readonly store: EvidenceStore,
    private readonly crypto: Cryptography,
  ) {}

  async readEvidence(input: ReadEvidenceInput): Promise<ReadEvidenceResult> {
    requireThat(/^[a-f0-9]{64}$/.test(input.grant.grantHash), 'GRANT_HASH');
    requireThat(input.grant.purpose.length > 0 && input.grant.purpose.length <= 128, 'PURPOSE');
    requireThat(Number.isFinite(Date.parse(input.nowIso)), 'NOW_ISO');
    requireThat(Number.isFinite(Date.parse(input.grant.expiresAt)), 'GRANT_EXPIRES');

    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true), set_config('zoen.principal_id',$3,true)", [
        input.evidence.world.worldId,
        input.evidence.world.realm,
        input.grant.principalId,
      ]);

      const worlds = await sql.query<WorldRow>(
        `SELECT security_revision::text
         FROM ontology.worlds
         WHERE world_id=$1 AND realm=$2`,
        [input.evidence.world.worldId, input.evidence.world.realm],
      );
      if (!worlds[0]) return Object.freeze({ tag: 'NotFoundOrDenied' as const });

      const worldSec = Number(worlds[0].security_revision);
      const nowMs = Date.parse(input.nowIso);
      const grantExpMs = Date.parse(input.grant.expiresAt);

      // Current grant must exist in authority storage and match the presented claim.
      const grants = await sql.query<GrantRow>(
        `SELECT grant_hash, principal_id::text, purpose, expires_at::text, security_revision::text
         FROM ontology.grants
         WHERE grant_hash=$1 AND world_id=$2 AND realm=$3`,
        [input.grant.grantHash, input.evidence.world.worldId, input.evidence.world.realm],
      );
      const grantRow = grants[0];
      if (!grantRow) return Object.freeze({ tag: 'NotFoundOrDenied' as const });
      if (grantRow.principal_id !== input.grant.principalId) {
        return Object.freeze({ tag: 'NotFoundOrDenied' as const });
      }
      if (grantExpMs <= nowMs || Date.parse(grantRow.expires_at) <= nowMs) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'GRANT_EXPIRED' as const });
      }
      if (Number(grantRow.security_revision) < worldSec || input.grant.securityRevision < worldSec) {
        return Object.freeze({ tag: 'Denied' as const, reason: 'GRANT_REVOKED' as const });
      }

      const rows = await sql.query<DisclosureRow>(
        `SELECT e.evidence_id::text, e.content_digest, e.size_bytes::text, e.media_type, e.object_key,
                a.rights_ref, a.retention_ref, a.content_state,
                a.retention_expires_at::text, a.erased_at::text, a.blob_version_id,
                a.receipt_id::text, a.capture_id::text, a.security_basis::text
         FROM ontology.evidence e
         JOIN ontology.source_admissions a
           ON a.world_id=e.world_id AND a.realm=e.realm AND a.evidence_id=e.evidence_id
         WHERE e.world_id=$1 AND e.realm=$2 AND e.evidence_id=$3
         LIMIT 1`,
        [input.evidence.world.worldId, input.evidence.world.realm, input.evidence.evidenceId],
      );
      const row = rows[0];
      if (!row) return Object.freeze({ tag: 'NotFoundOrDenied' as const });

      // Stale rights basis vs current world security → re-check fails closed.
      if (Number(row.security_basis) < worldSec) {
        await this.recordReceipt(sql, input, row, 'denied');
        return Object.freeze({ tag: 'Denied' as const, reason: 'RIGHTS_STALE' as const });
      }

      if (row.erased_at || row.content_state === 'erased') {
        const meta = receiptMeta(row, 'ERASED');
        await this.recordReceipt(sql, input, row, 'erased');
        return Object.freeze({ tag: 'HistoricalContentUnavailable' as const, value: meta });
      }

      if (
        row.content_state === 'expired' ||
        (row.retention_expires_at !== null && Date.parse(row.retention_expires_at) <= nowMs)
      ) {
        const meta = receiptMeta(row, 'RETENTION_EXPIRED');
        await this.recordReceipt(sql, input, row, 'expired');
        return Object.freeze({ tag: 'HistoricalContentUnavailable' as const, value: meta });
      }

      if (!row.object_key || !row.content_digest) {
        const meta = receiptMeta(row, 'BYTES_UNAVAILABLE');
        await this.recordReceipt(sql, input, row, 'unavailable');
        return Object.freeze({ tag: 'HistoricalContentUnavailable' as const, value: meta });
      }

      const artifact: StoredArtifact = Object.freeze({
        key: row.object_key,
        sha256: row.content_digest,
        size: row.size_bytes,
        mediaType: row.media_type,
        versionId: row.blob_version_id && row.blob_version_id.length > 0 ? row.blob_version_id : 'latest',
      });

      let bytes: Uint8Array;
      try {
        bytes = await this.store.readImmutable(artifact);
      } catch (error: unknown) {
        if (isHistorical(error)) {
          const meta = receiptMeta(row, 'BYTES_UNAVAILABLE');
          await this.recordReceipt(sql, input, row, 'unavailable');
          return Object.freeze({ tag: 'HistoricalContentUnavailable' as const, value: meta });
        }
        throw error;
      }

      // Defense: never surface locators even if store returns them somehow.
      const readReceiptId = this.crypto.randomId();
      await this.recordReceipt(sql, input, row, 'authorized', readReceiptId);

      const stream: AuthorizedStream = Object.freeze({
        evidenceId: uuid(row.evidence_id),
        mediaType: row.media_type,
        size: bytes.byteLength,
        contentDigest: row.content_digest,
        bytes,
        readReceiptId,
        rightsRef: row.rights_ref,
        retentionRef: row.retention_ref,
      });
      return Object.freeze({ tag: 'Ok' as const, value: stream });
    } finally {
      sql.release();
    }
  }

  private async recordReceipt(
    sql: SqlConnection,
    input: ReadEvidenceInput,
    row: DisclosureRow,
    outcome: 'authorized' | 'expired' | 'erased' | 'denied' | 'unavailable',
    receiptId = this.crypto.randomId(),
  ): Promise<void> {
    await sql.query(
      `INSERT INTO ontology.evidence_read_receipts(
         world_id, realm, receipt_id, evidence_id, grant_hash, principal_id, outcome, rights_cut
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        input.evidence.world.worldId,
        input.evidence.world.realm,
        receiptId,
        row.evidence_id,
        input.grant.grantHash,
        input.grant.principalId,
        outcome,
        `${row.rights_ref}|sec=${row.security_basis}`,
      ],
    );
  }
}

function receiptMeta(
  row: DisclosureRow,
  explanation: EvidenceReceiptMeta['explanation'],
): EvidenceReceiptMeta {
  return Object.freeze({
    evidenceId: uuid(row.evidence_id),
    receiptId: uuid(row.receipt_id),
    rightsRef: row.rights_ref,
    retentionRef: row.retention_ref,
    contentState:
      explanation === 'ERASED'
        ? ('erased' as const)
        : explanation === 'RETENTION_EXPIRED'
          ? ('expired' as const)
          : ('unavailable' as const),
    explanation,
  });
}

function isHistorical(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'tag' in error &&
    ((error as { tag: string }).tag === 'HistoricalContentUnavailable' ||
      (error as { tag: string }).tag === 'Unavailable')
  );
}

void KernelError;
