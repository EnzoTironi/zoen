import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { D01Workspace } from "../../../src/components/d01/d01-workspace.tsx";
import type { D01WorkspaceProps } from "../../../src/components/d01/presentation.ts";
import { inspection, views } from "./fixtures.ts";

const render = (
  view: D01WorkspaceProps["view"],
  additions: Partial<D01WorkspaceProps> = {}
) => {
  const events: string[] = [];
  return renderToStaticMarkup(
    <D01Workspace
      acceptedFileTypes=".json,application/json"
      fileHelp="Arquivos JSON, conforme os limites do seu espaço."
      onFilesSelected={(files) => {
        events.push(`files:${files.length}`);
      }}
      onInspectEvidence={(id) => {
        events.push(`inspect:${id}`);
      }}
      onLogout={() => {
        events.push("logout");
      }}
      view={view}
      {...additions}
    />
  );
};

describe("EX03 — apresentação pura da primeira jornada", () => {
  it("expõe vazio e controle de arquivo rotulado sem inventar registros", () => {
    const html = render(views.empty);
    expect(html).toContain("Comece pelas fontes.");
    expect(html).toMatch(/<label for="[^"]+">Adicionar arquivos<\/label>/u);
    expect(html).toContain('type="file"');
    expect(html).toContain('accept=".json,application/json"');
    expect(html).not.toContain("R$ 480,00");
  });

  it("mantém admissão pendente distinta de fonte disponível", () => {
    const html = render(views.uploading);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(
      "A informação estará disponível quando a admissão for confirmada."
    );
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*type="file"/u);
    expect(html).not.toContain("O que dizem as fontes");
  });

  it("apresenta divergência, verificação e evidência sem escolher valor nem declarar pagamento", () => {
    const html = render(views.inspection);
    expect(html).toContain("R$ 480,00");
    expect(html).toContain("R$ 520,00");
    expect(html).toContain("Informações divergentes");
    expect(html).toContain("Não verificado");
    expect(html).toContain("Parcial · outras fontes podem estar ausentes");
  });

  it("não converte o registro em comprovação de pagamento", () => {
    const html = render(views.inspection);
    expect(html).toContain(
      "Sua existência não comprova que o pagamento aconteceu."
    );
    expect(html).not.toContain("Pagamento concluído");
  });

  it("não transforma unknown em zero ou escolhe uma fonte no componente", () => {
    const html = render(views.unknown);
    expect(html).toContain("Ainda não sabemos");
    expect(html).not.toContain("R$ 0,00");
    expect(html).not.toContain("R$ 520,00");
  });

  it.each([views.denied, views.unavailable])(
    "não mantém conteúdo anterior nem feedback em $kind",
    (view) => {
      const html = render(view, {
        feedback: "SEGREDO: valor anterior R$ 480,00",
      });
      expect(html).not.toContain("SEGREDO");
      expect(html).not.toContain("Compromissos.json");
      expect(html).not.toContain('type="file"');
      expect(html).not.toContain("Esclareça este compromisso");
      expect(html).toContain(">Sair</button>");
    }
  );

  it("trata trechos e nomes de fonte como texto, inclusive HTML hostil", () => {
    const html = render({
      inspection: {
        ...inspection,
        evidence: {
          excerpt: '<img src=x onerror="alert(1)">',
          location: "Linha 1",
          retainedAt: "5 de setembro",
          sourceName: "<script>alert(1)</script>",
        },
      },
      kind: "inspection",
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("não apresenta ações de correção que o consumidor não forneceu", () => {
    const html = render(views.inspection);
    expect(html).not.toContain("Enviar esclarecimento");
    expect(html).not.toContain("Não sei responder");
    expect(html).not.toContain("Revisar para desfazer");
  });
});
