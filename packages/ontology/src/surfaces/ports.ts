import type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome } from './frame-basis.js';
import type { DiscoverInput, DiscoverOutcome, ExplainOpaqueInput, ExplainOpaqueOutcome } from './discovery.js';

export type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome };
export type { DiscoverInput, DiscoverOutcome, ExplainOpaqueInput, ExplainOpaqueOutcome };

export interface FrameBasisPort {
  acquire(input: AcquireFrameBasisInput): Promise<FrameBasisOutcome>;
  resolveOpaqueRef(input: ResolveOpaqueRefInput): Promise<OpaqueRefOutcome>;
}

export interface DiscoveryPort {
  discover(input: DiscoverInput): Promise<DiscoverOutcome>;
  explainOpaqueRef(input: ExplainOpaqueInput): Promise<ExplainOpaqueOutcome>;
}
