import type { CaptureRef, DeclaredCaptureMetadata, QuarantinedCapture, SourceBinding, StageCaptureResult } from './types.js';

export type { CaptureRef, DeclaredCaptureMetadata, QuarantinedCapture, SourceBinding, StageCaptureResult };

export type CaptureByteSource = AsyncIterable<Uint8Array> | Uint8Array;

export interface StageCapturePort {
  stageCapture(
    binding: SourceBinding,
    bytes: CaptureByteSource,
    metadata: DeclaredCaptureMetadata,
  ): Promise<StageCaptureResult>;
}
