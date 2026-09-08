import { randomUUID } from "node:crypto";

import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { inspectionView } from "../../../src/features/worlds/presentation.ts";

const contestedClinicFrame = Schema.decodeUnknownSync(VisibleFrame)({
  claims: [
    {
      amount: "280.00",
      label: "Agenda administrativa — 22/09",
      namespace: "clinic.appointments",
    },
    {
      amount: "350.00",
      label: "Tabela de honorários — 22/09",
      namespace: "clinic.fees",
    },
  ].map((item, index) => ({
    claimRef: randomUUID(),
    evidenceRef: randomUUID(),
    predicate: "obligation.amount",
    recordId: `consulta-${index}`,
    recordIndex: index,
    source: {
      externalId: `list-${index}`,
      label: item.label,
      namespace: item.namespace,
      revision: "1",
    },
    sourceRef: randomUUID(),
    subjectKey: "compromisso-consulta-ortodontia-2026-09-22",
    validTime: {
      _tag: "DateInterval",
      from: "2026-09-22",
      to: "2026-09-23",
    },
    value: { _tag: "Known", amount: item.amount, currency: "BRL" },
    verification: "unverified",
  })),
  contested: true,
  coverage: { _tag: "Partial" },
  frameRef: randomUUID(),
  scopedCorrections: [],
  selection: { _tag: "unresolved" },
  subjectKey: "compromisso-consulta-ortodontia-2026-09-22",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});

describe("ZA-24 clinic administrative presentation", () => {
  it("ZA-24-01 contested appointment/fee lists show scoped competing claims", () => {
    const view = inspectionView(contestedClinicFrame, "clinic-session");
    expect(view.title).toBe("compromisso-consulta-ortodontia-2026-09-22");
    expect(view.explanation).toMatch(/fontes divergem/u);
    expect(view.statusLabel).toContain("fontes divergentes");
    expect(view.sources.map((source) => source.name)).toStrictEqual([
      "Agenda administrativa — 22/09",
      "Tabela de honorários — 22/09",
    ]);
    expect(view.verificationLabel).toBe(
      "Não verificado — não comprova pagamento"
    );
  });
});
