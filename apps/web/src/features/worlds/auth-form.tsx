import { useId, useState, useSyncExternalStore } from "react";

import { field } from "./form.ts";
import type { WorkspaceController } from "./state.ts";

export const AuthForm = ({
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
    <div className="worlds-workspace">
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
