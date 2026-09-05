import { randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Config, Effect } from "effect";

const baseURL = Effect.runSync(Config.string("ZOEN_TEST_WEB_URL"));
test.use({ baseURL });

const signUp = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quero criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("EX12 browser account");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${randomUUID()}@example.test`);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(randomBytes(24).toString("base64url"));
  await page.getByRole("button", { exact: true, name: "Criar conta" }).click();
  await expect(
    page.getByRole("button", { name: "Criar espaço privado" })
  ).toBeVisible();
};

const inspect = async (page: Page, subject: string) => {
  await page.getByLabel("Identificador da obrigação").fill(subject);
  await page.getByLabel("Identificador da obrigação").press("Enter");
  await expect(
    page.getByRole("heading", { exact: true, name: subject })
  ).toBeVisible();
};

const sourceFile = (subject: string, label: string, amount: string) => ({
  buffer: Buffer.from(
    JSON.stringify({
      records: [
        {
          externalId: "record-1",
          predicate: "obligation.amount",
          subjectKey: subject,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount, currency: "BRL" },
        },
      ],
      schemaVersion: "d01.v1",
      source: {
        externalId: randomUUID(),
        label,
        namespace: "ex12-browser",
        revision: "1",
      },
    })
  ),
  mimeType: "application/json",
  name: `${label}.json`,
});

test("independent EX14 recovered proposal remains reviewable after a real network failure", async ({
  page,
  context,
}, info) => {
  const subject = `retry-${randomUUID()}`;
  await signUp(page);
  await page.getByRole("button", { name: "Criar espaço privado" }).click();
  await expect(page.locator(".d01-world-id span")).toBeVisible();
  await page
    .getByLabel("Adicionar arquivos", { exact: true })
    .setInputFiles(sourceFile(subject, "Retry source", "100.00"));
  await expect(
    page.getByText(
      "Fontes admitidas. Informe a obrigação para consultar os registros.",
      { exact: true }
    )
  ).toBeVisible();
  await inspect(page, subject);
  await page.getByLabel("Início do período").fill("2026-09-01");
  await page.getByLabel("Fim do período (exclusivo)").fill("2026-10-01");
  await page.getByLabel("Referência para sua decisão").selectOption("unknown");
  try {
    await context.setOffline(true);
    await page.getByRole("button", { name: "Revisar proposta" }).click();
    await expect(
      page.getByRole("button", { name: "Tentar novamente" })
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/d01/corrections") && r.status() === 200
  );
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await response;
  await page.screenshot({
    fullPage: true,
    path: info.outputPath("proposal-after-network-retry.png"),
  });
  await expect(
    page.getByRole("button", { name: "Confirmar decisão" })
  ).toBeVisible();
});
