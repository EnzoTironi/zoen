import type { SemanticResult, VerifiedContext } from './semantic.js';

/**
 * Server-side SemanticClient port (SPEC-050 / ZN-0291).
 * Transports adapt into this; identity comes only from verified context.
 * Does not create a second dispatcher — implementations must delegate to SPEC-007.
 */
export type SemanticIngressSurface = 'web' | 'cli' | 'internal';

export type SemanticCallRequest = Readonly<{
  surface: SemanticIngressSurface;
  envelopeBytes: Uint8Array;
  /** Optional pin to released contract; mismatch => ContractChanged. */
  expectedContractDigest?: string;
  /** Forbidden escape hatch — any non-empty value is rejected before dispatch. */
  invokeMethod?: string;
  rawSql?: string;
  /** Client-supplied principal is never trusted; presence rejects before repository access. */
  clientPrincipalId?: string;
  /** Client-supplied source URL is never accepted as authority ingress. */
  sourceUrl?: string;
}>;

export interface SemanticClientPort {
  call(request: SemanticCallRequest, context: VerifiedContext): Promise<SemanticResult>;
}

export type ExecutorEntryWitness = Readonly<{
  surface: SemanticIngressSurface;
  operation: string;
  operationId: string;
  contractDigest: string | null;
  enteredDispatch: true;
  modelInvoked: false;
}>;
