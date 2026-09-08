import { expect, it } from "@effect/vitest";
import { ImportDocument, VisibleClaim } from "@zoen/contracts/worlds/evidence";
import { Effect, Option, Schema } from "effect";

import { classifyClaims } from "../../src/knowledge/selection.js";

/** Clinic-administrative appointment/fee claims — same law as EX08, named for ZA-24. */
const appointment = (
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
    recordId: `consulta-${id}`,
    recordIndex: 0,
    source: {
      externalId: `list-${id}`,
      label: options.label ?? `Lista ${id}`,
      namespace: options.namespace ?? "clinic.test",
      revision: "1",
    },
    sourceRef: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    subjectKey:
      options.subjectKey ?? "compromisso-consulta-ortodontia-2026-09-22",
    validTime: {
      _tag: "DateInterval",
      from: options.from ?? "2026-09-22",
      to: options.to ?? "2026-09-23",
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

it.effect(
  "ZA-24-01 overlapping clinic agenda vs fee quotes with different amounts stay contested",
  () =>
    Effect.gen(function* contestedFees() {
      const agenda = appointment(1, "280.00", {
        label: "Agenda administrativa — 22/09",
        namespace: "clinic.appointments",
      });
      const fees = appointment(2, "350.00", {
        label: "Tabela de honorários — 22/09",
        namespace: "clinic.fees",
      });
      expect(yield* classifyClaims([agenda, fees])).toStrictEqual({
        contested: true,
        selection: { _tag: "unresolved" },
      });
    })
);

it.effect(
  "ZA-24-02 clinical predicates are rejected before retrieval — not in admitted wire schema",
  () =>
    Effect.sync(() => {
      for (const predicate of [
        "diagnosis.code",
        "treatment.plan",
        "clinical.note",
        "patient.chart",
      ] as const) {
        expect(
          Option.isNone(
            Schema.decodeUnknownOption(ImportDocument)({
              records: [
                {
                  externalId: "chart-row",
                  predicate,
                  subjectKey: "paciente-excluido",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-22",
                    to: "2026-09-23",
                  },
                  value: { _tag: "Known", amount: "1.00", currency: "BRL" },
                },
              ],
              schemaVersion: "worlds.v1",
              source: {
                externalId: "clinical-corpus",
                label: "Prontuário clínico (excluído)",
                namespace: "clinic.clinical",
                revision: "1",
              },
            })
          )
        ).toBeTruthy();
      }
    })
);

it.effect(
  "ZA-24-02 excluded clinical source shape never becomes an admitted ImportDocument",
  () =>
    Effect.sync(() => {
      // Extra clinical-looking fields must not sneak past the exact schema.
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ImportDocument)({
            diagnosis: "K02.1",
            records: [
              {
                externalId: "consulta-ortodontia-2026-09-22",
                predicate: "obligation.amount",
                subjectKey: "compromisso-consulta-ortodontia-2026-09-22",
                treatmentPlan: "aparelho-fixo",
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-22",
                  to: "2026-09-23",
                },
                value: { _tag: "Known", amount: "280.00", currency: "BRL" },
              },
            ],
            schemaVersion: "worlds.v1",
            source: {
              externalId: "smuggled-clinical",
              label: "Fonte com campos clínicos",
              namespace: "clinic.clinical",
              revision: "1",
            },
          })
        )
      ).toBeTruthy();
    })
);
