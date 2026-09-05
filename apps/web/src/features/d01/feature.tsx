import { Option, Schema } from "effect";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { D01Workspace } from "../../components/d01/d01-workspace.tsx";
import { intervalLabel } from "./presentation.ts";
import { createWorkspaceController } from "./state.ts";
import type { WorkspaceController } from "./state.ts";

import "./feature.css";

const field = (data: FormData, name: string) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Schema.String)(data.get(name)),
    () => ""
  );

const Login = ({
  controller,
}: {
  readonly controller: WorkspaceController;
}) => {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  );
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const id = useId();
  const submitLabel = mode === "sign-in" ? "Entrar" : "Criar conta";
  return (
    <div className="d01-workspace">
      <main className="d01-account">
        <p className="d01-eyebrow">Zoen · seu espaço privado</p>
        <h1>
          {mode === "sign-in" ? "Entre para continuar" : "Crie sua conta"}
        </h1>
        <p>Reúna fontes e confira o que elas dizem sobre seus compromissos.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const email = field(data, "email");
            const password = field(data, "password");
            const name = field(data, "name");
            form.reset();
            controller.authenticate(mode, email, password, name);
          }}
        >
          <fieldset disabled={state.busy || state.checking}>
            <legend className="d01-visually-hidden">
              {mode === "sign-in" ? "Entrar" : "Criar conta"}
            </legend>
            {mode === "sign-up" ? (
              <>
                <label htmlFor={`${id}-name`}>Nome</label>
                <input
                  autoComplete="name"
                  id={`${id}-name`}
                  name="name"
                  required
                  type="text"
                />
              </>
            ) : null}
            <label htmlFor={`${id}-email`}>Email</label>
            <input
              autoComplete="email"
              id={`${id}-email`}
              name="email"
              required
              type="email"
            />
            <label htmlFor={`${id}-password`}>Senha</label>
            <input
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              id={`${id}-password`}
              minLength={12}
              name="password"
              required
              type="password"
            />
            <p className="d01-muted">
              Use pelo menos 12 caracteres. O email identifica sua conta local.
            </p>
            <button className="d01-button d01-button-primary" type="submit">
              {state.busy ? "Aguarde…" : submitLabel}
            </button>
          </fieldset>
        </form>
        <button
          className="d01-button d01-button-quiet"
          disabled={state.busy || state.checking}
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          }}
          type="button"
        >
          {mode === "sign-in" ? "Quero criar uma conta" : "Já tenho uma conta"}
        </button>
        <output aria-live="polite">
          {state.checking ? "Verificando sua sessão…" : state.feedback}
        </output>
      </main>
    </div>
  );
};

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
    return <Login controller={controller} />;
  }
  return (
    <>
      <section
        aria-label="Contexto do espaço privado"
        className="d01-workspace d01-context"
      >
        <div className="d01-context-inner">
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
                  controller.inspect(subject);
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
            onRetry={() => {
              controller.retry();
            }}
            view={state.view}
          />
          {state.frame !== null && state.frame.scopedCorrections.length > 0 ? (
            <section
              aria-label="Decisões por período"
              className="d01-workspace d01-context"
            >
              <h2>Suas decisões por período</h2>
              <ul>
                {state.frame.scopedCorrections.map((correction) => (
                  <li key={correction.correctionRef}>
                    <strong>{correction.subjectKey}</strong> ·{" "}
                    {intervalLabel(correction.validTime)} ·{" "}
                    {correction.choice._tag === "unknown"
                      ? "Não sei responder"
                      : `Referência escolhida: ${correction.choice.claimRef}`}
                    <p>
                      Recibo {correction.receiptRef}. Esta anotação não
                      substitui os registros das fontes.
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
