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
