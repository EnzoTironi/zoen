import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { ImportEvidence } from "../../src/worlds/operations.js";

const envelope = {
  operation: "ImportEvidence",
  operationId: "11111111-1111-4111-8111-111111111111",
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
  worldRef: { realm: "live", worldId: "22222222-2222-4222-8222-222222222222" },
};

describe("EX17 CSV public envelope", () => {
  it("CSV-06 public input preserves the legacy shape and accepts only the explicit CSV alternative", () => {
    const legacy = { ...envelope, input: { document: "{}" } };
    const csv = {
      ...envelope,
      input: { document: "csv text", format: "worlds.csv.v1" },
    };
    expect(Schema.decodeUnknownSync(ImportEvidence)(legacy)).toStrictEqual(
      legacy
    );
    expect(Schema.decodeUnknownSync(ImportEvidence)(csv)).toStrictEqual(csv);
    for (const input of [
      { document: "{}", format: "worlds.json.v1" },
      { document: "{}", format: "csv" },
      { document: "{}", format: null },
      { document: "csv", format: "worlds.csv.v1", source: "external metadata" },
      { document: "{}", mimeType: "text/csv" },
    ]) {
      expect(Schema.is(ImportEvidence)({ ...envelope, input })).toBeFalsy();
    }
  });
});
