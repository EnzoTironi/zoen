import { useId, useState } from "react";

import type { D01WorkspaceProps, InspectionView } from "./presentation.ts";

import "./d01.css";

const FileInput = ({
  acceptedFileTypes,
  fileHelp,
  onFilesSelected,
  disabled,
}: Pick<
  D01WorkspaceProps,
  "acceptedFileTypes" | "fileHelp" | "onFilesSelected"
> & {
  readonly disabled: boolean;
}) => {
  const id = useId();
  return (
    <div className="d01-file-input">
      <label htmlFor={id}>Adicionar arquivos</label>
      <p id={`${id}-help`} className="d01-muted">
        {fileHelp}
      </p>
      <input
        accept={acceptedFileTypes}
        aria-describedby={`${id}-help`}
        disabled={disabled}
        id={id}
        multiple
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          if (files.length > 0) {
            onFilesSelected(files);
          }
          event.currentTarget.value = "";
        }}
        type="file"
      />
    </div>
  );
};

const CorrectionForm = ({
  inspection,
  onCorrection,
  onUnknown,
  onUndo,
  actionPending = false,
}: Pick<
  D01WorkspaceProps,
  "onCorrection" | "onUnknown" | "onUndo" | "actionPending"
> & {
  readonly inspection: InspectionView;
}) => {
  const id = useId();
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  if (!onCorrection && !onUnknown && !onUndo) {
    return null;
  }
  return (
    <section aria-labelledby={`${id}-title`} className="d01-correction">
      <div>
        <p className="d01-eyebrow">Sua participação</p>
        <h2 id={`${id}-title`}>Esclareça este compromisso</h2>
        <p>
          Escopo desta resposta: <strong>{inspection.scope}</strong>.
        </p>
        <p className="d01-muted">
          Sua resposta será enviada para análise. Nenhuma alteração é confirmada
          nesta tela antes do resultado.
        </p>
      </div>
      {onCorrection ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!actionPending && answer.trim()) {
              onCorrection({ answer, explanation });
            }
          }}
        >
          <fieldset disabled={actionPending}>
            <legend className="d01-visually-hidden">
              Esclarecimento com escopo
            </legend>
            <label htmlFor={`${id}-answer`}>O que precisa ser corrigido?</label>
            <textarea
              id={`${id}-answer`}
              onChange={(event) => {
                setAnswer(event.currentTarget.value);
              }}
              required
              rows={3}
              value={answer}
            />
            <label htmlFor={`${id}-explanation`}>
              Como você sabe? <span className="d01-muted">(opcional)</span>
            </label>
            <input
              id={`${id}-explanation`}
              onChange={(event) => {
                setExplanation(event.currentTarget.value);
              }}
              type="text"
              value={explanation}
            />
            <button
              className="d01-button d01-button-primary"
              disabled={!answer.trim()}
              type="submit"
            >
              Enviar esclarecimento
            </button>
          </fieldset>
        </form>
      ) : null}
      <div className="d01-action-row">
        {onUnknown ? (
          <button
            className="d01-button"
            disabled={actionPending}
            onClick={onUnknown}
            type="button"
          >
            Não sei responder
          </button>
        ) : null}
        {onUndo ? (
          <button
            className="d01-button d01-button-quiet"
            disabled={actionPending}
            onClick={onUndo}
            type="button"
          >
            Revisar para desfazer
          </button>
        ) : null}
      </div>
    </section>
  );
};

const Inspection = ({
  inspection,
  ...actions
}: Pick<
  D01WorkspaceProps,
  | "onInspectEvidence"
  | "onCorrection"
  | "onUnknown"
  | "onUndo"
  | "actionPending"
> & { readonly inspection: InspectionView }) => {
  const id = useId();
  return (
    <>
      <section aria-labelledby={`${id}-title`} className="d01-overview">
        <p className="d01-eyebrow">Compromisso em análise</p>
        <h1 id={`${id}-title`}>{inspection.title}</h1>
        <div className="d01-status-row">
          <span className="d01-badge">{inspection.statusLabel}</span>
          <span className="d01-muted">{inspection.verificationLabel}</span>
        </div>
        <p className="d01-lead">{inspection.explanation}</p>
        <dl className="d01-basis">
          <div>
            <dt>Referência da leitura</dt>
            <dd>{inspection.basisLabel}</dd>
          </div>
          <div>
            <dt>Cobertura</dt>
            <dd>{inspection.coverageLabel}</dd>
          </div>
        </dl>
      </section>
      <div className="d01-inspection-grid">
        <section aria-labelledby={`${id}-sources`}>
          <div className="d01-section-heading">
            <h2 id={`${id}-sources`}>O que dizem as fontes</h2>
            <span className="d01-muted">Registros disponíveis</span>
          </div>
          <div className="d01-source-list">
            {inspection.sources.map((source) => (
              <article className="d01-source-card" key={source.id}>
                <p className="d01-source-name">{source.name}</p>
                <p className="d01-value">{source.value}</p>
                <p>{source.description}</p>
                <p className="d01-muted">{source.location}</p>
                <button
                  className="d01-button"
                  disabled={actions.actionPending}
                  onClick={() => {
                    actions.onInspectEvidence(source.id);
                  }}
                  type="button"
                >
                  Inspecionar evidência
                  <span className="d01-visually-hidden"> de {source.name}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
        <aside
          aria-live="polite"
          aria-labelledby={`${id}-evidence`}
          className="d01-evidence"
        >
          <p className="d01-eyebrow">Por trás da resposta</p>
          <h2 id={`${id}-evidence`}>Evidência</h2>
          {inspection.evidence ? (
            <>
              <h3>{inspection.evidence.sourceName}</h3>
              <p className="d01-muted">{inspection.evidence.location}</p>
              <blockquote>{inspection.evidence.excerpt}</blockquote>
              <p className="d01-muted">
                Retida em {inspection.evidence.retainedAt}
              </p>
              <p>
                Este trecho registra o conteúdo da fonte. Sua existência não
                comprova que o pagamento aconteceu.
              </p>
            </>
          ) : (
            <p>
              Escolha uma fonte para abrir o trecho disponível e conferir de
              onde veio a informação.
            </p>
          )}
        </aside>
      </div>
      <CorrectionForm
        key={inspection.interactionKey}
        inspection={inspection}
        {...actions}
      />
    </>
  );
};

export const D01Workspace = (props: D01WorkspaceProps) => {
  const id = useId();
  const blocked =
    props.view.kind === "denied" || props.view.kind === "unavailable";
  return (
    <div className="d01-workspace">
      <a className="d01-skip-link" href={`#${id}-main`}>
        Ir para o conteúdo
      </a>
      <header className="d01-header">
        <span aria-label="Zoen" className="d01-wordmark">
          zoen<span aria-hidden="true">.</span>
        </span>
        <span className="d01-header-note">Informação com origem</span>
        <button
          className="d01-button d01-button-quiet"
          onClick={props.onLogout}
          type="button"
        >
          Sair
        </button>
      </header>
      <main id={`${id}-main`} tabIndex={-1}>
        {props.view.kind === "empty" ? (
          <section className="d01-empty">
            <p className="d01-eyebrow">Um começo simples</p>
            <h1>
              Entenda seus compromissos.
              <br />
              <span>Comece pelas fontes.</span>
            </h1>
            <p className="d01-lead">
              Adicione seus arquivos para reunir informações, conferir a origem
              de cada registro e esclarecer o que ainda falta saber.
            </p>
            <ol className="d01-steps">
              <li>
                <span aria-hidden="true">01</span>
                <strong>Adicione uma fonte</strong>
                <p>Um arquivo de cada vez já é um começo.</p>
              </li>
              <li>
                <span aria-hidden="true">02</span>
                <strong>Confira a informação</strong>
                <p>Veja evidências, diferenças e lacunas.</p>
              </li>
              <li>
                <span aria-hidden="true">03</span>
                <strong>Esclareça com cuidado</strong>
                <p>Uma resposta tem escopo e fica no histórico.</p>
              </li>
            </ol>
          </section>
        ) : null}
        {props.view.kind === "uploading" ? (
          <section aria-busy="true" className="d01-empty">
            <p className="d01-eyebrow">Seus arquivos</p>
            <h1>Recebendo a fonte</h1>
            <output className="d01-lead">{props.view.message}</output>
            <p className="d01-muted">
              A informação estará disponível quando a admissão for confirmada.
            </p>
          </section>
        ) : null}
        {props.view.kind === "inspection" ? (
          <Inspection {...props} inspection={props.view.inspection} />
        ) : null}
        {blocked ? (
          <section className="d01-empty">
            <p className="d01-eyebrow">Acesso à informação</p>
            <h1>
              {props.view.kind === "denied"
                ? "Não foi possível abrir este conteúdo"
                : "Conteúdo indisponível"}
            </h1>
            <p className="d01-lead">
              {props.view.kind === "denied"
                ? "Seu acesso atual não permite exibir esta informação."
                : "Não é possível exibir esta informação agora. Isso não significa que seu valor seja zero."}
            </p>
            {props.onRetry ? (
              <button
                className="d01-button"
                disabled={props.actionPending}
                onClick={props.onRetry}
                type="button"
              >
                Tentar novamente
              </button>
            ) : null}
          </section>
        ) : (
          <section aria-label="Importação de arquivos" className="d01-upload">
            <FileInput
              {...props}
              disabled={
                props.view.kind === "uploading" || Boolean(props.actionPending)
              }
            />
          </section>
        )}
        {props.feedback !== undefined &&
        props.feedback.length > 0 &&
        !blocked ? (
          <output className="d01-feedback">{props.feedback}</output>
        ) : null}
      </main>
      <footer className="d01-footer">
        <span>Fontes, interpretações e decisões têm papéis distintos.</span>
        <span>Zoen</span>
      </footer>
    </div>
  );
};
