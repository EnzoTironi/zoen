import { useState } from "react";

import { D01Workspace } from "../../../src/components/d01/d01-workspace.tsx";
import type { WorkspaceView } from "../../../src/components/d01/presentation.ts";
import { views } from "./fixtures.ts";

/** Browser component harness only. Records callbacks; it never invents operation results. */
export const EX03Fixture = ({
  view = views.inspection,
  nextView,
}: {
  readonly view?: WorkspaceView;
  readonly nextView?: WorkspaceView;
}) => {
  const [replacement, setReplacement] = useState<WorkspaceView>();
  const [events, setEvents] = useState<readonly string[]>([]);
  const record = (event: string) => {
    setEvents((current) => [...current, event]);
  };
  return (
    <>
      <D01Workspace
        acceptedFileTypes=".json,application/json"
        fileHelp="Arquivos JSON. A admissão e os limites são verificados ao enviar."
        onCorrection={(draft) => {
          record(`correction:${draft.answer}|${draft.explanation}`);
        }}
        onFilesSelected={(files) => {
          record(`files:${files.map((file) => file.name).join(",")}`);
        }}
        onInspectEvidence={(id) => {
          record(`inspect:${id}`);
        }}
        onLogout={() => {
          record("logout");
        }}
        onRetry={() => {
          record("retry");
        }}
        onUndo={() => {
          record("undo");
        }}
        onUnknown={() => {
          record("unknown");
        }}
        view={replacement ?? view}
      />
      {nextView ? (
        <button
          type="button"
          onClick={() => {
            setReplacement(nextView);
          }}
        >
          Trocar props do componente
        </button>
      ) : null}
      <output aria-label="Eventos do teste de componente">
        {events.join("\n")}
      </output>
    </>
  );
};
