import { expect, it } from "@effect/vitest";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import { Effect, Schema } from "effect";

import { classifyClaims } from "../../../src/knowledge/worlds/selection.js";

const claim = (
  id: number,
  value: string,
  from = "2026-09-01",
  to = "2026-10-01"
) =>
  Schema.decodeSync(VisibleClaim)({
    claimRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    evidenceRef: "00000000-0000-4000-8000-000000000001",
    predicate: "obligation.amount",
    recordId: `record-${id}`,
    recordIndex: id,
    source: {
      externalId: `source-${id}`,
      label: `Source ${id}`,
      namespace: "test",
      revision: "1",
    },
    sourceRef: "00000000-0000-4000-8000-000000000001",
    subjectKey: "invoice-1",
    validTime: { _tag: "DateInterval", from, to },
    value: { _tag: "Known", amount: value, currency: "BRL" },
    verification: "unverified",
  });

it.effect(
  "EX08 overlapping comparable differences remain contested and unresolved",
  () =>
    Effect.gen(function* comparableDifferences() {
      expect(
        yield* classifyClaims([claim(1, "100.00"), claim(2, "200.00")])
      ).toStrictEqual({ contested: true, selection: { _tag: "unresolved" } });
    })
);
it.effect(
  "EX08 decimal scale does not invent conflict or independent support",
  () =>
    Effect.gen(function* equalValues() {
      const first = claim(1, "100.0");
      const copy = claim(2, "100.00");
      const result = yield* classifyClaims([first, copy]);
      expect(result).toStrictEqual({
        contested: false,
        selection: {
          _tag: "set-valued",
          claimRefs: [first.claimRef, copy.claimRef],
        },
      });
      expect(Object.keys(result).toSorted()).toStrictEqual([
        "contested",
        "selection",
      ]);
    })
);
it.effect(
  "EX08 disjoint intervals and different currencies are not rival amounts",
  () =>
    Effect.gen(function* distinctMeaning() {
      const first = claim(1, "100", "2026-09-01", "2026-09-10");
      const adjacent = claim(2, "200", "2026-09-10", "2026-09-20");
      expect((yield* classifyClaims([first, adjacent])).contested).toBeFalsy();
      const dollars = yield* Schema.decodeEffect(VisibleClaim)({
        ...claim(3, "200"),
        value: { _tag: "Known", amount: "200", currency: "USD" },
      });
      expect((yield* classifyClaims([first, dollars])).contested).toBeFalsy();
    })
);
it.effect("EX08 absent or unknown amounts do not select a winner", () =>
  Effect.gen(function* unknownAmount() {
    expect(yield* classifyClaims([])).toStrictEqual({
      contested: false,
      selection: { _tag: "unknown" },
    });
    const unknown = yield* Schema.decodeEffect(VisibleClaim)({
      ...claim(2, "200"),
      value: { _tag: "Unknown" },
    });
    expect(yield* classifyClaims([unknown])).toStrictEqual({
      contested: false,
      selection: { _tag: "unknown" },
    });
    expect(yield* classifyClaims([claim(1, "100"), unknown])).toStrictEqual({
      contested: false,
      selection: { _tag: "unresolved" },
    });
  })
);
