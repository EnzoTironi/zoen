import { useEffect, useId, useMemo, useSyncExternalStore } from "react";

import { D01Workspace } from "../../components/d01/d01-workspace.tsx";
import { CorrectionPanel } from "../../integration/d02/correction-panel.tsx";
import { AuthForm } from "./auth-form.tsx";
import { field } from "./form.ts";
import { watchSessionChanges } from "./session-events.ts";
import { createWorkspaceController } from "./state.ts";
import type { WorkspaceController } from "./state.ts";

import "./feature.css";

const Connected = ({
  controller,
}: {
  readonly controller: WorkspaceController;
}) => {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );
  const id = useId();
  if (state.session === null) {
    return <AuthForm controller={controller} />;
  }
  return (
    <>
      <section
        aria-label="Contexto do espaço privado"
        className="d01-workspace d01-context"
      >
        <div className="d01-context-inner">
          <output aria-live="polite">{state.actionError}</output>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const worldId = field(new FormData(form), "world");
              form.reset();
              controller.selectWorld(worldId);
            }}
          >
            <label htmlFor={`${id}-world`}>
              Abrir espaço pelo identificador
            </label>
            <div className="d01-action-row">
              <input
                disabled={state.busy}
                id={`${id}-world`}
                name="world"
                required
                type="text"
              />
              <button
                className="d01-button"
                disabled={state.busy}
                type="submit"
              >
                Abrir espaço
              </button>
            </div>
          </form>
          <button
            className="d01-button"
            disabled={state.busy}
            onClick={() => {
              controller.createWorld();
            }}
            type="button"
          >
            Criar espaço privado
          </button>
          {state.world === null ? (
            <p>
              Crie um espaço privado ou informe o identificador de um espaço ao
              qual você tem acesso.
            </p>
          ) : (
            <>
              <p className="d01-world-id">
                Espaço atual: <span>{state.world.worldId}</span>
              </p>
              <form
                key={state.world.worldId}
                onSubmit={(event) => {
                  event.preventDefault();
                  const subject = field(
                    new FormData(event.currentTarget),
                    "subject"
                  );
                  const atFrame = field(
                    new FormData(event.currentTarget),
                    "atFrame"
                  );
                  controller.inspect(subject, atFrame === "" ? null : atFrame);
                }}
              >
                <label htmlFor={`${id}-subject`}>
                  Identificador da obrigação
                </label>
                <div className="d01-action-row">
                  <input
                    disabled={state.busy}
                    id={`${id}-subject`}
                    name="subject"
                    placeholder="Ex.: invoice-1"
                    required
                    type="text"
                  />
                  <button
                    className="d01-button d01-button-primary"
                    disabled={state.busy}
                    type="submit"
                  >
                    Consultar fontes
                  </button>
                </div>
                <label htmlFor={`${id}-at-frame`}>
                  Referência de leitura anterior (opcional)
                </label>
                <input
                  disabled={state.busy}
                  id={`${id}-at-frame`}
                  name="atFrame"
                  type="text"
                />
                <p>
                  Deixe em branco para consultar o estado atual. Uma leitura
                  anterior conserva seu contexto histórico.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
      {state.world === null ? (
        <div className="d01-workspace d01-context">
          <button
            className="d01-button"
            onClick={() => {
              controller.logout();
            }}
            type="button"
          >
            Sair
          </button>
          <output aria-live="polite">{state.feedback}</output>
        </div>
      ) : (
        <>
          <D01Workspace
            {...(state.canRetry ? { onRetry: controller.retry } : {})}
            acceptedFileTypes="application/json,.json"
            actionPending={state.busy}
            feedback={state.feedback}
            fileHelp="JSON no formato Zoen d01.v1, até 256 KiB por arquivo. Use apenas dados autorizados e não sensíveis neste perfil."
            onFilesSelected={(files) => {
              controller.importFiles(files);
            }}
            onInspectEvidence={(claim) => {
              controller.openEvidence(claim);
            }}
            onLogout={() => {
              controller.logout();
            }}
            view={state.view}
          />
          <CorrectionPanel controller={controller} state={state} />
        </>
      )}
    </>
  );
};

/** Root composes this export on the same origin as the real server. */
export const D01Feature = () => {
  const controller = useMemo(
    () => createWorkspaceController(window.location.origin),
    []
  );
  useEffect(() => {
    const current = controller;
    current.start();
    const hide = () => {
      current.hide();
    };
    const restore = () => {
      current.hide();
      current.refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        hide();
      } else {
        restore();
      }
    };
    const stopWatchingSession = watchSessionChanges(restore);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    window.addEventListener("popstate", restore);
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        current.refresh();
      }
    }, 5000);
    return () => {
      stopWatchingSession();
      window.clearInterval(interval);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("popstate", restore);
      document.removeEventListener("visibilitychange", visibility);
      current.dispose();
    };
  }, [controller]);
  return <Connected controller={controller} />;
};
