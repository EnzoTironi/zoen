import { expect, test } from "@playwright/test";

test.describe("EX03 — componente React real, sem backend", () => {
  test("teclado percorre conteúdo, saída e fontes; inspeção só emite callback", async ({
    page,
  }) => {
    await page.goto("/ex03?state=inspection");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Ir para o conteúdo" })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { exact: true, name: "Sair" })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", {
        name: "Inspecionar evidência de Compromissos.json",
      })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Eventos do teste de componente")).toHaveText(
      "inspect:source-a"
    );
    await expect(
      page.getByText("Informações divergentes", { exact: true })
    ).toBeVisible();
  });

  test("upload entrega arquivos reais do input e não declara admissão", async ({
    page,
  }) => {
    await page.goto("/ex03?state=empty");
    await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles({
      buffer: Buffer.from('{"valor":"480.00"}'),
      mimeType: "application/json",
      name: "entrada.json",
    });
    await expect(page.getByLabel("Eventos do teste de componente")).toHaveText(
      "files:entrada.json"
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Comece pelas fontes"
    );
    await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles({
      buffer: Buffer.from('{"valor":"480.00"}'),
      mimeType: "application/json",
      name: "entrada.json",
    });
    await expect(page.getByLabel("Eventos do teste de componente")).toHaveText(
      "files:entrada.json\nfiles:entrada.json"
    );
  });

  test("esclarecimento, unknown e undo não alteram a interpretação local", async ({
    page,
  }) => {
    await page.goto("/ex03?state=inspection");
    const submit = page.getByRole("button", { name: "Enviar esclarecimento" });
    await expect(submit).toBeDisabled();
    await page.getByLabel("O que precisa ser corrigido?").fill("   ");
    await expect(submit).toBeDisabled();
    await page
      .getByLabel("O que precisa ser corrigido?")
      .fill("O valor informado deve ser revisto.");
    await page
      .getByLabel("Como você sabe?", { exact: false })
      .fill("Conferi meu arquivo.");
    await submit.click();
    await expect(
      page.getByLabel("Eventos do teste de componente")
    ).toContainText(
      "correction:O valor informado deve ser revisto.|Conferi meu arquivo."
    );
    await page.getByRole("button", { name: "Não sei responder" }).click();
    await page.getByRole("button", { name: "Revisar para desfazer" }).click();
    await expect(
      page.getByLabel("Eventos do teste de componente")
    ).toContainText("unknown\nundo");
    await expect(
      page.getByText("Informações divergentes", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Não verificado", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Sair" }).click();
    await expect(
      page.getByLabel("Eventos do teste de componente")
    ).toContainText("logout");
  });

  test("novo contexto descarta rascunho mesmo quando os rótulos coincidem", async ({
    page,
  }) => {
    await page.goto("/ex03?state=context-change");
    await page
      .getByLabel("O que precisa ser corrigido?")
      .fill("Rascunho do contexto anterior");
    await page
      .getByLabel("Como você sabe?", { exact: false })
      .fill("Nota anterior");
    await page
      .getByRole("button", { name: "Trocar props do componente" })
      .click();
    await expect(page.getByLabel("O que precisa ser corrigido?")).toHaveValue(
      ""
    );
    await expect(
      page.getByLabel("Como você sabe?", { exact: false })
    ).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Enviar esclarecimento" })
    ).toBeDisabled();
  });

  for (const state of ["denied", "unavailable"]) {
    test(`${state} não mostra fontes ou formulário`, async ({ page }) => {
      await page.goto(`/ex03?state=${state}`);
      await expect(
        page.getByText("Compromissos.json", { exact: true })
      ).toHaveCount(0);
      await expect(page.getByLabel("O que precisa ser corrigido?")).toHaveCount(
        0
      );
      await expect(
        page.getByRole("button", { exact: true, name: "Sair" })
      ).toBeVisible();
    });
  }

  test("layout estreito e ampliação CSS de 200% preservam informação e controles", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/ex03?state=inspection");
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("inspection-desktop.png"),
    });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await expect(
      page.getByRole("heading", {
        exact: true,
        name: "Mensalidade de setembro",
      })
    ).toBeVisible();
    await expect(page.getByLabel("O que precisa ser corrigido?")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Não sei responder" })
    ).toBeVisible();
    const firstCard = await page
      .locator(".d01-source-card")
      .first()
      .boundingBox();
    expect(firstCard?.width).toBeGreaterThan(350);
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("inspection-css-zoom-200.png"),
    });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "1";
    });
    await page.setViewportSize({ height: 850, width: 320 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await expect(page.getByText("R$ 480,00", { exact: true })).toBeVisible();
    await expect(page.getByText("R$ 520,00", { exact: true })).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath("inspection-mobile.png"),
    });
  });
});
