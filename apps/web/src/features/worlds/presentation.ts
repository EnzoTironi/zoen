import type { SemanticError } from "@zoen/contracts/worlds/errors";
import type { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import type { EvidenceOpened } from "@zoen/contracts/worlds/operations";
import type { ValidTime } from "@zoen/contracts/worlds/values";

import type {
  InspectionView,
  WorkspaceView,
} from "../../components/worlds/presentation.ts";

export const intervalLabel = (interval: ValidTime) =>
  interval._tag === "Unknown"
    ? "Período desconhecido"
    : `${interval.from} até ${interval.to} (fim exclusivo)`;

export const errorMessage = (error: SemanticError) => {
  switch (error._tag) {
    case "Unauthenticated": {
      return "Sua sessão terminou. Entre novamente.";
    }
    case "NotFoundOrDenied": {
      return "Seu acesso atual não permite abrir este conteúdo.";
    }
    case "InvalidInput": {
      return "Confira o arquivo e os campos informados. O conteúdo não foi admitido.";
    }
    case "QuotaExceeded": {
      return "O arquivo ultrapassa o limite permitido.";
    }
    case "Conflict": {
      return "Esta tentativa não corresponde à intenção já registrada.";
    }
    case "Expired": {
      return "A solicitação expirou. Confira o estado antes de tentar novamente.";
    }
    case "Blocked": {
      return "Esta ação está indisponível para o perfil atual.";
    }
    case "Unsupported": {
      return "Esta operação ainda não está disponível.";
    }
    case "Stale": {
      return "A base mudou. Consulte novamente antes de propor outra decisão.";
    }
    case "HistoricalContentUnavailable": {
      return "O conteúdo desta leitura histórica está indisponível.";
    }
    case "RetryableInfrastructureFailure":
    case "Unavailable": {
      return "Não foi possível confirmar o resultado. Você pode repetir a mesma tentativa.";
    }
    default: {
      return "Não foi possível concluir esta ação.";
    }
  }
};

export const errorView = (error: SemanticError): WorkspaceView => {
  if (error._tag === "InvalidInput" || error._tag === "QuotaExceeded") {
    return { kind: "empty" };
  }
  if (error._tag === "Unauthenticated" || error._tag === "NotFoundOrDenied") {
    return { kind: "denied" };
  }
  return { kind: "unavailable" };
};

export const inspectionView = (
  frame: VisibleFrame,
  interactionContext: string,
  opened?: typeof EvidenceOpened.Type
): InspectionView => {
  const source =
    opened === undefined
      ? undefined
      : frame.claims.find((claim) => claim.evidenceRef === opened.evidenceRef);
  const selection = {
    selected: "Fonte selecionada",
    "set-valued": "Mais de uma possibilidade",
    unknown: "Valor desconhecido",
    unresolved: "Ainda sem conclusão",
  }[frame.selection._tag];
  return {
    basisLabel: `Leitura ${frame.frameRef}`,
    coverageLabel:
      frame.coverage._tag === "Partial"
        ? "Parcial — somente fontes disponíveis neste contexto"
        : "Desconhecida",
    explanation: frame.contested
      ? "As listas importadas divergem sobre o mesmo compromisso em um período comparável. Confira ambas as fontes e a interpretação atual."
      : "Estes registros refletem o conteúdo das fontes disponíveis nesta leitura.",
    interactionKey: `${interactionContext}:${frame.worldRef.realm}:${frame.worldRef.worldId}:${frame.frameRef}`,
    scope: frame.subjectKey,
    sources: frame.claims.map((claim) => ({
      description: intervalLabel(claim.validTime),
      id: claim.claimRef,
      location: `${claim.source.namespace} · revisão ${claim.source.revision} · registro ${claim.recordIndex + 1} (${claim.recordId})`,
      name: claim.source.label,
      value:
        claim.value._tag === "Known"
          ? `${claim.value.amount} ${claim.value.currency}`
          : "Valor desconhecido",
    })),
    statusLabel: frame.contested
      ? `${selection} · fontes divergentes`
      : selection,
    title: frame.subjectKey,
    verificationLabel: "Não verificado — não comprova pagamento",
    ...(opened !== undefined && source !== undefined
      ? {
          evidence: {
            excerpt: opened.document,
            location: `${source.source.namespace} · revisão ${source.source.revision}`,
            retainedAt: "data não informada nesta resposta",
            sourceName: source.source.label,
          },
        }
      : {}),
  };
};
