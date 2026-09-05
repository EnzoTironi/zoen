import { useId, useState } from "react";

import { D01Workspace } from "../../components/d01/d01-workspace.tsx";
import type { WorkspaceState } from "./model.ts";
import type { ImportFileFormat } from "./requests.ts";
import type { WorkspaceController } from "./state.ts";

/** Format is an explicit choice for the next batch; retries retain their request. */
export const ImportWorkspace = ({
  controller,
  state,
}: {
  readonly controller: WorkspaceController;
  readonly state: WorkspaceState;
}) => {
  const [format, setFormat] = useState<ImportFileFormat>("json");
  const id = useId();
  const csv = format === "csv";
  return (
    <>
      <section
        aria-label="Formato da importação"
        className="d01-workspace d01-context"
      >
        <div className="d01-context-inner">
          <label htmlFor={`${id}-format`}>Formato dos arquivos</label>
          <select
            disabled={state.busy}
            id={`${id}-format`}
            onChange={(event) => {
              const chosen = event.currentTarget.value;
              if (chosen === "json" || chosen === "csv") {
                setFormat(chosen);
              }
            }}
            value={format}
          >
            <option value="json">JSON — Zoen d01.v1</option>
            <option value="csv">CSV — Zoen d01.csv.v1</option>
          </select>
          <p>
            O formato escolhido vale para todos os arquivos da próxima seleção.
          </p>
        </div>
      </section>
      <D01Workspace
        {...(state.canRetry ? { onRetry: controller.retry } : {})}
        acceptedFileTypes={csv ? "text/csv,.csv" : "application/json,.json"}
        actionPending={state.busy}
        feedback={state.feedback}
        fileHelp={`${csv ? "CSV no formato Zoen d01.csv.v1, com cabeçalho e colunas fixas" : "JSON no formato Zoen d01.v1"}, até 256 KiB por arquivo. Use apenas dados autorizados e não sensíveis neste perfil.`}
        onFilesSelected={(files) => {
          controller.importFiles(files, format);
        }}
        onInspectEvidence={(claim) => {
          controller.openEvidence(claim);
        }}
        onLogout={() => {
          controller.logout();
        }}
        view={state.view}
      />
    </>
  );
};
