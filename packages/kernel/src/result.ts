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
    default: return assertNever(result);
  }
}
export function assertNever(value: never): never { throw new Error(`Unreachable discriminant: ${String(value)}`); }

/** Interpretation status axis — independent of verification and contestation. */
export const interpretationStatuses = ['unknown', 'unresolved', 'selected', 'set-valued'] as const;
export type InterpretationStatus = (typeof interpretationStatuses)[number];

/** Verification axis — independent of status and contestation. */
export const verificationStatuses = ['unverified', 'verified'] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export type InterpretationAxes = Readonly<{
  status: InterpretationStatus;
  verification: VerificationStatus;
  contested: boolean;
}>;

/**
 * Presence / scalar kinds that must remain distinct across JSON↔TS:
 * missing, zero, false and deleted never collapse into each other or into unknown.
 */
export const presenceTags = ['Missing', 'Zero', 'False', 'Deleted', 'Present'] as const;
export type PresenceTag = (typeof presenceTags)[number];
export type PresenceValue =
  | Readonly<{ tag: 'Missing' }>
  | Readonly<{ tag: 'Zero'; amount: string }>
  | Readonly<{ tag: 'False' }>
  | Readonly<{ tag: 'Deleted' }>
  | Readonly<{ tag: 'Present'; value: string }>;

export type OutcomeDocument = Readonly<{
  interpretation: InterpretationAxes;
  amount: PresenceValue;
}>;

export type WireJson =
  | null
  | boolean
  | string
  | number
  | readonly WireJson[]
  | { readonly [key: string]: WireJson };

const ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{0,79}$/;
const ZERO_AMOUNT_RE = /^-?0+(\.0+)?$/;
const DECIMAL_AMOUNT_RE = /^-?(?:0|[1-9]\d{0,37})(?:\.\d{1,18})?$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function interpretationAxes(
  status: InterpretationStatus,
  verification: VerificationStatus,
  contested: boolean,
): InterpretationAxes {
  requireThat((interpretationStatuses as readonly string[]).includes(status), 'INTERPRETATION_STATUS');
  requireThat((verificationStatuses as readonly string[]).includes(verification), 'VERIFICATION_STATUS');
  requireThat(typeof contested === 'boolean', 'CONTESTATION_TYPE');
  return Object.freeze({ status, verification, contested });
}

export function presenceMissing(): PresenceValue {
  return Object.freeze({ tag: 'Missing' });
}
export function presenceZero(amount = '0'): PresenceValue {
  requireThat(typeof amount === 'string' && DECIMAL_AMOUNT_RE.test(amount), 'ZERO_AMOUNT_FORMAT');
  requireThat(ZERO_AMOUNT_RE.test(amount), 'ZERO_AMOUNT_NOT_ZERO');
  return Object.freeze({ tag: 'Zero', amount });
}
export function presenceFalse(): PresenceValue {
  return Object.freeze({ tag: 'False' });
}
export function presenceDeleted(): PresenceValue {
  return Object.freeze({ tag: 'Deleted' });
}
export function presencePresent(value: string): PresenceValue {
  requireThat(typeof value === 'string', 'PRESENT_VALUE_TYPE');
  requireThat(value.length <= 4096, 'PRESENT_VALUE_LIMIT');
  return Object.freeze({ tag: 'Present', value });
}

export function outcomeDocument(interpretation: InterpretationAxes, amount: PresenceValue): OutcomeDocument {
  return Object.freeze({ interpretation, amount });
}

/** Exhaustive JSON serialization of a public Result (Ok value must already be WireJson-safe). */
export function serializeResult<T extends WireJson>(result: Result<T>): WireJson {
  if (result.tag === 'Ok') {
    return Object.freeze({ tag: 'Ok', value: result.value });
  }
  if (!(failureTags as readonly string[]).includes(result.tag)) {
    assertNever(result as never);
  }
  return Object.freeze({ tag: result.tag, code: result.code });
}

export function parseResult(input: unknown): Result<WireJson> {
  if (!isPlainObject(input)) return fail('InvalidInput', 'RESULT_NOT_OBJECT');
  const keys = Object.keys(input).sort();
  const tag = input['tag'];
  if (typeof tag !== 'string') return fail('InvalidInput', 'RESULT_TAG_TYPE');
  if (tag === 'Ok') {
    if (keys.join(',') !== 'tag,value') return fail('InvalidInput', 'RESULT_OK_KEYS');
    if (!('value' in input)) return fail('InvalidInput', 'RESULT_OK_VALUE');
    return ok(input['value'] as WireJson);
  }
  if (!(failureTags as readonly string[]).includes(tag)) {
    return fail('InvalidInput', 'RESULT_UNKNOWN_DISCRIMINANT');
  }
  if (keys.join(',') !== 'code,tag') return fail('InvalidInput', 'RESULT_FAILURE_KEYS');
  const code = input['code'];
  if (typeof code !== 'string' || !ERROR_CODE_RE.test(code)) {
    return fail('InvalidInput', 'RESULT_CODE_FORMAT');
  }
  return fail(tag as FailureTag, code);
}

export function serializeInterpretationAxes(axes: InterpretationAxes): WireJson {
  return Object.freeze({
    status: axes.status,
    verification: axes.verification,
    contested: axes.contested,
  });
}

export function parseInterpretationAxes(input: unknown): Result<InterpretationAxes> {
  if (!isPlainObject(input)) return fail('InvalidInput', 'AXES_NOT_OBJECT');
  const keys = Object.keys(input).sort();
  if (keys.join(',') !== 'contested,status,verification') {
    return fail('InvalidInput', 'AXES_KEYS');
  }
  const status = input['status'];
  const verification = input['verification'];
  const contested = input['contested'];
  if (typeof status !== 'string' || !(interpretationStatuses as readonly string[]).includes(status)) {
    return fail('InvalidInput', 'AXES_STATUS_UNKNOWN');
  }
  if (typeof verification !== 'string' || !(verificationStatuses as readonly string[]).includes(verification)) {
    return fail('InvalidInput', 'AXES_VERIFICATION_UNKNOWN');
  }
  if (typeof contested !== 'boolean') return fail('InvalidInput', 'AXES_CONTESTED_TYPE');
  return ok(interpretationAxes(status as InterpretationStatus, verification as VerificationStatus, contested));
}

export function serializePresence(value: PresenceValue): WireJson {
  switch (value.tag) {
    case 'Missing':
      return Object.freeze({ tag: 'Missing' });
    case 'Zero':
      return Object.freeze({ tag: 'Zero', amount: value.amount });
    case 'False':
      return Object.freeze({ tag: 'False' });
    case 'Deleted':
      return Object.freeze({ tag: 'Deleted' });
    case 'Present':
      return Object.freeze({ tag: 'Present', value: value.value });
    default:
      return assertNever(value);
  }
}

export function parsePresence(input: unknown): Result<PresenceValue> {
  if (!isPlainObject(input)) return fail('InvalidInput', 'PRESENCE_NOT_OBJECT');
  const tag = input['tag'];
  if (typeof tag !== 'string') return fail('InvalidInput', 'PRESENCE_TAG_TYPE');
  if (!(presenceTags as readonly string[]).includes(tag)) {
    return fail('InvalidInput', 'PRESENCE_UNKNOWN_DISCRIMINANT');
  }
  const keys = Object.keys(input).sort();
  switch (tag as PresenceTag) {
    case 'Missing':
      if (keys.join(',') !== 'tag') return fail('InvalidInput', 'PRESENCE_MISSING_KEYS');
      return ok(presenceMissing());
    case 'False':
      if (keys.join(',') !== 'tag') return fail('InvalidInput', 'PRESENCE_FALSE_KEYS');
      return ok(presenceFalse());
    case 'Deleted':
      if (keys.join(',') !== 'tag') return fail('InvalidInput', 'PRESENCE_DELETED_KEYS');
      return ok(presenceDeleted());
    case 'Zero': {
      if (keys.join(',') !== 'amount,tag') return fail('InvalidInput', 'PRESENCE_ZERO_KEYS');
      const amount = input['amount'];
      if (typeof amount !== 'string' || !DECIMAL_AMOUNT_RE.test(amount)) {
        return fail('InvalidInput', 'PRESENCE_ZERO_FORMAT');
      }
      if (!ZERO_AMOUNT_RE.test(amount)) {
        // Non-zero must not coerce into Zero; zero must not become Missing/Unknown.
        return fail('InvalidInput', 'PRESENCE_ZERO_NOT_ZERO');
      }
      return ok(presenceZero(amount));
    }
    case 'Present': {
      if (keys.join(',') !== 'tag,value') return fail('InvalidInput', 'PRESENCE_PRESENT_KEYS');
      const value = input['value'];
      if (typeof value !== 'string') return fail('InvalidInput', 'PRESENCE_PRESENT_TYPE');
      if (value.length > 4096) return fail('InvalidInput', 'PRESENCE_PRESENT_LIMIT');
      return ok(presencePresent(value));
    }
    default:
      return assertNever(tag as never);
  }
}

export function serializeOutcomeDocument(doc: OutcomeDocument): WireJson {
  return Object.freeze({
    interpretation: serializeInterpretationAxes(doc.interpretation),
    amount: serializePresence(doc.amount),
  });
}

export function parseOutcomeDocument(input: unknown): Result<OutcomeDocument> {
  if (!isPlainObject(input)) return fail('InvalidInput', 'OUTCOME_NOT_OBJECT');
  const keys = Object.keys(input).sort();
  if (keys.join(',') !== 'amount,interpretation') return fail('InvalidInput', 'OUTCOME_KEYS');
  const axes = parseInterpretationAxes(input['interpretation']);
  if (axes.tag !== 'Ok') return axes;
  const amount = parsePresence(input['amount']);
  if (amount.tag !== 'Ok') return amount;
  return ok(outcomeDocument(axes.value, amount.value));
}

/** Round-trip a Result&lt;OutcomeDocument&gt; across JSON text without collapsing axes. */
export function encodeOutcomeResult(result: Result<OutcomeDocument>): string {
  const wire: Result<WireJson> =
    result.tag === 'Ok'
      ? ok(serializeOutcomeDocument(result.value))
      : result;
  return JSON.stringify(serializeResult(wire));
}

export function decodeOutcomeResult(text: string): Result<OutcomeDocument> {
  if (typeof text !== 'string') return fail('InvalidInput', 'OUTCOME_TEXT_TYPE');
  if (text.length === 0) return fail('InvalidInput', 'OUTCOME_TEXT_EMPTY');
  if (text.length > 1_048_576) return fail('InvalidInput', 'OUTCOME_TEXT_LIMIT');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return fail('InvalidInput', 'OUTCOME_JSON_PARSE');
  }
  const result = parseResult(parsed);
  if (result.tag !== 'Ok') return result;
  return parseOutcomeDocument(result.value);
}

export const OUTCOME_LIMITS = Object.freeze({
  maxPresentChars: 4096,
  maxErrorCodeChars: 80,
  maxWireBytes: 1_048_576,
  interpretationStatuses,
  verificationStatuses,
  presenceTags,
  failureTags,
});
