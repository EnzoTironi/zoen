import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, GetBucketVersioningCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3';
import type { Cryptography, EvidenceStore, StoredArtifact } from '../../contracts/src/ports.js';
import type { UUID, WorldRef } from '../../kernel/src/ids.js';
import { KernelError, requireThat } from '../../kernel/src/result.js';
/** Actual AWS S3, with immutable-key preconditions and exact object versions. No custom endpoint. */
export class S3EvidenceStore implements EvidenceStore {
  readonly client: S3Client;
  constructor(readonly bucket: string, region: string, readonly owner: string, private readonly crypto: Cryptography) {
    requireThat(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) && /^\d{12}$/.test(owner), 'S3_CONFIGURATION');
    this.client = new S3Client({ region, maxAttempts: 1, useFipsEndpoint: false });
  }
  async verifyBucket(): Promise<void> {
    const version = await this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket, ExpectedBucketOwner: this.owner }));
    const access = await this.client.send(new GetPublicAccessBlockCommand({ Bucket: this.bucket, ExpectedBucketOwner: this.owner }));
    const p = access.PublicAccessBlockConfiguration;
    if (version.Status !== 'Enabled' || !p?.BlockPublicAcls || !p.BlockPublicPolicy || !p.IgnorePublicAcls || !p.RestrictPublicBuckets) throw new KernelError('Blocked', 'S3_BUCKET_NOT_PRIVATE_VERSIONED');
  }
  async putImmutable(world: WorldRef, reference: UUID, bytes: Uint8Array, mediaType: string): Promise<StoredArtifact> {
    requireThat(bytes.byteLength <= 5_000_000, 'ARTIFACT_SIZE');
    const sha256 = await this.crypto.sha256(bytes); const key = `${world.realm}/${world.worldId}/evidence/${reference}/${sha256}`;
    let versionId: string | undefined;
    try {
      const result = await this.client.send(new PutObjectCommand({ Bucket: this.bucket, ExpectedBucketOwner: this.owner, Key: key, Body: bytes,
        IfNoneMatch: '*', ContentType: mediaType, ContentLength: bytes.byteLength, ServerSideEncryption: 'AES256', Metadata: { sha256 } }));
      versionId = result.VersionId;
    } catch (error) {
      // Only a proved precondition failure is reconciled as an existing immutable key.
      if (!(typeof error === 'object' && error !== null && 'name' in error && error.name === 'PreconditionFailed')) throw error;
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, ExpectedBucketOwner: this.owner, Key: key }));
      if (head.Metadata?.['sha256'] !== sha256 || head.ContentLength !== bytes.byteLength || head.ContentType !== mediaType) throw new KernelError('Conflict', 'IMMUTABLE_OBJECT_COLLISION');
      versionId = head.VersionId;
    }
    if (!versionId || versionId === 'null') throw new KernelError('Blocked', 'EXACT_OBJECT_VERSION_REQUIRED');
    return Object.freeze({ key, sha256, size: String(bytes.byteLength), mediaType, versionId });
  }
  async readImmutable(artifact: StoredArtifact): Promise<Uint8Array> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, ExpectedBucketOwner: this.owner, Key: artifact.key, VersionId: artifact.versionId }));
    if (!response.Body || response.ContentLength !== Number(artifact.size) || Number(artifact.size) > 5_000_000) throw new KernelError('HistoricalContentUnavailable', 'ARTIFACT_UNAVAILABLE');
    const bytes = await response.Body.transformToByteArray();
    if (String(bytes.byteLength) !== artifact.size || await this.crypto.sha256(bytes) !== artifact.sha256) throw new KernelError('Unavailable', 'ARTIFACT_INTEGRITY_FAILURE');
    return bytes;
  }
  close(): void { this.client.destroy(); }
}
