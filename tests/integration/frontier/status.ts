/**
 * ZA-26 frontier integration status validation.
 *
 * Pure gates over an already-observed status document bound to one tip
 * commit/lock/image/profile. Rejects old commits, wrong images, zero-test
 * claims, and overclaims that conditional gates completed.
 */
import { Schema } from "effect";

export const FRONTIER_STATUS_SCHEMA = "zoen.frontier-integration-status/v1";

const GateStatus = Schema.Literals(["Cleared", "Blocked", "Unknown"]);
const QualityOutcome = Schema.Literals(["pass", "fail", "not_run"]);
const NonEmpty = Schema.String.check(Schema.isMinLength(1));
const FullSha = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u));
const Sha256Hex = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

const SelectedProfile = Schema.Struct({
  acceptanceReadme: NonEmpty,
  browserSpec: NonEmpty,
  evidenceRef: NonEmpty,
  id: NonEmpty,
  integrationTest: NonEmpty,
  label: NonEmpty,
  productDoc: NonEmpty,
  ticket: NonEmpty,
});

const Tip = Schema.Struct({
  commit: FullSha,
  imageIdentity: Schema.NullOr(NonEmpty),
  imageIdentityNote: NonEmpty,
  lockfileSha256: Sha256Hex,
  parentPr: NonEmpty,
  short: NonEmpty,
});

const Scopes = Schema.Struct({
  activated: Schema.Array(NonEmpty),
  blocked: Schema.Array(NonEmpty),
  implemented: Schema.Array(NonEmpty),
  qualified: Schema.Array(NonEmpty),
  unknown: Schema.Array(NonEmpty),
});

const ConditionalGates = Schema.Struct({
  "G-OPS": GateStatus,
  "G-PROVIDER": GateStatus,
  "G-STORAGE-FENCE": GateStatus,
  "H-01": GateStatus,
  "H-02": GateStatus,
  activatedBecausePrMerged: Schema.Literal(false),
  cloudSpeechEnabled: Schema.Literal(false),
  entireTargetDiagramImplemented: Schema.Literal(false),
  fullD03: Schema.Literal(false),
  fullD04: Schema.Literal(false),
  fullD05: Schema.Literal(false),
  fullHostedErased: Schema.Literal(false),
  restoreAfterErasure: Schema.Literal(false),
  textProfileAccepted: Schema.Literal(false),
});

const Execution = Schema.Struct({
  build: QualityOutcome,
  commands: Schema.Array(NonEmpty).check(Schema.isMinLength(1)),
  formatCheck: QualityOutcome,
  frontierIntegrationTests: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0)
  ),
  lint: QualityOutcome,
  selectedProfileAcceptanceTests: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0)
  ),
  selectedProfileIntegrationTests: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThan(0)
  ),
  typecheck: QualityOutcome,
  unitFiles: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0)
  ),
  unitTests: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
});

export const FrontierStatusDocumentSchema = Schema.Struct({
  conditionalGates: ConditionalGates,
  execution: Execution,
  notes: Schema.Array(NonEmpty),
  schema: Schema.Literal(FRONTIER_STATUS_SCHEMA),
  scopes: Scopes,
  selectedProfile: SelectedProfile,
  ticket: Schema.Literal("ZA-26"),
  tip: Tip,
});

export type FrontierStatusDocument = typeof FrontierStatusDocumentSchema.Type;

const REQUIRED_BLOCKED_SCOPES = [
  "independent-erasure-controller",
  "hosted-erased-activated",
  "eve-product-admitted",
  "cloud-speech",
  "restore-after-erasure",
  "full-d03",
  "full-d04",
  "full-d05",
] as const;

const REQUIRED_IMPLEMENTED_PREFIXES = [
  "za-22-household",
  "za-23-bakery",
  "za-24-clinic",
  "za-25-finance",
] as const;

export const isFrontierValidationError = (error: unknown): boolean =>
  error instanceof Error && error.name === "FrontierValidationError";

const fail = (message: string): never => {
  const error = new Error(message);
  error.name = "FrontierValidationError";
  throw error;
};

const decodeDocument = (raw: unknown): FrontierStatusDocument => {
  try {
    return Schema.decodeUnknownSync(FrontierStatusDocumentSchema)(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown cause";
    return fail(`frontier status schema rejected: ${detail}`);
  }
};

const hasHistoricalCumulative = (raw: unknown): boolean => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  if (!("execution" in raw)) {
    return false;
  }
  const execution = Reflect.get(raw, "execution");
  if (typeof execution !== "object" || execution === null) {
    return false;
  }
  return Reflect.has(execution, "historicalCumulativeTests");
};

const assertTipBinding = (
  doc: FrontierStatusDocument,
  options: {
    readonly expectedCommit: string;
    readonly expectedLockfileSha256?: string;
    readonly expectedImageIdentity?: string | null;
    readonly requireImageIdentity?: boolean;
  }
): void => {
  const commit = doc.tip.commit.toLowerCase();
  if (commit !== options.expectedCommit) {
    fail(
      `tip.commit ${commit} does not match expected tip ${options.expectedCommit} (refusing old/cross-commit status)`
    );
  }
  if (!commit.startsWith(doc.tip.short.toLowerCase())) {
    fail("tip.short must be a prefix of tip.commit");
  }
  if (
    options.expectedLockfileSha256 !== undefined &&
    doc.tip.lockfileSha256 !== options.expectedLockfileSha256
  ) {
    fail("tip.lockfileSha256 does not match the observed lockfile");
  }
  if (options.requireImageIdentity === true && doc.tip.imageIdentity === null) {
    fail("tip.imageIdentity is required when requireImageIdentity is set");
  }
  if (
    options.expectedImageIdentity !== undefined &&
    options.expectedImageIdentity !== null &&
    doc.tip.imageIdentity !== options.expectedImageIdentity
  ) {
    fail(
      "tip.imageIdentity does not match the observed image (refusing wrong image)"
    );
  }
};

const assertSelectedProfile = (doc: FrontierStatusDocument): void => {
  if (!doc.selectedProfile.ticket.startsWith("ZA-")) {
    fail("selectedProfile.ticket must be a ZA ticket");
  }
  const ticketToken = doc.selectedProfile.ticket.replaceAll("-", "");
  if (!doc.selectedProfile.browserSpec.includes(ticketToken)) {
    fail(
      "selectedProfile.browserSpec must belong to the selected ticket scope"
    );
  }
};

const assertScopes = (doc: FrontierStatusDocument): void => {
  for (const prefix of REQUIRED_IMPLEMENTED_PREFIXES) {
    if (
      !doc.scopes.implemented.some(
        (item) => item.startsWith(prefix) || item.includes(prefix)
      )
    ) {
      fail(
        `scopes.implemented must retain unrelated verified ICP work (${prefix})`
      );
    }
  }
  for (const item of REQUIRED_BLOCKED_SCOPES) {
    if (!doc.scopes.blocked.includes(item)) {
      fail(
        `scopes.blocked must include ${item} while conditional gates remain incomplete`
      );
    }
  }
  if (doc.scopes.activated.length !== 0) {
    fail(
      "scopes.activated must stay empty for ZA-26 (merge does not activate)"
    );
  }
  if (
    doc.scopes.implemented.some((item) =>
      /full-d0[345]|entire-target|target-diagram/iu.test(item)
    )
  ) {
    fail(
      "scopes.implemented must not claim the entire target diagram or full D03/D04/D05"
    );
  }
};

const assertConditionalGates = (doc: FrontierStatusDocument): void => {
  for (const gate of [
    "H-01",
    "H-02",
    "G-PROVIDER",
    "G-STORAGE-FENCE",
    "G-OPS",
  ] as const) {
    const status = doc.conditionalGates[gate];
    if (status !== "Blocked" && status !== "Unknown") {
      fail(
        `conditionalGates.${gate} must stay Blocked or Unknown without completed qualification`
      );
    }
  }
};

const assertExecution = (doc: FrontierStatusDocument): void => {
  if (
    doc.execution.formatCheck === "not_run" &&
    doc.execution.lint === "not_run" &&
    doc.execution.typecheck === "not_run"
  ) {
    fail(
      "execution must record at least one real quality command outcome (not all not_run)"
    );
  }
};

/**
 * Validate a frontier status document for one tip.
 *
 * ZA-26-03: old commit / wrong image / zero tests → reject.
 * ZA-26-02: missing conditional gate evidence → dependent scopes stay blocked.
 * ZA-26-01: selected profile must name concrete demo + evidence paths.
 */
export const validateFrontierStatus = (
  raw: unknown,
  options: {
    readonly expectedCommit: string;
    readonly expectedLockfileSha256?: string;
    readonly expectedImageIdentity?: string | null;
    readonly requireImageIdentity?: boolean;
  }
): FrontierStatusDocument => {
  const expected = options.expectedCommit.toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(expected)) {
    fail("expectedCommit must be a full lowercase git SHA");
  }
  if (hasHistoricalCumulative(raw)) {
    fail("execution must not carry historicalCumulativeTests");
  }

  const doc = decodeDocument(raw);
  assertTipBinding(doc, { ...options, expectedCommit: expected });
  assertSelectedProfile(doc);
  assertScopes(doc);
  assertConditionalGates(doc);
  assertExecution(doc);
  return doc;
};

/** Deep clone for negative tests (plain JSON value). */
export const cloneStatus = (status: FrontierStatusDocument): unknown =>
  structuredClone(status);
