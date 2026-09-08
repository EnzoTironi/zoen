import { expect, it } from "@effect/vitest";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import { Effect, Schema } from "effect";

import { classifyClaims } from "../../src/knowledge/selection.js";

/** Household-shaped obligation claims — same law as EX08, named for ZA-22. */
const bill = (
  id: number,
  amount: string,
  options: {
    readonly currency?: "BRL" | "USD";
    readonly from?: string;
    readonly label?: string;
    readonly namespace?: string;
    readonly subjectKey?: string;
    readonly to?: string;
  } = {}
) =>
  Schema.decodeSync(VisibleClaim)({
    claimRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    evidenceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    predicate: "obligation.amount",
    recordId: `luz-${id}`,
    recordIndex: 0,
    source: {
      externalId: `list-${id}`,
      label: options.label ?? `Lista ${id}`,
      namespace: options.namespace ?? "household.test",
      revision: "1",
    },
    sourceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    subjectKey: options.subjectKey ?? "conta-luz-2026-09",
    validTime: {
      _tag: "DateInterval",
      from: options.from ?? "2026-09-01",
      to: options.to ?? "2026-10-01",
    },
    value: {
      _tag: "Known",
      amount,
      currency: options.currency ?? "BRL",
    },
    verification: "unverified",
  });

it.effect(
  "ZA-22-01 overlapping household bills with different amounts stay contested",
  () =>
    Effect.gen(function* contestedBills() {
      const bank = bill(1, "189.90", {
        label: "Extrato do banco — setembro",
        namespace: "household.bank",
      });
      const sheet = bill(2, "210.00", {
        label: "Planilha de contas — setembro",
        namespace: "household.spreadsheet",
      });
      expect(yield* classifyClaims([bank, sheet])).toStrictEqual({
        contested: true,
        selection: { _tag: "unresolved" },
      });
    })
);

it.effect(
  "ZA-22-02 unrelated subject, disjoint due date, or currency mismatch do not force conflict",
  () =>
    Effect.gen(function* nonComparable() {
      const luz = bill(1, "189.90");
      const agua = bill(2, "72.40", { subjectKey: "conta-agua-2026-09" });
      expect((yield* classifyClaims([luz, agua])).contested).toBeFalsy();

      const october = bill(3, "210.00", {
        from: "2026-10-01",
        to: "2026-11-01",
      });
      expect((yield* classifyClaims([luz, october])).contested).toBeFalsy();

      const dollars = bill(4, "210.00", { currency: "USD" });
      expect((yield* classifyClaims([luz, dollars])).contested).toBeFalsy();

      // Same subject + overlapping time + different amounts remains contested —
      // equal amounts must not silently invent a single selected winner either.
      const equal = bill(5, "189.90", {
        label: "Cópia planilha",
        namespace: "household.spreadsheet",
      });
      const equalResult = yield* classifyClaims([luz, equal]);
      expect(equalResult.contested).toBeFalsy();
      expect(equalResult.selection._tag).toBe("set-valued");
    })
);
