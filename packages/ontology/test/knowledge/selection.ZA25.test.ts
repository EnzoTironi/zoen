import { expect, it } from "@effect/vitest";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import { ExactAmount } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { classifyClaims } from "../../src/knowledge/selection.js";
import { compareAmounts } from "../../src/values/amount.js";

/** Finance-shaped ledger/statement claims — same law as EX08, named for ZA-25. */
const record = (
  id: number,
  amount: string,
  options: {
    readonly currency?: "BRL" | "USD" | "EUR";
    readonly from?: string;
    readonly label?: string;
    readonly namespace?: string;
    readonly subjectKey?: string;
    readonly to?: string;
    readonly valueTag?: "Known" | "Unknown";
  } = {}
) =>
  Schema.decodeSync(VisibleClaim)({
    claimRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    evidenceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    predicate: "obligation.amount",
    recordId: `fatura-${id}`,
    recordIndex: 0,
    source: {
      externalId: `list-${id}`,
      label: options.label ?? `Lista ${id}`,
      namespace: options.namespace ?? "finance.test",
      revision: "1",
    },
    sourceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    subjectKey: options.subjectKey ?? "fatura-consultoria-2026-09",
    validTime: {
      _tag: "DateInterval",
      from: options.from ?? "2026-09-01",
      to: options.to ?? "2026-10-01",
    },
    value:
      options.valueTag === "Unknown"
        ? { _tag: "Unknown" }
        : {
            _tag: "Known",
            amount,
            currency: options.currency ?? "BRL",
          },
    verification: "unverified",
  });

const money = (amount: string, currency: "BRL" | "USD" | "EUR" = "BRL") =>
  Schema.decodeSync(ExactAmount)({ amount, currency });

it.effect(
  "ZA-25-01 overlapping ledger vs statement with different amounts stay contested",
  () =>
    Effect.gen(function* contestedFinance() {
      const ledger = record(1, "3500.00", {
        label: "Livro-razão / faturas — setembro (reconhecimento)",
        namespace: "finance.ledger",
      });
      const statement = record(2, "3200.00", {
        label: "Extrato autorizado — setembro (liquidação reportada)",
        namespace: "finance.statement",
      });
      expect(yield* classifyClaims([ledger, statement])).toStrictEqual({
        contested: true,
        selection: { _tag: "unresolved" },
      });
      expect(ledger.verification).toBe("unverified");
      expect(statement.verification).toBe("unverified");
    })
);

it.effect(
  "ZA-25-02 same numeric amount different currency is not comparable — no forced equivalence",
  () =>
    Effect.gen(function* currencyMismatch() {
      expect(
        yield* compareAmounts(money("890.00", "BRL"), money("890.00", "USD"))
      ).toStrictEqual({ _tag: "NotComparable", reason: "CurrencyMismatch" });

      const ledgerBrl = record(1, "890.00", {
        currency: "BRL",
        label: "Fatura BRL",
        namespace: "finance.ledger",
        subjectKey: "fatura-software-2026-09",
      });
      const statementUsd = record(2, "890.00", {
        currency: "USD",
        label: "Extrato USD",
        namespace: "finance.statement",
        subjectKey: "fatura-software-2026-09",
      });
      const result = yield* classifyClaims([ledgerBrl, statementUsd]);
      expect(result).toStrictEqual({
        contested: false,
        selection: {
          _tag: "set-valued",
          claimRefs: [ledgerBrl.claimRef, statementUsd.claimRef],
        },
      });
    })
);

it.effect(
  "ZA-25-02 matching recognized vs statement amounts stay set-valued and unverified — no inferred settlement",
  () =>
    Effect.gen(function* recognitionNotSettlement() {
      const recognized = record(1, "890.00", {
        label: "Livro-razão / faturas — setembro (reconhecimento)",
        namespace: "finance.ledger",
        subjectKey: "fatura-software-2026-09",
      });
      const reported = record(2, "890.00", {
        label: "Extrato autorizado — setembro (liquidação reportada)",
        namespace: "finance.statement",
        subjectKey: "fatura-software-2026-09",
      });
      const result = yield* classifyClaims([recognized, reported]);
      expect(result.contested).toBeFalsy();
      expect(result.selection._tag).toBe("set-valued");
      expect(recognized.verification).toBe("unverified");
      expect(reported.verification).toBe("unverified");
    })
);
