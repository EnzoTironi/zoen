import { describe, expect, it } from "@effect/vitest";
import { Instant } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import { temporalGuardsHold } from "../../src/commit/guards.js";
import { ReadSet } from "../../src/ports/worlds/basis.js";

const instant = Schema.decodeSync(Instant);
const readSet = Schema.decodeSync(ReadSet)({
  clockSample: { observedAt: "2026-09-05T12:00:00.000Z", uncertaintyMillis: 5 },
  identities: [],
  membershipRevision: "0",
  predicates: [],
  schemaVersion: "authority.read-set.v2",
  sources: [],
  temporalGuards: [
    {
      notAfter: "2026-09-05T12:01:00.000Z",
      notBefore: "2026-09-05T12:00:00.000Z",
    },
  ],
});

describe("EX05 temporal guards", () => {
  it("allows elapsed time inside the original window without replacing consent", () => {
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:10.000Z"))
    ).toBeTruthy();
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:50.000Z"))
    ).toBeTruthy();
  });

  it("requires the entire uncertainty interval to remain in the half-open window", () => {
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:00.004Z"))
    ).toBeFalsy();
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:00.005Z"))
    ).toBeTruthy();
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:59.994Z"))
    ).toBeTruthy();
    expect(
      temporalGuardsHold(readSet, instant("2026-09-05T12:00:59.995Z"))
    ).toBeFalsy();
  });
});
