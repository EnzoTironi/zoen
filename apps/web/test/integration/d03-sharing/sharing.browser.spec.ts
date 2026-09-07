import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  FrameInspected,
  SemanticRequest,
} from "@zoen/contracts/worlds/operations";
import { Config, Effect, Option, Schema } from "effect";

const baseURL = Effect.runSync(Config.string("ZOEN_TEST_SHARING_WEB_URL"));
const waitForOperation = (
  page: Page,
  operation: SemanticRequest["operation"]
) =>
  page.waitForResponse((response) => {
    if (
      !response.url().includes("/api/worlds/") &&
      !response.url().endsWith("/api/d03/sharing")
    ) {
      return false;
    }
    const request = Schema.decodeUnknownOption(SemanticRequest)(
      response.request().postDataJSON()
    );
    return Option.isSome(request) && request.value.operation === operation;
  });
const signUp = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quero criar uma conta" }).click();
  await page
    .getByLabel("Nome", { exact: true })
    .fill("Sharing browser account");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${randomUUID()}@example.test`);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(randomBytes(24).toString("base64url"));
  await page.getByRole("button", { exact: true, name: "Criar conta" }).click();
  await expect(
    page.getByLabel("Seu identificador de conta", { exact: true })
  ).toBeVisible();
  return await page
    .getByLabel("Seu identificador de conta", { exact: true })
    .inputValue();
};
const inspect = async (page: Page, subject: string, atFrame = "") => {
  await page
    .getByLabel("Identificador da obrigação", { exact: true })
    .fill(subject);
  await page
    .getByLabel("Referência de leitura anterior (opcional)", { exact: true })
    .fill(atFrame);
  const response = waitForOperation(page, "Inspect");
  await page
    .getByRole("button", { exact: true, name: "Consultar fontes" })
    .click();
  const actual = await response;
  expect(actual.status()).toBe(200);
  return Schema.decodeUnknownSync(FrameInspected)(await actual.json()).frame;
};
const inspectRecipient = async (page: Page, principal: string) => {
  await page
    .getByLabel("Identificador exato do destinatário", { exact: true })
    .fill(principal);
  await page
    .getByRole("button", { name: "Consultar acesso do destinatário" })
    .click();
  await expect(
    page.getByRole("region", { exact: true, name: "Acesso consultado" })
  ).toContainText(principal);
};

test.use({ baseURL });
test.setTimeout(60_000);
test.beforeEach(async () => {
  await setTimeout(10_100);
});

test("EX23 owner confirms the whole World; viewer reads own history and clears private content after revoke", async ({
  page,
  browser,
}) => {
  const viewerContext = await browser.newContext({ baseURL });
  try {
    const reader = await viewerContext.newPage();
    const principal = await signUp(reader);
    await signUp(page);
    await page.getByRole("button", { name: "Criar espaço privado" }).click();
    await expect(
      page.getByText("Seu papel: proprietário", { exact: true })
    ).toBeVisible();
    const world = await page.locator(".d01-world-id span").textContent();
    if (world === null) {
      throw new Error("Created World identifier is missing");
    }
    const subject = `sharing-${randomUUID()}`;
    const sourceLabel = `Private source ${randomUUID()}`;
    const document = JSON.stringify({
      records: [
        {
          externalId: "r1",
          predicate: "obligation.amount",
          subjectKey: subject,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount: "100.00", currency: "BRL" },
        },
      ],
      schemaVersion: "worlds.v1",
      source: {
        externalId: randomUUID(),
        label: sourceLabel,
        namespace: "sharing-browser",
        revision: "1",
      },
    });
    const imported = waitForOperation(page, "ImportEvidence");
    await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles({
      buffer: Buffer.from(document),
      mimeType: "application/json",
      name: "source.json",
    });
    const importedResponse = await imported;
    expect(importedResponse.status()).toBe(200);
    await inspectRecipient(page, principal);
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("sem membership");
    await page
      .getByRole("button", { name: "Revisar concessão de leitura" })
      .click();
    await expect(
      page.getByRole("region", { name: "Confirmar alteração de acesso" })
    ).toContainText("atuais e futuras");
    // Abort one outgoing transport attempt; no service response is supplied or fabricated.
    await page.route("**/api/d03/sharing", async (route) => {
      const request = Schema.decodeUnknownOption(SemanticRequest)(
        route.request().postDataJSON()
      );
      await (Option.isSome(request) &&
      request.value.operation === "GrantWorldReadAccess"
        ? route.abort("connectionfailed")
        : route.continue());
    });
    const failedGrant = page.waitForRequest((request) => {
      if (!request.url().endsWith("/api/d03/sharing")) {
        return false;
      }
      const parsed = Schema.decodeUnknownOption(SemanticRequest)(
        request.postDataJSON()
      );
      return (
        Option.isSome(parsed) &&
        parsed.value.operation === "GrantWorldReadAccess"
      );
    });
    await page
      .getByRole("button", { name: "Conceder leitura de todo o espaço" })
      .click();
    const originalAttempt = await failedGrant;
    await expect(
      page.getByRole("button", { exact: true, name: "Tentar novamente" })
    ).toBeVisible();
    await page.unroute("**/api/d03/sharing");
    const granted = waitForOperation(page, "GrantWorldReadAccess");
    await page
      .getByRole("button", { exact: true, name: "Tentar novamente" })
      .click();
    const grantedResponse = await granted;
    expect(grantedResponse.status()).toBe(200);
    expect(grantedResponse.request().postData()).toBe(
      originalAttempt.postData()
    );
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("leitor · ativo · revisão 0");
    await expect(
      page.getByRole("region", { exact: true, name: "Compartilhar leitura" })
    ).toContainText("não comprova acesso atual");
    await reader
      .getByLabel("Abrir espaço pelo identificador", { exact: true })
      .fill(world);
    await reader
      .getByRole("button", { exact: true, name: "Abrir espaço" })
      .click();
    await expect(
      reader.getByText("Seu papel: leitor", { exact: true })
    ).toBeVisible();
    await expect(reader.locator('input[type="file"]')).toHaveCount(0);
    await expect(
      reader.getByRole("region", { exact: true, name: "Compartilhar leitura" })
    ).toHaveCount(0);
    const frame = await inspect(reader, subject);
    expect(frame.scopedCorrections).toStrictEqual([]);
    await expect(
      reader.getByRole("region", { exact: true, name: "Decisões por período" })
    ).toHaveCount(0);
    await inspect(reader, subject, frame.frameRef);
    const opened = waitForOperation(reader, "OpenEvidence");
    await reader
      .getByRole("button", {
        exact: true,
        name: `Inspecionar evidência de ${sourceLabel}`,
      })
      .click();
    const openedResponse = await opened;
    expect(openedResponse.status()).toBe(200);
    await expect(reader.locator("blockquote")).toHaveText(document);
    await page
      .getByRole("button", { name: "Revisar revogação de leitura" })
      .click();
    const revoked = waitForOperation(page, "RevokeWorldReadAccess");
    await page
      .getByRole("button", { name: "Revogar leitura do espaço" })
      .click();
    const revokedResponse = await revoked;
    expect(revokedResponse.status()).toBe(200);
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("leitor · revogado · revisão 1");
    // Normal periodic access inspection receives denial and discards all private presentation state.
    await expect(reader.locator(".d01-world-id")).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(reader.getByText(sourceLabel, { exact: true })).toHaveCount(0);
    await expect(reader.locator("blockquote")).toHaveCount(0);
    await expect(
      reader.getByRole("region", { exact: true, name: "Compartilhar leitura" })
    ).toHaveCount(0);
    await page.getByRole("button", { exact: true, name: "Sair" }).click();
    await expect(
      page.getByLabel("Seu identificador de conta", { exact: true })
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { exact: true, name: "Compartilhar leitura" })
    ).toHaveCount(0);
  } finally {
    await viewerContext.close();
  }
});
