import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  CorrectionRequest,
  D01Request,
  SemanticRequest,
} from "../../src/worlds/operations.js";

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

describe("SH exact transitions at the public boundary", () => {
  it("requires an explicit target and revision for revoke and no operation identity for reads", () => {
    const revoke = {
      ...grant,
      input: { ...grant.input, expectedRevision: "0" },
      operation: "RevokeWorldReadAccess",
    };
    expect(Schema.is(SemanticRequest)(revoke)).toBeTruthy();
    expect(
      Schema.is(SemanticRequest)({ ...revoke, input: grant.input })
    ).toBeFalsy();
    const read = {
      input: { principalRef: null },
      operation: "InspectWorldAccess",
      purpose: grant.purpose,
      schemaVersion: grant.schemaVersion,
      worldRef: grant.worldRef,
    };
    expect([
      Schema.is(SemanticRequest)(read),
      Schema.is(SemanticRequest)({ ...read, operationId: grant.operationId }),
      Schema.is(SemanticRequest)({ ...read, input: {} }),
      Schema.is(SemanticRequest)({
        ...read,
        input: { principalRef: grant.input.principalRef },
      }),
      Schema.is(SemanticRequest)({ ...grant, schemaVersion: "worlds.v1" }),
    ]).toStrictEqual([true, false, false, true, false]);
  });
});
