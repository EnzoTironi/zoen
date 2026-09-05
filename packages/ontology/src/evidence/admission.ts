import type { Cryptography, Database, SqlConnection } from '../../../contracts/src/ports.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import type { AdmissionReceipt, AdmitCaptureInput } from './types.js';

type CaptureRow = {
  capture_id: string;
  binding_id: string;
  source_namespace: string;
  external_id: string;
  revision: string;
  blob_ref: string | null;
  digest: string | null;
  size_bytes: string;
  media_type: string;
  state: string;
};

type AdmissionRow = {
  receipt_id: string;
  evidence_id: string;
  claim_id: string;
  source_id: string;
  commit_id: string;
  mapping_digest: string;
};

/**
 * AdmitCapture — map a staged capture into attributed evidence + candidate claim
 * under stable source-admission identity. Identical captures admit once; altered
 * bytes for the same external revision conflict (never silent overwrite).
 */
export class CaptureAdmission {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async admitCapture(input: AdmitCaptureInput): Promise<AdmissionReceipt> {
    requireThat(/^[a-f0-9]{64}$/.test(input.mappingDigest), 'MAPPING_DIGEST');
    requireThat(input.rightsRef.length > 0 && input.rightsRef.length <= 128, 'RIGHTS_REF');
    requireThat(input.retentionRef.length > 0 && input.retentionRef.length <= 128, 'RETENTION_REF');
    requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(input.domainId), 'DOMAIN_ID');
    requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(input.predicateId), 'PREDICATE_ID');
    requireThat(input.subjectLabel.length > 0 && input.subjectLabel.length <= 160, 'SUBJECT_LABEL');

    for (let attempt = 0; attempt < 3; attempt++) {
      const sql = await this.db.connect();
      let committing = false;
      try {
        await sql.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        await sql.query("SET LOCAL statement_timeout = '10s'");
        await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true), set_config('zoen.principal_id',$3,true)", [
          input.world.worldId,
          input.world.realm,
          input.principalId,
        ]);

        const receipt = await this.admitInTx(sql, input);
        committing = true;
        await sql.query('COMMIT');
        return receipt;
      } catch (error) {
        try { await sql.query('ROLLBACK'); } catch { /* ignore */ }
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      } finally {
        sql.release();
      }
      void committing;
    }
    throw new KernelError('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  }

  private async admitInTx(sql: SqlConnection, input: AdmitCaptureInput): Promise<AdmissionReceipt> {
    const captures = await sql.query<CaptureRow>(
      `SELECT capture_id, binding_id, source_namespace, external_id, revision,
              blob_ref, digest, size_bytes::text, media_type, state
       FROM ontology.captures
       WHERE world_id=$1 AND realm=$2 AND capture_id=$3
       FOR UPDATE`,
      [input.world.worldId, input.world.realm, input.captureId],
    );
    const capture = captures[0];
    if (!capture) throw new KernelError('NotFoundOrDenied', 'CAPTURE_NOT_FOUND');
    if (capture.binding_id !== input.bindingId) {
      throw new KernelError('NotFoundOrDenied', 'CAPTURE_BINDING_MISMATCH');
    }
    if (capture.state === 'quarantined' || capture.state === 'failed') {
      throw new KernelError('InvalidInput', 'CAPTURE_NOT_STAGED');
    }
    if (!capture.digest || !capture.blob_ref) {
      throw new KernelError('InvalidInput', 'CAPTURE_MISSING_BYTES');
    }

    // Same external revision with a different durable digest → anomaly / conflict.
    const rivals = await sql.query<{ digest: string; capture_id: string }>(
      `SELECT digest, capture_id::text
       FROM ontology.captures
       WHERE world_id=$1 AND realm=$2 AND binding_id=$3
         AND external_id=$4 AND revision=$5
         AND state = 'admitted'
         AND digest IS NOT NULL AND digest <> $6`,
      [
        input.world.worldId,
        input.world.realm,
        input.bindingId,
        capture.external_id,
        capture.revision,
        capture.digest,
      ],
    );
    if (rivals.length > 0) {
      throw new KernelError('Conflict', 'SOURCE_REVISION_DIGEST_ANOMALY');
    }

    // Stable admission identity: binding + capture + mapping digest.
    const existing = await sql.query<AdmissionRow>(
      `SELECT receipt_id, evidence_id, claim_id, source_id, commit_id, mapping_digest
       FROM ontology.source_admissions
       WHERE world_id=$1 AND realm=$2 AND binding_id=$3 AND capture_id=$4 AND mapping_digest=$5`,
      [input.world.worldId, input.world.realm, input.bindingId, input.captureId, input.mappingDigest],
    );
    if (existing[0]) {
      const row = existing[0];
      return Object.freeze({
        receiptId: uuid(row.receipt_id),
        evidenceId: uuid(row.evidence_id),
        claimId: uuid(row.claim_id),
        sourceId: uuid(row.source_id),
        captureId: input.captureId,
        mappingDigest: row.mapping_digest,
        commitId: uuid(row.commit_id),
        firstAdmission: false,
      });
    }

    // Also dedupe by content identity (binding, external, revision, digest, mapping)
    // so identical captures (same bytes) admit once even across capture_id variants.
    const byContent = await sql.query<AdmissionRow & { capture_id: string }>(
      `SELECT a.receipt_id, a.evidence_id, a.claim_id, a.source_id, a.commit_id, a.mapping_digest, a.capture_id::text
       FROM ontology.source_admissions a
       JOIN ontology.captures c
         ON c.world_id=a.world_id AND c.realm=a.realm AND c.capture_id=a.capture_id
       WHERE a.world_id=$1 AND a.realm=$2 AND a.binding_id=$3 AND a.mapping_digest=$4
         AND c.external_id=$5 AND c.revision=$6 AND c.digest=$7`,
      [
        input.world.worldId,
        input.world.realm,
        input.bindingId,
        input.mappingDigest,
        capture.external_id,
        capture.revision,
        capture.digest,
      ],
    );
    if (byContent[0]) {
      const row = byContent[0];
      // Link this capture as admitted alias without new evidence overwrite.
      await sql.query(
        `UPDATE ontology.captures SET state='admitted'
         WHERE world_id=$1 AND realm=$2 AND capture_id=$3 AND state='staged'`,
        [input.world.worldId, input.world.realm, input.captureId],
      );
      await sql.query(
        `INSERT INTO ontology.source_admissions(
           world_id, realm, binding_id, capture_id, mapping_digest,
           receipt_id, evidence_id, claim_id, source_id, commit_id, operation_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (world_id, realm, binding_id, capture_id, mapping_digest) DO NOTHING`,
        [
          input.world.worldId,
          input.world.realm,
          input.bindingId,
          input.captureId,
          input.mappingDigest,
          row.receipt_id,
          row.evidence_id,
          row.claim_id,
          row.source_id,
          row.commit_id,
          input.operationId,
        ],
      );
      return Object.freeze({
        receiptId: uuid(row.receipt_id),
        evidenceId: uuid(row.evidence_id),
        claimId: uuid(row.claim_id),
        sourceId: uuid(row.source_id),
        captureId: input.captureId,
        mappingDigest: row.mapping_digest,
        commitId: uuid(row.commit_id),
        firstAdmission: false,
      });
    }

    const bindings = await sql.query<{ state: string; definition_id: string }>(
      `SELECT state, definition_id FROM ontology.source_bindings
       WHERE world_id=$1 AND realm=$2 AND binding_id=$3`,
      [input.world.worldId, input.world.realm, input.bindingId],
    );
    const binding = bindings[0];
    if (!binding || binding.state !== 'active') {
      throw new KernelError('NotFoundOrDenied', 'BINDING_NOT_ACTIVE');
    }

    const sourceId = this.crypto.randomId();
    const evidenceId = this.crypto.randomId();
    const claimId = this.crypto.randomId();
    const subjectId = this.crypto.randomId();
    const receiptId = this.crypto.randomId();
    const commitId = this.crypto.randomId();
    const familyId = this.crypto.randomId();

    await sql.query(
      `INSERT INTO ontology.sources(world_id,realm,source_id,family_id,name,visibility,state,created_by)
       VALUES ($1,$2,$3,$4,$5,'shared','active',$6)`,
      [
        input.world.worldId,
        input.world.realm,
        sourceId,
        familyId,
        truncateName(`${capture.source_namespace}:${capture.external_id}`),
        input.principalId,
      ],
    );

    await sql.query(
      `INSERT INTO ontology.subjects(world_id,realm,subject_id,type_id,label)
       VALUES ($1,$2,$3,'record',$4)`,
      [input.world.worldId, input.world.realm, subjectId, input.subjectLabel],
    );

    await sql.query(
      `INSERT INTO ontology.evidence(
         world_id, realm, evidence_id, source_id, object_key, content_digest,
         size_bytes, media_type, object_version
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.world.worldId,
        input.world.realm,
        evidenceId,
        sourceId,
        capture.blob_ref,
        capture.digest,
        Number(capture.size_bytes),
        capture.media_type,
        'capture',
      ],
    );

    const payload = {
      id: claimId,
      subjectId,
      predicateId: input.predicateId,
      sourceId,
      knowledgeVersion: '1',
      world: { worldId: input.world.worldId, realm: input.world.realm },
      captureId: input.captureId,
      mappingDigest: input.mappingDigest,
      externalId: capture.external_id,
      revision: capture.revision,
      digest: capture.digest,
      rightsRef: input.rightsRef,
      retentionRef: input.retentionRef,
      attribution: {
        sourceNamespace: capture.source_namespace,
        bindingId: input.bindingId,
        definitionId: binding.definition_id,
      },
    };

    await sql.query(
      `INSERT INTO ontology.claims(
         world_id, realm, claim_id, subject_id, predicate_id, source_id,
         payload, domain_id, knowledge_version, asserted_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,1,$9)`,
      [
        input.world.worldId,
        input.world.realm,
        claimId,
        subjectId,
        input.predicateId,
        sourceId,
        canonicalJson(payload),
        input.domainId,
        input.principalId,
      ],
    );

    await sql.query(
      `INSERT INTO ontology.claim_evidence(world_id,realm,claim_id,evidence_id)
       VALUES ($1,$2,$3,$4)`,
      [input.world.worldId, input.world.realm, claimId, evidenceId],
    );

    await sql.query(
      `INSERT INTO ontology.source_admissions(
         world_id, realm, binding_id, capture_id, mapping_digest,
         receipt_id, evidence_id, claim_id, source_id, commit_id, operation_id,
         rights_ref, retention_ref
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        input.world.worldId,
        input.world.realm,
        input.bindingId,
        input.captureId,
        input.mappingDigest,
        receiptId,
        evidenceId,
        claimId,
        sourceId,
        commitId,
        input.operationId,
        input.rightsRef,
        input.retentionRef,
      ],
    );

    await sql.query(
      `UPDATE ontology.captures SET state='admitted'
       WHERE world_id=$1 AND realm=$2 AND capture_id=$3`,
      [input.world.worldId, input.world.realm, input.captureId],
    );

    return Object.freeze({
      receiptId,
      evidenceId,
      claimId,
      sourceId,
      captureId: input.captureId,
      mappingDigest: input.mappingDigest,
      commitId,
      firstAdmission: true,
    });
  }
}

function truncateName(value: string): string {
  return value.length <= 120 ? value : value.slice(0, 120);
}

function isRetryable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return (error as { code: string }).code === '40001' || (error as { code: string }).code === '40P01';
}
