import { Result, Schema } from "effect";
import { OpenApi } from "effect/unstable/httpapi";
import { describe, expect, it } from "vitest";

import { CorrectionApiGroup, D01Api, D01ApiGroup } from "../../src/d01/api.js";
import {
  Conflict,
  D01Error,
  RetryableInfrastructureFailure,
} from "../../src/d01/errors.js";
import {
  AmountValue,
  ImportDocument,
  VisibleFrame,
} from "../../src/d01/evidence.js";
import { CorrectionRequest, D01Request } from "../../src/d01/operations.js";
import {
  DateInterval,
  DecimalText,
  Digest,
  DocumentText,
  EvaluationWorldRef,
  Instant,
  LiveWorldRef,
  LocalDate,
  Revision,
} from "../../src/d01/values.js";

const id = "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14";
const world = { realm: "live", worldId: id };
const source = {
  externalId: "source-1",
  label: "Ledger",
  namespace: "manual",
  revision: "v1",
};
const record = {
  externalId: "row-1",
  predicate: "obligation.amount",
  subjectKey: "order-1",
  validTime: { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" },
  value: { _tag: "Known", amount: "0.00", currency: "BRL" },
};
const document = { records: [record], schemaVersion: "d01.v1", source };
const request = {
  input: { document: JSON.stringify(document) },
  operation: "ImportEvidence",
  operationId: id,
  purpose: "personal-records",
  schemaVersion: "d01.v1",
  worldRef: world,
};
const visible = {
  claims: [
    {
      claimRef: id,
      evidenceRef: id,
      predicate: "obligation.amount",
      recordId: "row-1",
      recordIndex: 0,
      source,
      sourceRef: id,
      subjectKey: "order-1",
      validTime: record.validTime,
      value: record.value,
      verification: "unverified",
    },
  ],
  contested: true,
  correctionRef: null,
  coverage: { _tag: "Unknown" },
  frameRef: id,
  selection: { _tag: "selected", claimRef: id },
  subjectKey: "order-1",
  verification: "unverified",
  worldRef: world,
};

const isRejected = (
  schema: Schema.ConstraintDecoder<unknown>,
  value: unknown
) => Result.isFailure(Schema.decodeUnknownResult(schema)(value));

describe("EX02 public scalar boundaries", () => {
  it.each([
    "0",
    "-0",
    "0.10",
    "-1.250",
    "99999999999999999999.999999999999999999",
  ])("preserves exact decimal %s without coercion", (value) => {
    expect(Schema.decodeSync(DecimalText)(value)).toBe(value);
  });

  it.each([
    "",
    "01",
    "+1",
    "1e3",
    "NaN",
    "1,25",
    " 1",
    ".1",
    "1.",
    "100000000000000000000",
    "0.1234567890123456789",
    0.1,
    null,
  ])("rejects malformed or out-of-profile decimal %s", (value) => {
    expect(isRejected(DecimalText, value)).toBeTruthy();
  });

  it("keeps zero Known and Unknown distinct across JSON", () => {
    const known = Schema.decodeUnknownSync(AmountValue)(record.value);
    const unknown = Schema.decodeSync(AmountValue)({ _tag: "Unknown" });
    expect(Schema.encodeSync(AmountValue)(known)).toStrictEqual(record.value);
    expect(Schema.encodeSync(AmountValue)(unknown)).toStrictEqual({
      _tag: "Unknown",
    });
    expect(
      isRejected(AmountValue, { _tag: "Unknown", amount: "0" })
    ).toBeTruthy();
    expect(
      isRejected(AmountValue, {
        _tag: "Estimated",
        amount: "1",
        currency: "BRL",
      })
    ).toBeTruthy();
  });

  it("validates civil dates and explicit UTC instants without normalization", () => {
    expect(Schema.decodeSync(LocalDate)("2024-02-29")).toBe("2024-02-29");
    expect(Schema.decodeSync(Instant)("2026-09-05T12:30:00.000Z")).toBe(
      "2026-09-05T12:30:00.000Z"
    );
    expect(isRejected(LocalDate, "2026-02-29")).toBeTruthy();
    expect(isRejected(LocalDate, "2026-04-31")).toBeTruthy();
    expect(isRejected(LocalDate, "2026-09-05T00:00:00.000Z")).toBeTruthy();
  });

  it("rejects instants without an exact UTC calendar representation", () => {
    expect(isRejected(Instant, "2026-09-05")).toBeTruthy();
    expect(isRejected(Instant, "2026-09-05T12:30:00.000")).toBeTruthy();
    expect(isRejected(Instant, "2026-09-05T12:30:00.000-03:00")).toBeTruthy();
    expect(isRejected(Instant, "2026-02-30T12:30:00.000Z")).toBeTruthy();
  });

  it("keeps LocalDate within the PostgreSQL calendar profile 0001–9999", () => {
    expect(isRejected(LocalDate, "0000-01-01")).toBeTruthy();
    expect(Schema.decodeSync(LocalDate)("0001-01-01")).toBe("0001-01-01");
    expect(Schema.decodeSync(LocalDate)("9999-12-31")).toBe("9999-12-31");
    expect(isRejected(LocalDate, "10000-01-01")).toBeTruthy();
    expect(isRejected(LocalDate, "0001-01-01 BC")).toBeTruthy();
  });

  it("keeps Instant within the PostgreSQL calendar profile 0001–9999", () => {
    expect(isRejected(Instant, "0000-01-01T00:00:00.000Z")).toBeTruthy();
    expect(Schema.decodeSync(Instant)("0001-01-01T00:00:00.000Z")).toBe(
      "0001-01-01T00:00:00.000Z"
    );
    expect(Schema.decodeSync(Instant)("9999-12-31T23:59:59.999Z")).toBe(
      "9999-12-31T23:59:59.999Z"
    );
    expect(isRejected(Instant, "+010000-01-01T00:00:00.000Z")).toBeTruthy();
    expect(isRejected(Instant, "-000001-01-01T00:00:00.000Z")).toBeTruthy();
  });

  it("rejects empty and reversed half-open intervals", () => {
    expect(
      Schema.decodeUnknownSync(DateInterval)(record.validTime)
    ).toStrictEqual(record.validTime);
    expect(
      isRejected(DateInterval, {
        _tag: "DateInterval",
        from: "2026-09-05",
        to: "2026-09-05",
      })
    ).toBeTruthy();
    expect(
      isRejected(DateInterval, {
        _tag: "DateInterval",
        from: "2026-09-06",
        to: "2026-09-05",
      })
    ).toBeTruthy();
  });

  it("rejects malformed opaque refs, realms, digests and overflowing counters", () => {
    expect(Schema.decodeUnknownSync(LiveWorldRef)(world)).toStrictEqual(world);
    expect(
      isRejected(LiveWorldRef, { ...world, realm: "evaluation" })
    ).toBeTruthy();
    expect(isRejected(EvaluationWorldRef, world)).toBeTruthy();
    expect(
      isRejected(LiveWorldRef, { ...world, worldId: "owner" })
    ).toBeTruthy();
  });

  it("rejects malformed digests and overflowing counters", () => {
    expect(isRejected(Digest, "A".repeat(64))).toBeTruthy();
    expect(isRejected(Digest, "0".repeat(63))).toBeTruthy();
    expect(Schema.decodeSync(Revision)("9007199254740993")).toBe(
      "9007199254740993"
    );
    expect(isRejected(Revision, 9_007_199_254_740_992)).toBeTruthy();
    expect(isRejected(Revision, "1000000000000000000")).toBeTruthy();
  });
});

describe("EX02 exact request and import schemas", () => {
  it("decodes the bounded JSON import envelope without interpreting its document", () => {
    expect(Schema.decodeUnknownSync(D01Request)(request)).toStrictEqual(
      request
    );
    expect(Schema.decodeUnknownSync(ImportDocument)(document)).toStrictEqual(
      document
    );
  });

  it.each([
    "principal",
    "actor",
    "role",
    "grant",
    "session",
    "internalBasis",
    "sql",
    "sourceUrl",
    "dataPolicy",
  ])("rejects client authority or extra field %s", (field) => {
    expect(
      isRejected(D01Request, { ...request, [field]: "owner" })
    ).toBeTruthy();
  });

  it("rejects authority fields nested at every envelope boundary", () => {
    expect(
      isRejected(D01Request, {
        ...request,
        worldRef: { ...world, principal: id },
      })
    ).toBeTruthy();
    expect(
      isRejected(D01Request, {
        ...request,
        input: { ...request.input, role: "owner" },
      })
    ).toBeTruthy();
    expect(
      isRejected(D01Request, { ...request, purpose: "admin" })
    ).toBeTruthy();
    expect(
      isRejected(D01Request, { ...request, schemaVersion: "v999" })
    ).toBeTruthy();
    expect(
      isRejected(D01Request, { ...request, operation: "ExecuteSql" })
    ).toBeTruthy();
  });

  it("genesis has no caller-selected World or seed", () => {
    const genesis = {
      input: {},
      operation: "CreatePersonalWorld",
      operationId: id,
      purpose: "personal-records",
      schemaVersion: "d01.v1",
    };
    expect(Schema.decodeUnknownSync(D01Request)(genesis)).toStrictEqual(
      genesis
    );
    expect(
      isRejected(D01Request, { ...genesis, worldRef: world })
    ).toBeTruthy();
    expect(
      isRejected(D01Request, { ...genesis, input: { seed: "arbitrary" } })
    ).toBeTruthy();
    expect(isRejected(D01Request, { ...genesis, input: 1 })).toBeTruthy();
    expect(isRejected(D01Request, { ...genesis, input: [] })).toBeTruthy();
  });

  it("does not admit verified or settled claims from a file", () => {
    expect(
      isRejected(ImportDocument, {
        ...document,
        records: [{ ...record, verification: "verified" }],
      })
    ).toBeTruthy();
    expect(
      isRejected(ImportDocument, {
        ...document,
        records: [{ ...record, predicate: "payment.settled" }],
      })
    ).toBeTruthy();
    expect(
      isRejected(ImportDocument, {
        ...document,
        source: { ...source, url: "https://example.test/private" },
      })
    ).toBeTruthy();
  });

  it("rejects document and record-count limits without truncation", () => {
    expect(isRejected(DocumentText, "")).toBeTruthy();
    expect(isRejected(DocumentText, "x".repeat(262_145))).toBeTruthy();
    expect(
      isRejected(ImportDocument, { ...document, records: [] })
    ).toBeTruthy();
    expect(
      isRejected(ImportDocument, {
        ...document,
        records: Array.from({ length: 201 }, () => record),
      })
    ).toBeTruthy();
  });

  it("reserves corrections separately and rejects an unbound answer", () => {
    const answer = {
      input: {
        answer: "unknown",
        consequenceDigest: "0".repeat(64),
        questionRef: id,
      },
      operation: "AnswerQuestion",
      operationId: id,
      purpose: "personal-records",
      schemaVersion: "d01.v1",
      worldRef: world,
    };
    expect(Schema.decodeUnknownSync(CorrectionRequest)(answer)).toStrictEqual(
      answer
    );
    expect(isRejected(D01Request, answer)).toBeTruthy();
    expect(
      isRejected(CorrectionRequest, {
        ...answer,
        input: { answer: "confirm", questionRef: id },
      })
    ).toBeTruthy();
    expect(
      isRejected(CorrectionRequest, {
        ...answer,
        input: { ...answer.input, approved: true },
      })
    ).toBeTruthy();
  });
});

describe("EX02 disclosure and API boundaries", () => {
  it("preserves selected, contested and unverified independently", () => {
    const frame = Schema.decodeUnknownSync(VisibleFrame)(visible);
    expect(Schema.encodeSync(VisibleFrame)(frame)).toStrictEqual(visible);
  });

  it.each([
    "internalBasis",
    "cut",
    "securityRevision",
    "generationId",
    "objectKey",
    "storageUrl",
    "readSetDigest",
  ])("does not accept private %s in a VisibleFrame", (field) => {
    expect(
      isRejected(VisibleFrame, { ...visible, [field]: "private" })
    ).toBeTruthy();
  });

  it("rejects nested hidden fields and unknown state axes", () => {
    expect(
      isRejected(VisibleFrame, {
        ...visible,
        claims: [{ ...visible.claims[0], hiddenRivals: 2 }],
      })
    ).toBeTruthy();
    expect(
      isRejected(VisibleFrame, { ...visible, selection: { _tag: "bestGuess" } })
    ).toBeTruthy();
    expect(
      isRejected(VisibleFrame, { ...visible, verification: "verified" })
    ).toBeTruthy();
    expect(
      isRejected(VisibleFrame, { ...visible, coverage: { _tag: "Complete" } })
    ).toBeTruthy();
  });

  it("serializes closed errors and rejects arbitrary diagnostic codes", () => {
    const conflict = new Conflict({ code: "CONFLICT" });
    const retryable = new RetryableInfrastructureFailure({
      code: "RETRYABLE_INFRASTRUCTURE_FAILURE",
    });
    expect(Schema.encodeSync(D01Error)(conflict)).toStrictEqual({
      _tag: "Conflict",
      code: "CONFLICT",
    });
    expect(Schema.encodeSync(D01Error)(retryable)).toStrictEqual({
      _tag: "RetryableInfrastructureFailure",
      code: "RETRYABLE_INFRASTRUCTURE_FAILURE",
    });
    expect(
      isRejected(D01Error, { _tag: "Conflict", code: "HIDDEN_SOURCE_EXISTS" })
    ).toBeTruthy();
  });

  it("preserves each semantic error HTTP status instead of a union-wide 500", () => {
    const responses =
      OpenApi.fromApi(D01Api).paths["/api/d01/execute"]?.post?.responses;
    expect(Object.keys(responses ?? {})).toStrictEqual([
      "200",
      "400",
      "401",
      "404",
      "409",
      "410",
      "429",
      "503",
    ]);
  });

  it("keeps correction endpoints out of the first API and retains the request schema", () => {
    expect(Object.keys(D01Api.groups)).toStrictEqual(["d01"]);
    expect(Object.keys(D01ApiGroup.endpoints)).toStrictEqual(["execute"]);
    expect(CorrectionApiGroup.endpoints.execute.path).toBe(
      "/api/d01/corrections"
    );
    const payloadSchemas = [
      ...D01ApiGroup.endpoints.execute.payload.values(),
    ].flatMap((entry) => entry.schemas);
    expect(payloadSchemas).toHaveLength(1);
    for (const schema of payloadSchemas) {
      const payloadType = Schema.toType(schema);
      expect(Schema.decodeSync(payloadType)(request)).toStrictEqual(request);
      expect(
        isRejected(payloadType, { ...request, actor: "owner" })
      ).toBeTruthy();
    }
  });
});
