import { Schema } from "effect";

export class InvalidInput extends Schema.TaggedError<InvalidInput>()(
  "InvalidInput",
  { code: Schema.Literal("INVALID_INPUT") },
  { httpApiStatus: 400 }
) {}
export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()(
  "Unauthenticated",
  { code: Schema.Literal("PRESENCE_REQUIRED") },
  { httpApiStatus: 401 }
) {}
export class NotFoundOrDenied extends Schema.TaggedError<NotFoundOrDenied>()(
  "NotFoundOrDenied",
  { code: Schema.Literal("NOT_FOUND_OR_DENIED") },
  { httpApiStatus: 404 }
) {}
export class Conflict extends Schema.TaggedError<Conflict>()(
  "Conflict",
  { code: Schema.Literal("CONFLICT") },
  { httpApiStatus: 409 }
) {}
export class Stale extends Schema.TaggedError<Stale>()(
  "Stale",
  { code: Schema.Literal("STALE") },
  { httpApiStatus: 409 }
) {}
export class Blocked extends Schema.TaggedError<Blocked>()(
  "Blocked",
  { code: Schema.Literal("PROFILE_BLOCKED") },
  { httpApiStatus: 503 }
) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()(
  "Unavailable",
  { code: Schema.Literal("UNAVAILABLE") },
  { httpApiStatus: 503 }
) {}
export class HistoricalContentUnavailable extends Schema.TaggedError<HistoricalContentUnavailable>()(
  "HistoricalContentUnavailable",
  { code: Schema.Literal("HISTORICAL_CONTENT_UNAVAILABLE") },
  { httpApiStatus: 410 }
) {}
export class QuotaExceeded extends Schema.TaggedError<QuotaExceeded>()(
  "QuotaExceeded",
  { code: Schema.Literal("QUOTA_EXCEEDED") },
  { httpApiStatus: 429 }
) {}
export class Unsupported extends Schema.TaggedError<Unsupported>()(
  "Unsupported",
  { code: Schema.Literal("UNSUPPORTED") },
  { httpApiStatus: 400 }
) {}
export class Expired extends Schema.TaggedError<Expired>()(
  "Expired",
  { code: Schema.Literal("EXPIRED") },
  { httpApiStatus: 410 }
) {}
export class RetryableInfrastructureFailure extends Schema.TaggedError<RetryableInfrastructureFailure>()(
  "RetryableInfrastructureFailure",
  { code: Schema.Literal("RETRYABLE_INFRASTRUCTURE_FAILURE") },
  { httpApiStatus: 503 }
) {}
export const SemanticError = Schema.Union([
  InvalidInput,
  Unauthenticated,
  NotFoundOrDenied,
  Conflict,
  Stale,
  Blocked,
  Unavailable,
  HistoricalContentUnavailable,
  QuotaExceeded,
  Unsupported,
  Expired,
  RetryableInfrastructureFailure,
]);
export type SemanticError = typeof SemanticError.Type;
