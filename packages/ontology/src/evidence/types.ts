import type { UUID, WorldRef } from '../../../kernel/src/ids.js';

export type CaptureState = 'staged' | 'quarantined' | 'failed' | 'admitted';

export type SourceBinding = Readonly<{
  bindingId: UUID;
  world: WorldRef;
  definitionId: string;
  state: 'active' | 'disabled';
  maxBytes: number;
  allowedMediaTypes: readonly string[];
}>;

export type DeclaredCaptureMetadata = Readonly<{
  sourceNamespace: string;
  externalId: string;
  revision: string;
  declaredMediaType: string;
  declaredFileName?: string;
}>;

export type CaptureRef = Readonly<{
  captureId: UUID;
  world: WorldRef;
  bindingId: UUID;
  digest: string;
  blobRef: string;
  state: 'staged';
  size: number;
  mediaType: string;
}>;

export type QuarantinedCapture = Readonly<{
  captureId: UUID;
  world: WorldRef;
  bindingId: UUID;
  state: 'quarantined' | 'failed';
  reason: string;
}>;

export type StageCaptureResult = CaptureRef | QuarantinedCapture;

export type AdmissionReceipt = Readonly<{
  receiptId: UUID;
  evidenceId: UUID;
  claimId: UUID;
  sourceId: UUID;
  captureId: UUID;
  mappingDigest: string;
  commitId: UUID;
  firstAdmission: boolean;
}>;

export type AdmitCaptureInput = Readonly<{
  world: WorldRef;
  bindingId: UUID;
  captureId: UUID;
  mappingDigest: string;
  operationId: UUID;
  principalId: UUID;
  rightsRef: string;
  retentionRef: string;
  domainId: string;
  predicateId: string;
  subjectLabel: string;
}>;

export type EvidenceContentState = 'available' | 'expired' | 'erased' | 'unavailable';

export type EvidenceRef = Readonly<{
  evidenceId: UUID;
  world: WorldRef;
}>;

export type EvidenceGrant = Readonly<{
  grantHash: string;
  principalId: UUID;
  purpose: string;
  securityRevision: number;
  expiresAt: string;
}>;

/** Non-content metadata permitted after expiry/erasure (never bytes or storage locators). */
export type EvidenceReceiptMeta = Readonly<{
  evidenceId: UUID;
  receiptId: UUID;
  rightsRef: string;
  retentionRef: string;
  contentState: EvidenceContentState;
  explanation: 'RETENTION_EXPIRED' | 'ERASED' | 'BYTES_UNAVAILABLE';
}>;

export type AuthorizedStream = Readonly<{
  evidenceId: UUID;
  mediaType: string;
  size: number;
  contentDigest: string;
  bytes: Uint8Array;
  readReceiptId: UUID;
  rightsRef: string;
  retentionRef: string;
}>;

export type ReadEvidenceInput = Readonly<{
  evidence: EvidenceRef;
  grant: EvidenceGrant;
  nowIso: string;
}>;

export type ReadEvidenceResult =
  | Readonly<{ tag: 'Ok'; value: AuthorizedStream }>
  | Readonly<{ tag: 'HistoricalContentUnavailable'; value: EvidenceReceiptMeta }>
  | Readonly<{ tag: 'NotFoundOrDenied' }>
  | Readonly<{ tag: 'Denied'; reason: 'GRANT_EXPIRED' | 'GRANT_REVOKED' | 'RIGHTS_STALE' }>;
