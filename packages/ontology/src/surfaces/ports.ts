import type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome } from './frame-basis.js';
import type { DiscoverInput, DiscoverOutcome, ExplainOpaqueInput, ExplainOpaqueOutcome } from './discovery.js';
import type {
  ReopenFrameInput,
  FrameReopenOutcome,
  EvidenceDisclosureInput,
  EvidenceDisclosureOutcome,
  FrameDisclosureService,
} from './frame-disclosure.js';

export type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome };
export type { DiscoverInput, DiscoverOutcome, ExplainOpaqueInput, ExplainOpaqueOutcome };
export type { ReopenFrameInput, FrameReopenOutcome, EvidenceDisclosureInput, EvidenceDisclosureOutcome };

export interface FrameBasisPort {
  acquire(input: AcquireFrameBasisInput): Promise<FrameBasisOutcome>;
  resolveOpaqueRef(input: ResolveOpaqueRefInput): Promise<OpaqueRefOutcome>;
}

export interface DiscoveryPort {
  discover(input: DiscoverInput): Promise<DiscoverOutcome>;
  explainOpaqueRef(input: ExplainOpaqueInput): Promise<ExplainOpaqueOutcome>;
}

export interface FrameDisclosurePort {
  reopen(
    input: ReopenFrameInput,
    row: Parameters<FrameDisclosureService['reopen']>[1],
  ): FrameReopenOutcome;
  discloseEvidence(input: EvidenceDisclosureInput): EvidenceDisclosureOutcome;
}
