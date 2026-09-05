/** Surfaces module — Frame basis, dispatch, authorized discovery (SPEC-007). */
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
export type { FrameBasisPort, DiscoveryPort } from './ports.js';
export type {
  FrameHead,
  FrameCut,
  SparseRow,
  FramePin,
  FrameBasis,
} from './types.js';

export { SemanticExecutor, SemanticDispatcher, DISPATCH_IMPL, CONTRACT_DIGEST_IMPL, contractDigestFor } from './dispatch.js';
export type { TransportInvoke } from './dispatch.js';

export {
  DiscoveryService,
  DISCOVERY_IMPL,
  DISCOVERY_FIELDS,
  discoveryLeakScan,
  buildOpaqueEvidenceRef,
  asMembership,
} from './discovery.js';
export type {
  DiscoveryFieldDef,
  EvidenceDeepLink,
  FieldExplanation,
  AuthorizedDiscoveryManifest,
  DiscoverInput,
  DiscoverOutcome,
  ExplainOpaqueInput,
  ExplainOpaqueOutcome,
} from './discovery.js';
