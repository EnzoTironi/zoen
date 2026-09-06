import { useId } from "react";

import { field } from "../d01/form.ts";
import type { WorkspaceState } from "../d01/model.ts";
import type { WorkspaceController } from "../d01/state.ts";
import { privateAudience, recoveryNotice } from "./model.ts";

const FrameSummary = ({ state }: { readonly state: WorkspaceState }) => {
  const { frame } = state.identity;
  if (frame === null) {
    return <p>Nenhuma inspeção de identidade nesta sessão.</p>;
  }
  return (
    <section aria-label="Frame de identidade">
      <p>
        Tipo: {frame.kind}. Referência: {frame.frameRef}. Fechamento:{" "}
        {frame.closureAnchors.join(", ")}. Células: {frame.cells.length}.
      </p>
      {frame.kind === "subject-identity-recovery" ? (
        <p role="note">{recoveryNotice}</p>
      ) : (
        <p>
          Claims no Frame: {frame.claims.length}. Use proposta same-as apenas
          com este Frame comparativo.
        </p>
      )}
      <ul>
        {frame.cells.map((cell) => (
          <li key={cell.cellRef}>
            Célula {cell.cellRef.slice(0, 12)}… · componentes:{" "}
            {cell.components
              .map((component) => component.members.join("="))
              .join(" | ")}
          </li>
        ))}
      </ul>
    </section>
  );
};

const QuestionPanel = ({
  state,
  controller,
}: {
  readonly state: WorkspaceState;
  readonly controller: WorkspaceController;
}) => {
  const { question, pendingAnswer } = state.identity;
  if (question === null) {
    return null;
  }
  const disabled = state.busy || state.canRetry;
  const answers = question.alternatives.map((item) => item.answer);
  return (
    <section aria-label="Question de identidade">
      <h3>Question {question.kind}</h3>
      <p>
        Digest: {question.consequenceDigest}. Case: {question.caseRef}.
        Audiência: {question.audience}.
      </p>
      {"comparison" in question ? <p role="note">{recoveryNotice}</p> : null}
      {question.blockedAlternatives.length > 0 ? (
        <p>
          Bloqueadas:{" "}
          {question.blockedAlternatives
            .map((item) => `${item.answer} (${item.reason})`)
            .join("; ")}
          .
        </p>
      ) : null}
      {pendingAnswer === null ? (
        <div className="d01-action-row">
          {answers.map((answer) => (
            <button
              className="d01-button"
              disabled={disabled}
              key={answer}
              onClick={() => {
                controller.prepareIdentityAnswer(answer);
              }}
              type="button"
            >
              Revisar resposta {answer}
            </button>
          ))}
        </div>
      ) : (
        <section aria-label="Confirmar resposta de identidade">
          <p>
            Confirmar resposta <strong>{pendingAnswer}</strong> com o digest
            exibido. Em caso de Stale, inspecione de novo e confirme uma nova
            intenção; retry de Unavailable reutiliza o mesmo operationId/digest.
          </p>
          <div className="d01-action-row">
            <button
              className="d01-button d01-button-primary"
              disabled={disabled}
              onClick={() => {
                controller.confirmIdentityAnswer();
              }}
              type="button"
            >
              Confirmar {pendingAnswer}
            </button>
            <button
              className="d01-button"
              disabled={disabled}
              onClick={() => {
                controller.prepareIdentityAnswer(null);
              }}
              type="button"
            >
              Cancelar revisão
            </button>
          </div>
        </section>
      )}
    </section>
  );
};

export const SubjectIdentityPanel = ({
  state,
  controller,
}: {
  readonly state: WorkspaceState;
  readonly controller: WorkspaceController;
}) => {
  const id = useId();
  if (state.membership?.role !== "owner") {
    return null;
  }
  if (state.world === null) {
    return null;
  }
  const disabled = state.busy || state.canRetry;
  const { frame, stale, resolved, receipt } = state.identity;
  return (
    <section
      aria-label="Identidade de assuntos"
      className="d01-workspace d01-context"
    >
      <div className="d01-context-inner">
        <h2>Identidade privada entre assuntos</h2>
        <p>{privateAudience}</p>
        {stale ? (
          <p aria-label="Identidade obsoleta" role="alert">
            A base de identidade mudou (Stale). Inspecione novamente e confirme
            uma nova intenção com novo operationId; não reutilize a confirmação
            anterior.
          </p>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const anchors = field(data, "anchors")
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0);
            controller.inspectIdentity(
              anchors,
              field(data, "from"),
              field(data, "to")
            );
          }}
        >
          <label htmlFor={`${id}-anchors`}>
            Âncoras (1 ou 2, separadas por vírgula)
          </label>
          <input
            disabled={disabled}
            id={`${id}-anchors`}
            name="anchors"
            required
            type="text"
          />
          <label htmlFor={`${id}-from`}>Intervalo de</label>
          <input
            defaultValue="2026-09-01"
            disabled={disabled}
            id={`${id}-from`}
            name="from"
            required
            type="text"
          />
          <label htmlFor={`${id}-to`}>até (exclusivo)</label>
          <input
            defaultValue="2026-10-01"
            disabled={disabled}
            id={`${id}-to`}
            name="to"
            required
            type="text"
          />
          <button className="d01-button" disabled={disabled} type="submit">
            Inspecionar identidade
          </button>
        </form>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const target = field(data, "target");
            controller.inspectIdentityRecovery(
              field(data, "anchor"),
              field(data, "from"),
              field(data, "to"),
              target === "" ? null : target
            );
          }}
        >
          <h3>Recuperação estrutural</h3>
          <label htmlFor={`${id}-recovery-anchor`}>Âncora</label>
          <input
            disabled={disabled}
            id={`${id}-recovery-anchor`}
            name="anchor"
            required
            type="text"
          />
          <label htmlFor={`${id}-recovery-from`}>Intervalo de</label>
          <input
            defaultValue="2026-09-01"
            disabled={disabled}
            id={`${id}-recovery-from`}
            name="from"
            required
            type="text"
          />
          <label htmlFor={`${id}-recovery-to`}>até (exclusivo)</label>
          <input
            defaultValue="2026-10-01"
            disabled={disabled}
            id={`${id}-recovery-to`}
            name="to"
            required
            type="text"
          />
          <label htmlFor={`${id}-target`}>Decisão alvo (opcional)</label>
          <input
            disabled={disabled}
            id={`${id}-target`}
            name="target"
            type="text"
          />
          <button className="d01-button" disabled={disabled} type="submit">
            Inspecionar recuperação
          </button>
        </form>
        <FrameSummary state={state} />
        {frame?.kind === "subject-identity" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              controller.proposeSameAs(
                field(data, "left"),
                field(data, "right")
              );
            }}
          >
            <h3>Propor same-as</h3>
            <label htmlFor={`${id}-left`}>Esquerda</label>
            <input
              disabled={disabled}
              id={`${id}-left`}
              name="left"
              required
              type="text"
            />
            <label htmlFor={`${id}-right`}>Direita</label>
            <input
              disabled={disabled}
              id={`${id}-right`}
              name="right"
              required
              type="text"
            />
            <button className="d01-button" disabled={disabled} type="submit">
              Propor resolução
            </button>
          </form>
        ) : null}
        {frame === null ? null : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              controller.proposeIdentitySplit(
                field(new FormData(event.currentTarget), "anchor")
              );
            }}
          >
            <h3>Propor split</h3>
            <p>
              Separa a âncora informada dos demais membros do componente em cada
              célula do Frame atual.
            </p>
            <label htmlFor={`${id}-split-anchor`}>Âncora a separar</label>
            <input
              disabled={disabled}
              id={`${id}-split-anchor`}
              name="anchor"
              required
              type="text"
            />
            <button className="d01-button" disabled={disabled} type="submit">
              Propor partição
            </button>
          </form>
        )}
        {frame === null ? null : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              controller.proposeIdentityUndo(
                field(new FormData(event.currentTarget), "decision")
              );
            }}
          >
            <h3>Propor undo</h3>
            <label htmlFor={`${id}-undo`}>Decisão a inverter</label>
            <input
              disabled={disabled}
              id={`${id}-undo`}
              name="decision"
              required
              type="text"
            />
            <button className="d01-button" disabled={disabled} type="submit">
              Propor undo
            </button>
          </form>
        )}
        <QuestionPanel controller={controller} state={state} />
        {resolved === null ? null : (
          <p>
            Última resolução: {resolved.outcome}
            {resolved.decisionRef === null
              ? ""
              : ` · decisão ${resolved.decisionRef}`}
            .
          </p>
        )}
        {receipt === null || !("receiptRef" in receipt) ? null : (
          <p>Recibo: {receipt.receiptRef}.</p>
        )}
      </div>
    </section>
  );
};
