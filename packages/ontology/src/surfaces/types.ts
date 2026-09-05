import type { UUID, WorldRef } from '../../../kernel/src/ids.js';

export type FrameHead = Readonly<{
  releaseDigest: string;
  generationId: string;
  cellEpoch: string;
  securityRevision: string;
}>;

export type FrameCut = Readonly<Record<string, string>>;

export type SparseRow = Readonly<{
  rowId: UUID;
  domainId: string;
  ordinal: string;
  body: string;
  opaqueRef: string;
}>;

export type FramePin = Readonly<{
  pinRef: string;
  retentionClass: 'evidence' | 'snapshot' | 'sparse';
}>;

export type FrameBasis = Readonly<{
  frameId: UUID;
  head: FrameHead;
  cut: FrameCut;
  planDigest: string;
  rightsBasis: string;
  perspective: string;
  sparseRows: readonly SparseRow[];
  pins: readonly FramePin[];
  incomplete: boolean;
  headDigest: string;
  resultDigest: string;
  firstRun: boolean;
}>;
