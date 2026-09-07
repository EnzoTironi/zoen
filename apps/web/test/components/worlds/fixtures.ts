import type {
  InspectionView,
  WorkspaceView,
} from "../../../src/components/worlds/presentation.ts";

// Synthetic presentation inputs, not provider responses or a backend simulation.
export const inspection: InspectionView = {
  basisLabel: "Arquivos consultados em 5 de setembro de 2026",
  coverageLabel: "Parcial · outras fontes podem estar ausentes",
  evidence: {
    excerpt:
      '"compromisso": "Mensalidade de setembro"\n"valor": "480.00"\n"moeda": "BRL"',
    location: "Registro 2 · valor informado",
    retainedAt: "5 de setembro de 2026, 09:42",
    sourceName: "Compromissos.json",
  },
  explanation:
    "Os registros disponíveis indicam valores diferentes para este compromisso. Confira as fontes antes de esclarecer a informação.",
  interactionKey: "synthetic-inspection-a",
  scope: "Mensalidade de setembro de 2026",
  sources: [
    {
      description: "Valor informado para a mensalidade.",
      id: "source-a",
      location: "Registro 2 · setembro de 2026",
      name: "Compromissos.json",
      value: "R$ 480,00",
    },
    {
      description: "Outro valor informado para o mesmo compromisso.",
      id: "source-b",
      location: "Registro 1 · setembro de 2026",
      name: "Revisão.json",
      value: "R$ 520,00",
    },
  ],
  statusLabel: "Informações divergentes",
  title: "Mensalidade de setembro",
  verificationLabel: "Não verificado",
};

export const views = {
  denied: { kind: "denied" },
  empty: { kind: "empty" },
  inspection: { inspection, kind: "inspection" },
  unavailable: { kind: "unavailable" },
  unknown: {
    inspection: {
      ...inspection,
      explanation:
        "Os registros disponíveis não permitem determinar o valor deste compromisso.",
      sources: [],
      statusLabel: "Ainda não sabemos",
    },
    kind: "inspection",
  },
  uploading: {
    kind: "uploading",
    message: "Recebendo Compromissos.json. Aguarde a confirmação.",
  },
} satisfies Record<string, WorkspaceView>;
