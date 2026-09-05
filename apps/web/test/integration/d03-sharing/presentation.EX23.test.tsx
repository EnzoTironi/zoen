import { randomUUID } from "node:crypto";

import { describe, expect, it } from "@effect/vitest";
import {
  Membership,
  WorldReadAccessGranted,
} from "@zoen/contracts/sharing/operations";
import { Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";

import { D01Workspace } from "../../../src/components/d01/d01-workspace.tsx";
import { initialState } from "../../../src/features/d01/model.ts";
import { createWorkspaceController } from "../../../src/features/d01/state.ts";
import { audience } from "../../../src/features/sharing/model.ts";
import { SharingPanel } from "../../../src/features/sharing/panel.tsx";

// Synthetic presentation inputs exercise actual components; no service is replaced.
const controller = createWorkspaceController("http://127.0.0.1");
const principal = randomUUID();
const owner = Schema.decodeSync(Membership)({
  principalRef: randomUUID(),
  revision: "0",
  role: "owner",
  state: "active",
});
const viewer = Schema.decodeSync(Membership)({
  principalRef: principal,
  revision: "4",
  role: "viewer",
  state: "active",
});
const workspace = (readOnly: boolean) =>
  renderToStaticMarkup(
    <D01Workspace
      acceptedFileTypes="application/json,.json"
      fileHelp="JSON"
      onFilesSelected={(files) => {
        controller.importFiles(files);
      }}
      onInspectEvidence={(claim) => {
        controller.openEvidence(claim);
      }}
      onLogout={() => {
        controller.logout();
      }}
      readOnly={readOnly}
      view={{ kind: "empty" }}
    />
  );

describe("EX23 sharing presentation", () => {
  it("EX23 viewer empty view has no upload or correction invitation; owner retains upload", () => {
    const readonly = workspace(true);
    expect(readonly).not.toContain('type="file"');
    expect(readonly).not.toMatch(
      /Adicione seus arquivos|Esclareça com cuidado/u
    );
    expect(readonly).toContain("Consultar espaço compartilhado");
    expect(readonly).toContain("leitura anterior sua");
    expect(workspace(false)).toContain('type="file"');
  });

  it("EX23 viewer cannot render the owner's sharing target or historical receipt", () => {
    const state = {
      ...initialState,
      membership: viewer,
      sharing: {
        ...initialState.sharing,
        target: { membership: owner, principalRef: owner.principalRef },
      },
    };
    expect(
      renderToStaticMarkup(
        <SharingPanel controller={controller} state={state} />
      )
    ).toBe("");
  });

  it("EX23 full audience and exact revision are visible before owner confirms", () => {
    const state = {
      ...initialState,
      membership: owner,
      sharing: {
        ...initialState.sharing,
        confirmation: "grant" as const,
        target: { membership: viewer, principalRef: viewer.principalRef },
      },
    };
    const rendered = renderToStaticMarkup(
      <SharingPanel controller={controller} state={state} />
    );
    expect(rendered).toContain(audience);
    expect(rendered).toContain(viewer.principalRef);
    expect(rendered).toContain("Revisão confirmada: 4");
    expect(rendered).toContain("Conceder leitura de todo o espaço");
    expect(rendered).toContain("cópias já recebidas");
  });

  it("EX23 an historical grant receipt renders no current grant without a fresh inspection", () => {
    const receipt = Schema.decodeSync(WorldReadAccessGranted)({
      _tag: "WorldReadAccessGranted",
      membershipAtCommit: { ...viewer, role: "viewer", state: "active" },
      receiptRef: randomUUID(),
      worldRef: { realm: "live", worldId: randomUUID() },
    });
    const state = {
      ...initialState,
      membership: owner,
      sharing: { ...initialState.sharing, receipt },
    };
    const rendered = renderToStaticMarkup(
      <SharingPanel controller={controller} state={state} />
    );
    expect(rendered).toContain("Recibo histórico");
    expect(rendered).toContain("não comprova acesso atual");
    expect(rendered).toContain("O estado atual ainda não foi confirmado");
    expect(rendered).not.toContain("Estado na consulta atual");
    expect(rendered).not.toContain("Conceder leitura de todo o espaço");
  });
});
