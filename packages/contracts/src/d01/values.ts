import { DateTime, Option, Schema } from "effect";

export const exact = {
  parseOptions: { onExcessProperty: "error" },
} as const;

export const D01_LIMITS = {
  depth: 32,
  documentBytes: 262_144,
  entries: 10_000,
  envelopeBytes: 1_048_576,
  frameClaims: 200,
  records: 200,
  requestSeconds: 30,
  responseBytes: 1_048_576,
  stagingSeconds: 3600,
} as const;

export const DocumentText = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(D01_LIMITS.documentBytes)
);

const Uuid = Schema.String.check(Schema.isUUID());
export const WorldId = Uuid.pipe(Schema.brand("zoen/WorldId"));
export const OperationId = Uuid.pipe(Schema.brand("zoen/OperationId"));
export const EvidenceRef = Uuid.pipe(Schema.brand("zoen/EvidenceRef"));
export const SourceRef = Uuid.pipe(Schema.brand("zoen/SourceRef"));
export const ClaimRef = Uuid.pipe(Schema.brand("zoen/ClaimRef"));
export const FrameRef = Uuid.pipe(Schema.brand("zoen/FrameRef"));
export const ReceiptRef = Uuid.pipe(Schema.brand("zoen/ReceiptRef"));
export const CaseRef = Uuid.pipe(Schema.brand("zoen/CaseRef"));
export const QuestionRef = Uuid.pipe(Schema.brand("zoen/QuestionRef"));
export const CorrectionRef = Uuid.pipe(Schema.brand("zoen/CorrectionRef"));

export const Realm = Schema.Literals(["live", "evaluation"]);
export const LiveWorldRef = Schema.Struct({
  realm: Schema.Literal("live"),
  worldId: WorldId,
}).annotate(exact);
export const EvaluationWorldRef = Schema.Struct({
  realm: Schema.Literal("evaluation"),
  worldId: WorldId,
}).annotate(exact);
export const WorldRef = Schema.Union([LiveWorldRef, EvaluationWorldRef]);
export type LiveWorldRef = typeof LiveWorldRef.Type;
export type EvaluationWorldRef = typeof EvaluationWorldRef.Type;
export type WorldRef = typeof WorldRef.Type;

export const Digest = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{64}$/u)
).pipe(Schema.brand("zoen/Sha256"));
export const Revision = Schema.String.check(
  Schema.isPattern(/^(?:0|[1-9][0-9]{0,17})$/u)
).pipe(Schema.brand("zoen/Revision"));
export const DecimalText = Schema.String.check(
  Schema.isPattern(/^-?(?:0|[1-9][0-9]{0,19})(?:\.[0-9]{1,18})?$/u)
).pipe(Schema.brand("zoen/DecimalText"));
export type DecimalText = typeof DecimalText.Type;

export const Currency = Schema.Literals(["BRL", "USD", "EUR"]);
export const ExactAmount = Schema.Struct({
  amount: DecimalText,
  currency: Currency,
}).annotate(exact);
export type ExactAmount = typeof ExactAmount.Type;

export const Instant = Schema.String.check(
  Schema.isPattern(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u
  ),
  Schema.makeFilter((value) =>
    Option.exists(
      DateTime.make(value),
      (instant) => DateTime.formatIso(instant) === value
    )
  )
).pipe(Schema.brand("zoen/Instant"));
export const LocalDate = Schema.String.check(
  Schema.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u),
  Schema.makeFilter((value) =>
    Option.exists(
      DateTime.make(`${value}T00:00:00.000Z`),
      (instant) => DateTime.formatIsoDateUtc(instant) === value
    )
  )
).pipe(Schema.brand("zoen/LocalDate"));

export const DateInterval = Schema.TaggedStruct("DateInterval", {
  from: LocalDate,
  to: LocalDate,
})
  .check(Schema.makeFilter((value) => value.from < value.to))
  .annotate(exact);
export const InstantInterval = Schema.TaggedStruct("InstantInterval", {
  from: Instant,
  to: Instant,
})
  .check(Schema.makeFilter((value) => value.from < value.to))
  .annotate(exact);
export const UnknownTime = Schema.TaggedStruct("Unknown", {}).annotate(exact);
export const ValidTime = Schema.Union([DateInterval, UnknownTime]);
export type ValidTime = typeof ValidTime.Type;

export const RecordKey = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u)
);
export const SubjectKey = RecordKey.pipe(Schema.brand("zoen/SubjectKey"));
export const SourceRevision = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(128)
);
export const Label = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200)
);
export const Purpose = Schema.Literal("personal-records");
