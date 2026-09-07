import type { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { useId } from "react";

import { field } from "../../features/worlds/form.ts";
import { intervalLabel } from "../../features/worlds/presentation.ts";
import type { WorkspaceController } from "../../features/worlds/state.ts";
import type { CorrectionContext } from "./model.ts";

import "./correction.css";

const choiceLabel = (frame: VisibleFrame, claimRef: string) => {
  const claim = frame.claims.find((item) => item.claimRef === claimRef);
  if (claim === undefined) {
    return `Referência ${claimRef}`;
  }
  const value =
    claim.value._tag === "Known"
      ? `${claim.value.amount} ${claim.value.currency}`
      : "Valor desconhecido";
  return `${claim.source.label} · ${value} · ${intervalLabel(claim.validTime)} · ${claim.source.namespace}/${claim.source.externalId} · revisão ${claim.source.revision} · registro ${claim.recordId}`;
};

export const CorrectionPanel = ({
  controller,
  state,
}: {
  readonly controller: WorkspaceController;
  readonly state: CorrectionContext & { readonly busy: boolean };
}) => {
  const id = useId();
  const { frame, proposal } = state;
  if (frame === null) {
    return null;
  }
  return (
    <section
      aria-label="Decisões por período"
      className="worlds-workspace d01-context corrections-panel"
    >
      <h2>Sua decisão sobre este período</h2>
      <p>
        Registre sua interpretação para um intervalo definido. As fontes e a
        indicação de pagamento não verificado permanecem visíveis.
      </p>
      <p>
        Alvo: <strong>{frame.subjectKey}</strong>. Base: leitura{" "}
        {frame.frameRef}.
      </p>
      {proposal === null ? (
        <form
          key={frame.frameRef}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            controller.proposeCorrection(
              field(data, "from"),
              field(data, "to"),
              field(data, "choice")
            );
          }}
        >
          <fieldset disabled={state.busy}>
            <legend>Preparar uma proposta</legend>
            <label htmlFor={`${id}-from`}>Início do período</label>
            <input id={`${id}-from`} name="from" required type="date" />
            <label htmlFor={`${id}-to`}>Fim do período (exclusivo)</label>
            <input id={`${id}-to`} name="to" required type="date" />
            <label htmlFor={`${id}-choice`}>Referência para sua decisão</label>
            <select defaultValue="" id={`${id}-choice`} name="choice" required>
              <option disabled value="">
                Escolha uma fonte ou declare que não sabe
              </option>
              <option value="unknown">
                Não sei qual valor vale neste período
              </option>
              {frame.claims.map((claim) => (
                <option key={claim.claimRef} value={claim.claimRef}>
                  {choiceLabel(frame, claim.claimRef)}
                </option>
              ))}
            </select>
            <button className="d01-button d01-button-primary" type="submit">
              Revisar proposta
            </button>
          </fieldset>
        </form>
      ) : (
        <section aria-label="Proposta para confirmação">
          <h3>Confira o que será registrado</h3>
          <p>
            Obrigação: <strong>{proposal.consequence.subjectKey}</strong>.
          </p>
          <p>Período: {intervalLabel(proposal.consequence.validTime)}.</p>
          <p>
            Decisão:{" "}
            {proposal.consequence.choice._tag === "unknown"
              ? "Não sei qual valor vale neste período"
              : choiceLabel(frame, proposal.consequence.choice.claimRef)}
            .
          </p>
          <p>
            A decisão vale somente nesse intervalo. Ela não altera o texto das
            fontes nem comprova pagamento.
          </p>
          <button
            className="d01-button d01-button-primary"
            disabled={state.busy}
            onClick={() => {
              controller.answerQuestion("confirm");
            }}
            type="button"
          >
            Confirmar decisão
          </button>
          <button
            className="d01-button"
            disabled={state.busy}
            onClick={() => {
              controller.answerQuestion("unknown");
            }}
            type="button"
          >
            Não sei responder
          </button>
          <p>
            “Não sei responder” registra desconhecimento para este período, sem
            escolher uma fonte.
          </p>
        </section>
      )}
      {frame.scopedCorrections.length > 0 ? (
        <section aria-label="Decisões registradas">
          <h3>Suas decisões registradas nesta leitura</h3>
          <ul>
            {frame.scopedCorrections.map((correction) => (
              <li key={correction.correctionRef}>
                <strong>{correction.subjectKey}</strong> ·{" "}
                {intervalLabel(correction.validTime)}
                <p>
                  {correction.choice._tag === "unknown"
                    ? "Não sei responder"
                    : choiceLabel(frame, correction.choice.claimRef)}
                </p>
                <p>
                  Recibo {correction.receiptRef}. Desfazer registra uma nova
                  decisão no histórico.
                </p>
                <button
                  className="d01-button"
                  disabled={state.busy || proposal !== null}
                  onClick={() => {
                    controller.undoCorrection(correction.correctionRef);
                  }}
                  type="button"
                >
                  Desfazer decisão deste período
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
};
