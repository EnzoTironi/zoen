import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  CorrectionRequest,
  D01Request,
  SemanticRequest,
} from "../../src/d01/operations.js";

const grant = {
  input: {
    expectedRevision: null,
    principalRef: "11111111-1111-4111-8111-111111111111",
  },
  operation: "GrantWorldReadAccess",
  operationId: "22222222-2222-4222-8222-222222222222",
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
  worldRef: { realm: "live", worldId: "33333333-3333-4333-8333-333333333333" },
};
describe("SH schemas", () => {
  it("SH schemas admit exact sharing requests without widening legacy families", () => {
    expect(Schema.is(SemanticRequest)(grant)).toBeTruthy();
    expect(Schema.is(D01Request)(grant)).toBeFalsy();
    expect(Schema.is(CorrectionRequest)(grant)).toBeFalsy();
    for (const input of [
      { principalRef: grant.input.principalRef },
      { ...grant.input, role: "owner" },
      { ...grant.input, expectedRevision: 0 },
      { ...grant.input, expectedRevision: "00" },
      { ...grant.input, principalRef: "person@example.com" },
    ]) {
      expect(Schema.is(SemanticRequest)({ ...grant, input })).toBeFalsy();
    }
  });
});
