import type { WorkspaceState } from "../d01/model.ts";
import type { WorkspaceController } from "../d01/state.ts";
import { entireWorldScope, noRestoreNotice } from "./model.ts";

export const ErasurePanel = ({
  state,
  controller,
}: {
  readonly state: WorkspaceState;
  readonly controller: WorkspaceController;
}) => {
  if (state.membership?.role !== "owner") {
    return null;
  }
  if (state.world === null) {
    return null;
  }
  const disabled = state.busy || state.canRetry;
  const { progress, confirmation, receipt, stale } = state.erasure;
  const expectedRevision =
    progress === null || progress.revision === "0" ? null : progress.revision;
  return (
    <section
      aria-label="Exclusão do espaço"
      className="d01-workspace d01-context"
    >
      <div className="d01-context-inner">
        <h2>Exclusão autorizada deste espaço</h2>
        <p>{entireWorldScope}</p>
        <p>{noRestoreNotice}</p>
        {stale ? (
          <p aria-label="Exclusão obsoleta" role="alert">
            O estado de exclusão mudou (Stale). Inspecione novamente e confirme
            uma nova intenção com novo operationId; não reutilize a confirmação
            anterior.
          </p>
        ) : null}
        <div className="d01-action-row">
          <button
            className="d01-button"
            disabled={disabled}
            onClick={() => {
              controller.inspectWorldErasure();
            }}
            type="button"
          >
            Inspecionar progresso de exclusão
          </button>
        </div>
        {progress === null ? null : (
          <section aria-label="Progresso administrativo de exclusão">
            <p>
              Fase: {progress.phase}. Revisão: {progress.revision}. Registro
              externo: {progress.attemptExternalState}. Restore após erasure:{" "}
              {progress.restoreAfterErasure ? "true" : "false"}.
            </p>
            {progress.phase === "Erased" || progress.phase === "Purging" ? (
              <p role="note">
                Esta superfície não promove nem executa purge/Erased; o
                progresso acima é somente leitura administrativa.
              </p>
            ) : null}
            {progress.phase === "Active" && !confirmation ? (
              <button
                className="d01-button"
                disabled={disabled}
                onClick={() => {
                  controller.prepareWorldErasure();
                }}
                type="button"
              >
                Revisar exclusão do espaço inteiro
              </button>
            ) : null}
            {confirmation ? (
              <section aria-label="Confirmar exclusão do espaço">
                <h3>Confirmar exclusão do espaço inteiro</h3>
                <p>
                  Espaço: {state.world.worldId}. Revisão confirmada:{" "}
                  {expectedRevision ?? "ausência de progresso (null)"}.
                </p>
                <p>
                  Confirmação explícita de escopo World inteiro. Em Unavailable,
                  repita a mesma intenção (mesmo operationId). Em Stale,
                  inspecione de novo e confirme uma nova operação.
                </p>
                <div className="d01-action-row">
                  <button
                    className="d01-button d01-button-primary"
                    disabled={disabled}
                    onClick={() => {
                      controller.confirmWorldErasure();
                    }}
                    type="button"
                  >
                    Confirmar exclusão do espaço inteiro
                  </button>
                  <button
                    className="d01-button"
                    disabled={state.busy}
                    onClick={() => {
                      controller.cancelWorldErasure();
                    }}
                    type="button"
                  >
                    Cancelar confirmação
                  </button>
                </div>
              </section>
            ) : null}
          </section>
        )}
        {receipt === null ? null : (
          <p>
            Recibo imutável de Closing: {receipt.receiptRef}. Fase no recibo:{" "}
            {receipt.phase}. Não comprova Erased nem restauração.
          </p>
        )}
      </div>
    </section>
  );
};
