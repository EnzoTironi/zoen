import type { EvidenceRef } from "@zoen/contracts/worlds/values";
import { OperationId, WorldId } from "@zoen/contracts/worlds/values";
import { Result, Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("EX04 ID boundaries", () => {
  it("EX04 keeps ID brands incompatible at compile time and validates UUIDs at runtime", () => {
    // These assertions are checked by TS7, not counted as runtime security proof.
    expectTypeOf<typeof WorldId.Type>().not.toExtend<typeof OperationId.Type>();
    expectTypeOf<typeof EvidenceRef.Type>().not.toExtend<typeof WorldId.Type>();
    const id = "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14";
    expect(Schema.decodeSync(WorldId)(id)).toBe(id);
    expect(
      Result.isFailure(Schema.decodeResult(OperationId)("owner"))
    ).toBeTruthy();
  });
});
