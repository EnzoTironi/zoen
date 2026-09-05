import { useId } from "react";

import { field } from "../d01/form.ts";
import type { WorkspaceState } from "../d01/model.ts";
import type { WorkspaceController } from "../d01/state.ts";
import type { AccessTarget } from "./model.ts";
import { audience } from "./model.ts";

const TargetPanel = ({
  state,
  controller,
  target,
}: {
  readonly state: WorkspaceState;
  readonly controller: WorkspaceController;
  readonly target: AccessTarget;
}) => {
  const { confirmation } = state.sharing;
  const disabled = state.busy || state.canRetry;
  return (
    <section aria-label="Acesso consultado">
      <p>Destinatário: {target.principalRef}</p>
      <p>
        Estado na consulta atual:{" "}
        {target.membership === null
          ? "sem membership"
          : `${target.membership.role === "owner" ? "proprietário" : "leitor"} · ${target.membership.state === "active" ? "ativo" : "revogado"} · revisão ${target.membership.revision}`}
        .
      </p>
      {target.membership?.role === "owner" ? (
        <p>O proprietário não pode ser alvo de concessão ou revogação.</p>
      ) : null}
      {target.membership?.role !== "owner" && confirmation === null ? (
        <div className="d01-action-row">
          <button
            className="d01-button"
            disabled={disabled}
            onClick={() => {
              controller.prepareAccess("grant");
            }}
            type="button"
          >
            Revisar concessão de leitura
          </button>
          {target.membership === null ? null : (
            <button
              className="d01-button"
              disabled={disabled}
              onClick={() => {
                controller.prepareAccess("revoke");
              }}
              type="button"
            >
              Revisar revogação de leitura
            </button>
          )}
        </div>
      ) : null}
      {target.membership?.role !== "owner" && confirmation !== null ? (
        <section aria-label="Confirmar alteração de acesso">
          <h3>
            {confirmation === "grant"
              ? "Confirmar concessão"
              : "Confirmar revogação"}
          </h3>
          <p>{audience}</p>
          <p>
            Espaço: {state.world?.worldId}. Destinatário: {target.principalRef}.
            Revisão confirmada:{" "}
            {target.membership?.revision ?? "ausência de membership"}.
          </p>
          <p>
            Revogar impede novas leituras autorizadas. Não apaga evidências,
            histórico, backups ou cópias já recebidas.
          </p>
          <button
            className="d01-button d01-button-primary"
            disabled={disabled}
            onClick={() => {
              controller.confirmAccess();
            }}
            type="button"
          >
            {confirmation === "grant"
              ? "Conceder leitura de todo o espaço"
              : "Revogar leitura do espaço"}
          </button>
          <button
            className="d01-button"
            disabled={state.busy}
            onClick={() => {
              controller.cancelAccess();
            }}
            type="button"
          >
            Cancelar confirmação
          </button>
        </section>
      ) : null}
    </section>
  );
};

export const SharingPanel = ({
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
  const { target, receipt, stale } = state.sharing;
  return (
    <section
      aria-label="Compartilhar leitura"
      className="d01-workspace d01-context"
    >
      <div className="d01-context-inner">
        <h2>Compartilhar leitura deste espaço</h2>
        <p>
          Peça à pessoa o identificador da conta dela. Informe o UUID exato; não
          há busca por email ou lista de pessoas.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const principal = field(new FormData(form), "principal");
            form.reset();
            controller.inspectRecipient(principal);
          }}
        >
          <label htmlFor={`${id}-principal`}>
            Identificador exato do destinatário
          </label>
          <input
            disabled={state.busy || state.canRetry}
            id={`${id}-principal`}
            name="principal"
            required
            type="text"
          />
          <button
            className="d01-button"
            disabled={state.busy || state.canRetry}
            type="submit"
          >
            Consultar acesso do destinatário
          </button>
        </form>
        {stale ? (
          <p role="alert">
            O acesso mudou. Consulte o destinatário novamente e confirme uma
            nova intenção.
          </p>
        ) : null}
        {receipt === null ? null : (
          <p>
            Recibo histórico: {receipt.receiptRef}. Registra{" "}
            {receipt._tag === "WorldReadAccessGranted"
              ? "concessão"
              : "revogação"}{" "}
            naquele commit; não comprova acesso atual.
          </p>
        )}
        {target === null && receipt !== null ? (
          <p>
            O estado atual ainda não foi confirmado. Tente novamente a consulta.
          </p>
        ) : null}
        {target === null ? null : (
          <TargetPanel controller={controller} state={state} target={target} />
        )}
      </div>
    </section>
  );
};
