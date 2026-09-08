import { expect, it } from "@effect/vitest";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import { ExactAmount } from "@zoen/contracts/worlds/values";
import { Effect, Option, Schema } from "effect";

import { classifyClaims } from "../../src/knowledge/selection.js";
import { compareAmounts } from "../../src/values/amount.js";

/** Bakery-shaped order commitment claims — same law as EX08, named for ZA-23. */
const order = (
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
    recordId: `pedido-${id}`,
    recordIndex: 0,
    source: {
      externalId: `list-${id}`,
      label: options.label ?? `Lista ${id}`,
      namespace: options.namespace ?? "bakery.test",
      revision: "1",
    },
    sourceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    subjectKey: options.subjectKey ?? "pedido-bolo-casamento-2026-09-20",
    validTime: {
      _tag: "DateInterval",
      from: options.from ?? "2026-09-20",
      to: options.to ?? "2026-09-21",
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
  "ZA-23-01 overlapping bakery order quotes with different amounts stay contested",
  () =>
    Effect.gen(function* contestedOrders() {
      const customers = order(1, "450.00", {
        label: "Lista de pedidos dos clientes — 20/09",
        namespace: "bakery.orders",
      });
      const shop = order(2, "520.00", {
        label: "Lista de produção da loja — 20/09",
        namespace: "bakery.shop",
      });
      expect(yield* classifyClaims([customers, shop])).toStrictEqual({
        contested: true,
        selection: { _tag: "unresolved" },
      });
    })
);

it.effect(
  "ZA-23-02 recipe grams are rejected — not admitted as amount currency",
  () =>
    Effect.sync(() => {
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ExactAmount)({
            amount: "500",
            currency: "g",
          })
        )
      ).toBeTruthy();
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ExactAmount)({
            amount: "2.5",
            currency: "kg",
          })
        )
      ).toBeTruthy();
    })
);

it.effect(
  "ZA-23-02 unknown stock notes and currency mismatch are not coerced into revenue",
  () =>
    Effect.gen(function* unsupportedMass() {
      const quoted = order(1, "450.00", {
        label: "Pedido cotado",
        namespace: "bakery.orders",
      });
      const unknownStock = order(2, "0", {
        label: "Nota de estoque (sem semântica admitida)",
        namespace: "bakery.stock-notes",
        valueTag: "Unknown",
      });
      const mixed = yield* classifyClaims([quoted, unknownStock]);
      expect(mixed.contested).toBeFalsy();
      expect(mixed.selection._tag).toBe("unresolved");

      expect(
        yield* compareAmounts(money("500", "BRL"), money("500", "USD"))
      ).toStrictEqual({ _tag: "NotComparable", reason: "CurrencyMismatch" });

      const euros = order(3, "450.00", {
        currency: "EUR",
        label: "Cotação EUR",
        namespace: "bakery.export",
      });
      expect((yield* classifyClaims([quoted, euros])).contested).toBeFalsy();
    })
);
