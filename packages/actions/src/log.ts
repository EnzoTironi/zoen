import { Schema } from "effect";

const exact = {
  parseOptions: { onExcessProperty: "error" },
} as const;

export const ActionLogOutcome = Schema.Literals([
  "accepted",
  "committed",
  "failed",
  "rejected",
]);
export type ActionLogOutcome = typeof ActionLogOutcome.Type;

/** Append-only Action Log entry (glossary Action Log; seed of tip Receipt). */
export const ActionLogEntry = Schema.Struct({
  actionTypeId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  actorPrincipalId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  attemptedAt: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64)
  ),
  completedAt: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64)
  ),
  entryId: Schema.String.check(Schema.isUUID()),
  operationId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  outcome: ActionLogOutcome,
  realm: Schema.NullOr(Schema.Literals(["evaluation", "live"])),
  receiptRef: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  rejectionCode: Schema.NullOr(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128))
  ),
  result: Schema.NullOr(Schema.Unknown),
  semanticOperation: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  worldId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
}).annotate(exact);
export type ActionLogEntry = typeof ActionLogEntry.Type;

export interface ActionLogAppendInput {
  readonly actionTypeId: string;
  readonly actorPrincipalId: string | null;
  readonly attemptedAt: string;
  readonly completedAt: string;
  readonly operationId: string | null;
  readonly outcome: ActionLogOutcome;
  readonly realm: "evaluation" | "live" | null;
  readonly receiptRef: string | null;
  readonly rejectionCode: string | null;
  readonly result: unknown;
  readonly semanticOperation: string;
  readonly worldId: string | null;
}

/** Durable or in-memory append-only Action Log port. */
export interface ActionLog {
  readonly append: (
    input: ActionLogAppendInput
  ) => ActionLogEntry | Promise<ActionLogEntry>;
  readonly list: () =>
    | readonly ActionLogEntry[]
    | Promise<readonly ActionLogEntry[]>;
}
