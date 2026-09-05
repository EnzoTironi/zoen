import type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome } from './frame-basis.js';

export type { AcquireFrameBasisInput, FrameBasisOutcome, ResolveOpaqueRefInput, OpaqueRefOutcome };

export interface FrameBasisPort {
  acquire(input: AcquireFrameBasisInput): Promise<FrameBasisOutcome>;
  resolveOpaqueRef(input: ResolveOpaqueRefInput): Promise<OpaqueRefOutcome>;
}
