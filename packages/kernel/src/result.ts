/** The public outcome algebra. No exception text or SQL/provider error crosses it. */
export const failureTags = [
  'InvalidInput', 'Unsupported', 'Denied', 'NotFoundOrDenied', 'Conflict', 'Stale',
  'PreparationStale', 'Expired', 'Blocked', 'Unknown', 'Unavailable',
  'HistoricalContentUnavailable', 'QuotaExceeded', 'LostLease',
  'RetryableInfrastructureFailure', 'ContractChanged',
] as const;
export type FailureTag = (typeof failureTags)[number];
export type Failure = Readonly<{ tag: FailureTag; code: string }>;
export type Result<T> = Readonly<{ tag: 'Ok'; value: T }> | Failure;
export function ok<T>(value: T): Result<T> { return Object.freeze({ tag: 'Ok', value }); }
export function fail(tag: FailureTag, code: string): Failure {
  if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(code)) throw new Error('Invalid public error code');
  return Object.freeze({ tag, code });
}
/** Internal control error. `code` is an authored constant, never user input. */
export class KernelError extends Error {
  readonly tag: FailureTag;
  readonly code: string;
  constructor(tag: FailureTag, code: string) {
    super(code); this.name = 'KernelError'; this.tag = tag; this.code = fail(tag, code).code;
  }
}
export function requireThat(condition: unknown, code: string): asserts condition {
  if (!condition) throw new KernelError('InvalidInput', code);
}
export function toPublicFailure(error: unknown): Failure {
  return error instanceof KernelError ? fail(error.tag, error.code) : fail('Unavailable', 'INTERNAL_FAILURE');
}
export function httpStatus(result: Result<unknown>): number {
  switch (result.tag) {
    case 'Ok': case 'Unknown': return 200;
    case 'InvalidInput': return 400;
    case 'Denied': return 403;
    case 'NotFoundOrDenied': return 404;
    case 'Conflict': case 'Stale': case 'PreparationStale': case 'ContractChanged': case 'LostLease': return 409;
    case 'Expired': case 'HistoricalContentUnavailable': return 410;
    case 'QuotaExceeded': return 429;
    case 'Unsupported': return 422;
    case 'Blocked': case 'Unavailable': case 'RetryableInfrastructureFailure': return 503;
  }
}
export function assertNever(value: never): never { throw new Error(`Unreachable discriminant: ${String(value)}`); }
