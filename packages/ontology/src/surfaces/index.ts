/** Surfaces module — Frame basis acquisition (SPEC-007 / ZN-0042). */
export { FrameBasisService, FRAME_BASIS_IMPL, DEFAULT_SPARSE_LIMIT } from './frame-basis.js';
export type {
  AcquireFrameBasisInput,
  ResolveOpaqueRefInput,
  FrameBasisOk,
  FrameBasisDenied,
  FrameBasisStale,
  FrameBasisOutcome,
  OpaqueRefOutcome,
} from './frame-basis.js';
export type { FrameBasisPort } from './ports.js';
export type {
  FrameHead,
  FrameCut,
  SparseRow,
  FramePin,
  FrameBasis,
} from './types.js';

export { SemanticExecutor, SemanticDispatcher, DISPATCH_IMPL, CONTRACT_DIGEST_IMPL, contractDigestFor } from './dispatch.js';
export type { TransportInvoke } from './dispatch.js';
