import { useId, useState } from "react";

import type { WorldsWorkspaceProps, InspectionView } from "./presentation.ts";

import "./worlds.css";

const FileInput = ({
  acceptedFileTypes,
  fileHelp,
  onFilesSelected,
  disabled,
}: Pick<
  WorldsWorkspaceProps,
  "acceptedFileTypes" | "fileHelp" | "onFilesSelected"
> & {
  readonly disabled: boolean;
}) => {
  const id = useId();
  return (
    <div className="worlds-file-input">
      <label htmlFor={id}>Adicionar arquivos</label>
      <p id={`${id}-help`} className="worlds-muted">
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
  WorldsWorkspaceProps,
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
    <section aria-labelledby={`${id}-title`} className="worlds-correction">
      <div>
        <p className="worlds-eyebrow">Sua participação</p>
        <h2 id={`${id}-title`}>Esclareça este compromisso</h2>
        <p>
          Escopo desta resposta: <strong>{inspection.scope}</strong>.
        </p>
        <p className="worlds-muted">
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
            <legend className="worlds-visually-hidden">
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
              Como você sabe? <span className="worlds-muted">(opcional)</span>
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
              className="worlds-button worlds-button-primary"
              disabled={!answer.trim()}
              type="submit"
            >
              Enviar esclarecimento
            </button>
          </fieldset>
        </form>
      ) : null}
      <div className="worlds-action-row">
        {onUnknown ? (
          <button
            className="worlds-button"
            disabled={actionPending}
            onClick={onUnknown}
            type="button"
          >
            Não sei responder
          </button>
        ) : null}
        {onUndo ? (
          <button
            className="worlds-button worlds-button-quiet"
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
  WorldsWorkspaceProps,
  | "onInspectEvidence"
  | "onCorrection"
  | "onUnknown"
  | "onUndo"
  | "actionPending"
> & { readonly inspection: InspectionView }) => {
  const id = useId();
  return (
    <>
      <section aria-labelledby={`${id}-title`} className="worlds-overview">
        <p className="worlds-eyebrow">Compromisso em análise</p>
        <h1 id={`${id}-title`}>{inspection.title}</h1>
        <div className="worlds-status-row">
          <span className="worlds-badge">{inspection.statusLabel}</span>
          <span className="worlds-muted">{inspection.verificationLabel}</span>
        </div>
        <p className="worlds-lead">{inspection.explanation}</p>
        <dl className="worlds-basis">
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
      <div className="worlds-inspection-grid">
        <section aria-labelledby={`${id}-sources`}>
          <div className="worlds-section-heading">
            <h2 id={`${id}-sources`}>O que dizem as fontes</h2>
            <span className="worlds-muted">Registros disponíveis</span>
          </div>
          <div className="worlds-source-list">
            {inspection.sources.map((source) => (
              <article className="worlds-source-card" key={source.id}>
                <p className="worlds-source-name">{source.name}</p>
                <p className="worlds-value">{source.value}</p>
                <p>{source.description}</p>
                <p className="worlds-muted">{source.location}</p>
                <button
                  className="worlds-button"
                  disabled={actions.actionPending}
                  onClick={() => {
                    actions.onInspectEvidence(source.id);
                  }}
                  type="button"
                >
                  Inspecionar evidência
                  <span className="worlds-visually-hidden">
                    {" "}
                    de {source.name}
                  </span>
                </button>
              </article>
            ))}
          </div>
        </section>
        <aside
          aria-live="polite"
          aria-labelledby={`${id}-evidence`}
          className="worlds-evidence"
        >
          <p className="worlds-eyebrow">Por trás da resposta</p>
          <h2 id={`${id}-evidence`}>Evidência</h2>
          {inspection.evidence ? (
            <>
              <h3>{inspection.evidence.sourceName}</h3>
              <p className="worlds-muted">{inspection.evidence.location}</p>
              <blockquote>{inspection.evidence.excerpt}</blockquote>
              <p className="worlds-muted">
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

export const WorldsWorkspace = (props: WorldsWorkspaceProps) => {
  const id = useId();
  const blocked =
    props.view.kind === "denied" || props.view.kind === "unavailable";
  return (
    <div className="worlds-workspace">
      <a className="worlds-skip-link" href={`#${id}-main`}>
        Ir para o conteúdo
      </a>
      <header className="worlds-header">
        <span aria-label="Zoen" className="worlds-wordmark">
          zoen<span aria-hidden="true">.</span>
        </span>
        <span className="worlds-header-note">Informação com origem</span>
        <button
          className="worlds-button worlds-button-quiet"
          onClick={props.onLogout}
          type="button"
        >
          Sair
        </button>
      </header>
      <main id={`${id}-main`} tabIndex={-1}>
        {props.view.kind === "empty" && props.readOnly === true ? (
          <section className="worlds-empty">
            <h1>Consultar espaço compartilhado</h1>
            <p>
              Informe a obrigação para ler as fontes disponíveis ou abra uma
              referência de leitura anterior sua.
            </p>
          </section>
        ) : null}
        {props.view.kind === "empty" && props.readOnly !== true ? (
          <section className="worlds-empty">
            <p className="worlds-eyebrow">Um começo simples</p>
            <h1>
              Entenda seus compromissos.
              <br />
              <span>Comece pelas fontes.</span>
            </h1>
            <p className="worlds-lead">
              Adicione seus arquivos para reunir informações, conferir a origem
              de cada registro e esclarecer o que ainda falta saber.
            </p>
            <ol className="worlds-steps">
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
          <section aria-busy="true" className="worlds-empty">
            <p className="worlds-eyebrow">Seus arquivos</p>
            <h1>Recebendo a fonte</h1>
            <output className="worlds-lead">{props.view.message}</output>
            <p className="worlds-muted">
              A informação estará disponível quando a admissão for confirmada.
            </p>
          </section>
        ) : null}
        {props.view.kind === "inspection" ? (
          <Inspection {...props} inspection={props.view.inspection} />
        ) : null}
        {blocked ? (
          <section className="worlds-empty">
            <p className="worlds-eyebrow">Acesso à informação</p>
            <h1>
              {props.view.kind === "denied"
                ? "Não foi possível abrir este conteúdo"
                : "Conteúdo indisponível"}
            </h1>
            <p className="worlds-lead">
              {props.view.kind === "denied"
                ? "Seu acesso atual não permite exibir esta informação."
                : "Não é possível exibir esta informação agora. Isso não significa que seu valor seja zero."}
            </p>
            {props.onRetry ? (
              <button
                className="worlds-button"
                disabled={props.actionPending}
                onClick={props.onRetry}
                type="button"
              >
                Tentar novamente
              </button>
            ) : null}
          </section>
        ) : null}
        {!blocked && props.readOnly !== true ? (
          <section
            aria-label="Importação de arquivos"
            className="worlds-upload"
          >
            <FileInput
              {...props}
              disabled={
                props.view.kind === "uploading" || Boolean(props.actionPending)
              }
            />
          </section>
        ) : null}
        {props.feedback !== undefined &&
        props.feedback.length > 0 &&
        !blocked ? (
          <output className="worlds-feedback">{props.feedback}</output>
        ) : null}
      </main>
      <footer className="worlds-footer">
        <span>Fontes, interpretações e decisões têm papéis distintos.</span>
        <span>Zoen</span>
      </footer>
    </div>
  );
};
