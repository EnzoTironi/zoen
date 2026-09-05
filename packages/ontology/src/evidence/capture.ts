import { createHash } from 'node:crypto';
import type { Cryptography, Database, EvidenceStore } from '../../../contracts/src/ports.js';
import { uuid, type UUID } from '../../../kernel/src/ids.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import type {
  CaptureRef,
  DeclaredCaptureMetadata,
  QuarantinedCapture,
  SourceBinding,
  StageCaptureResult,
} from './types.js';

const DEFAULT_MAX_BYTES = 1_000_000;
const ALLOWED_TYPES = Object.freeze(['text/csv', 'application/json', 'text/plain'] as const);

function isPathTraversal(name: string | undefined): boolean {
  if (!name) return false;
  if (name.includes('\0')) return true;
  if (name.includes('..')) return true;
  if (name.startsWith('/') || name.startsWith('\\')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(name)) return true;
  return false;
}

function looksLikeZipBombHeader(buf: Uint8Array): boolean {
  // PK\x03\x04 or PK\x05\x06 — reject archives in this ticket's staging profile
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

async function collectBounded(
  source: AsyncIterable<Uint8Array> | Uint8Array,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; overflow: boolean }> {
  if (source instanceof Uint8Array) {
    if (source.byteLength > maxBytes) return { bytes: source.subarray(0, maxBytes), overflow: true };
    return { bytes: source, overflow: false };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of source) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      chunks.push(chunk.subarray(0, Math.max(0, maxBytes - (total - chunk.byteLength))));
      return { bytes: concat(chunks), overflow: true };
    }
    chunks.push(chunk);
  }
  return { bytes: concat(chunks), overflow: false };
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

function digestHex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * StageCapture — stream bounded bytes to quarantined object namespace, verify digest,
 * record capture without admitting facts/claims/evidence.
 */
export class CaptureStager {
  constructor(
    private readonly db: Database,
    private readonly store: EvidenceStore,
    private readonly crypto: Cryptography,
  ) {}

  async stageCapture(
    binding: SourceBinding,
    source: AsyncIterable<Uint8Array> | Uint8Array,
    metadata: DeclaredCaptureMetadata,
  ): Promise<StageCaptureResult> {
    requireThat(binding.state === 'active', 'BINDING_DISABLED');
    requireThat(binding.world.realm === 'live' || binding.world.realm === 'evaluation', 'REALM');
    requireThat(/^[a-z][a-z0-9_.:/-]{0,127}$/.test(metadata.sourceNamespace), 'SOURCE_NAMESPACE');
    requireThat(metadata.externalId.length > 0 && metadata.externalId.length <= 256, 'EXTERNAL_ID');
    requireThat(metadata.revision.length > 0 && metadata.revision.length <= 128, 'REVISION');

    const maxBytes = Math.min(binding.maxBytes || DEFAULT_MAX_BYTES, DEFAULT_MAX_BYTES);
    const allowed = binding.allowedMediaTypes.length > 0 ? binding.allowedMediaTypes : ALLOWED_TYPES;
    const captureId = this.crypto.randomId();

    if (isPathTraversal(metadata.declaredFileName)) {
      return this.quarantine(binding, captureId, 'PATH_TRAVERSAL');
    }
    if (!allowed.includes(metadata.declaredMediaType)) {
      return this.quarantine(binding, captureId, 'MEDIA_TYPE_REJECTED');
    }

    const collected = await collectBounded(source, maxBytes);
    if (collected.overflow) {
      return this.quarantine(binding, captureId, 'SIZE_LIMIT');
    }
    if (looksLikeZipBombHeader(collected.bytes)) {
      return this.quarantine(binding, captureId, 'ARCHIVE_REJECTED');
    }

    // Observed type must match declared for this bounded profile (CSV/JSON/text).
    const observed = observeMediaType(collected.bytes, metadata.declaredMediaType);
    if (observed !== metadata.declaredMediaType) {
      return this.quarantine(binding, captureId, 'MEDIA_TYPE_MISMATCH');
    }

    const digest = digestHex(collected.bytes);
    let artifact;
    try {
      artifact = await this.store.putImmutable(binding.world, captureId, collected.bytes, metadata.declaredMediaType);
    } catch (error: unknown) {
      const reason =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code: string }).code)
          : 'OBJECT_STORE_FAILED';
      return this.quarantine(binding, captureId, reason);
    }

    if (artifact.sha256 !== digest) {
      return this.quarantine(binding, captureId, 'DIGEST_MISMATCH');
    }

    const sql = await this.db.connect();
    let persistedId = captureId;
    let persistedBlob = artifact.key;
    let persistedSize = collected.bytes.byteLength;
    try {
      const inserted = await sql.query<{ capture_id: string; blob_ref: string; size_bytes: string }>(
        `INSERT INTO ontology.captures(
           world_id, realm, capture_id, binding_id, source_namespace, external_id, revision,
           blob_ref, digest, size_bytes, media_type, state
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'staged')
         ON CONFLICT (world_id, realm, binding_id, external_id, revision, digest)
         DO UPDATE SET state = ontology.captures.state
         RETURNING capture_id, blob_ref, size_bytes::text`,
        [
          binding.world.worldId,
          binding.world.realm,
          captureId,
          binding.bindingId,
          metadata.sourceNamespace,
          metadata.externalId,
          metadata.revision,
          artifact.key,
          digest,
          collected.bytes.byteLength,
          metadata.declaredMediaType,
        ],
      );
      const row = inserted[0];
      if (!row) return this.quarantine(binding, captureId, 'CAPTURE_PERSIST_FAILED');
      persistedId = uuid(row.capture_id);
      persistedBlob = row.blob_ref;
      persistedSize = Number(row.size_bytes);
    } catch {
      return this.quarantine(binding, captureId, 'CAPTURE_PERSIST_FAILED');
    } finally {
      sql.release();
    }

    const staged: CaptureRef = Object.freeze({
      captureId: persistedId,
      world: binding.world,
      bindingId: binding.bindingId,
      digest,
      blobRef: persistedBlob,
      state: 'staged' as const,
      size: persistedSize,
      mediaType: metadata.declaredMediaType,
    });
    return staged;
  }

  private async quarantine(
    binding: SourceBinding,
    captureId: UUID,
    reason: string,
  ): Promise<QuarantinedCapture> {
    const sql = await this.db.connect();
    try {
      await sql.query(
        `INSERT INTO ontology.captures(
           world_id, realm, capture_id, binding_id, source_namespace, external_id, revision,
           blob_ref, digest, size_bytes, media_type, state, quarantine_reason
         ) VALUES ($1,$2,$3,$4,'quarantine','none','0',NULL,NULL,0,'application/octet-stream','quarantined',$5)
         ON CONFLICT DO NOTHING`,
        [binding.world.worldId, binding.world.realm, captureId, binding.bindingId, reason],
      );
    } catch {
      // Best-effort quarantine record; never invent success.
    } finally {
      sql.release();
    }
    return Object.freeze({
      captureId,
      world: binding.world,
      bindingId: binding.bindingId,
      state: 'quarantined' as const,
      reason,
    });
  }
}

function observeMediaType(bytes: Uint8Array, declared: string): string {
  if (declared === 'text/csv') {
    // Accept UTF-8 text without NULs as CSV candidate for this profile.
    if (bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127) || b >= 128)) {
      return 'text/csv';
    }
    return 'application/octet-stream';
  }
  if (declared === 'application/json') {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      JSON.parse(text);
      return 'application/json';
    } catch {
      return 'application/octet-stream';
    }
  }
  if (declared === 'text/plain') {
    if (bytes.every((b) => b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127) || b >= 128)) {
      return 'text/plain';
    }
  }
  return 'application/octet-stream';
}

export function isStaged(result: StageCaptureResult): result is CaptureRef {
  return result.state === 'staged';
}

export function isQuarantined(result: StageCaptureResult): result is QuarantinedCapture {
  return result.state === 'quarantined' || result.state === 'failed';
}
