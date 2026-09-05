import { createHash } from 'node:crypto';
import type {
  SemanticCallRequest,
  SemanticClientPort,
  SemanticIngressSurface,
  ExecutorEntryWitness,
} from '../../../contracts/src/semantic-client.js';
import type { SemanticResult, VerifiedContext } from '../../../contracts/src/semantic.js';
import { parseEnvelope } from '../../../contracts/src/semantic.js';
import { KernelError, toPublicFailure } from '../../../kernel/src/result.js';
import {
  SemanticDispatcher,
  contractDigestFor,
  type TransportInvoke,
} from './dispatch.js';

export const EXECUTOR_BINDING_IMPL = 'executor-binding-v1';

export type BoundIngressOptions = Readonly<{
  /** When set, records opaque entry witnesses for component tests (no PII). */
  witnessSink?: (entry: ExecutorEntryWitness) => void;
}>;

const URL_RE = /^(https?:\/\/|s3:\/\/|postgres(ql)?:\/\/)/i;

/**
 * Binds every structured ingress (web / CLI / trusted internal) to the existing
 * SPEC-007 SemanticDispatcher. Does not create a second dispatch engine.
 */
export class BoundSemanticClient implements SemanticClientPort {
  constructor(
    private readonly dispatcher: SemanticDispatcher,
    private readonly releaseDigest: string,
    private readonly options: BoundIngressOptions = {},
  ) {}

  async call(request: SemanticCallRequest, context: VerifiedContext): Promise<SemanticResult> {
    try {
      // Reject client-supplied identity / credentials / raw SQL before repository access.
      if (request.clientPrincipalId !== undefined && String(request.clientPrincipalId).length > 0) {
        throw new KernelError('Denied', 'CLIENT_PRINCIPAL_FORBIDDEN');
      }
      if (request.sourceUrl !== undefined && String(request.sourceUrl).length > 0) {
        throw new KernelError('Denied', 'SOURCE_URL_FORBIDDEN');
      }
      if (request.rawSql !== undefined && String(request.rawSql).length > 0) {
        throw new KernelError('Denied', 'RAW_SQL_FORBIDDEN');
      }
      if (request.invokeMethod !== undefined && String(request.invokeMethod).length > 0) {
        throw new KernelError('Denied', 'UNREGISTERED_INVOKE');
      }

      const surface = request.surface;
      const transport: TransportInvoke['transport'] =
        surface === 'cli' ? 'cli' : 'web'; // internal shares web transport class at dispatcher

      // Peek envelope for witness (opaque IDs / digests only).
      let operation = '';
      let operationId = '';
      try {
        const preview = parseEnvelope(request.envelopeBytes);
        operation = preview.operation;
        operationId = preview.operationId;
      } catch {
        // Dispatcher will map parse failures; still attempt invoke for stable envelope.
      }

      if (this.options.witnessSink && operation.length > 0) {
        const digest =
          request.expectedContractDigest ??
          (operation ? contractDigestFor(operation, this.releaseDigest) : null);
        this.options.witnessSink(
          Object.freeze({
            surface,
            operation,
            operationId,
            contractDigest: digest,
            enteredDispatch: true,
            modelInvoked: false,
          }),
        );
      }

      const invoke: TransportInvoke = {
        transport,
        envelopeBytes: request.envelopeBytes,
        ...(request.expectedContractDigest !== undefined
          ? { expectedContractDigest: request.expectedContractDigest }
          : {}),
      };

      // Verified context is server-bound; surface adapters must not invent principal.
      const ctx = Object.freeze({
        ...context,
        transport: surface === 'cli' ? 'cli' : surface === 'web' ? 'web' : context.transport,
      }) as VerifiedContext;

      return await this.dispatcher.invoke(invoke, ctx);
    } catch (error) {
      return toPublicFailure(error);
    }
  }
}

/** Web surface adapter — transport only; same registration table as CLI/internal. */
export function webIngress(
  client: SemanticClientPort,
  envelopeBytes: Uint8Array,
  context: VerifiedContext,
  expectedContractDigest?: string,
): Promise<SemanticResult> {
  return client.call(
    {
      surface: 'web',
      envelopeBytes,
      ...(expectedContractDigest !== undefined ? { expectedContractDigest } : {}),
    },
    context,
  );
}

/** CLI surface adapter — same handlers / idempotency namespace as web. */
export function cliIngress(
  client: SemanticClientPort,
  envelopeBytes: Uint8Array,
  context: VerifiedContext,
  expectedContractDigest?: string,
): Promise<SemanticResult> {
  return client.call(
    {
      surface: 'cli',
      envelopeBytes,
      ...(expectedContractDigest !== undefined ? { expectedContractDigest } : {}),
    },
    context,
  );
}

/** Trusted internal adapter — still enters SPEC-007 dispatcher, never a private SQL path. */
export function internalIngress(
  client: SemanticClientPort,
  envelopeBytes: Uint8Array,
  context: VerifiedContext,
  expectedContractDigest?: string,
): Promise<SemanticResult> {
  return client.call(
    {
      surface: 'internal',
      envelopeBytes,
      ...(expectedContractDigest !== undefined ? { expectedContractDigest } : {}),
    },
    context,
  );
}

export function bindSemanticClient(
  dispatcher: SemanticDispatcher,
  releaseDigest: string,
  options?: BoundIngressOptions,
): BoundSemanticClient {
  return new BoundSemanticClient(dispatcher, releaseDigest, options ?? {});
}

/** Opaque production log fields — digests and IDs only, never principals or payloads. */
export function opaqueEntryDigest(witness: ExecutorEntryWitness): string {
  return createHash('sha256')
    .update(
      `${EXECUTOR_BINDING_IMPL}|${witness.surface}|${witness.operation}|${witness.operationId}|${witness.contractDigest ?? ''}`,
      'utf8',
    )
    .digest('hex');
}

export function looksLikeSourceUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

export type { SemanticIngressSurface, ExecutorEntryWitness };
