import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { PgClient } from "@effect/sql-pg";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { WorldId } from "@zoen/contracts/d01/values";
import { Config, Effect, Schema } from "effect";

import { BrowserSession } from "../../../src/features/d01/client.ts";
import { confirmedLogout } from "../../integration/confirmed-logout.ts";

const baseURL = Effect.runSync(
  Config.string("ZOEN_TEST_WEB_URL").pipe(
    Config.orElse(() => Config.string("ZOEN_PUBLIC_URL"))
  )
);
test.use({ baseURL });

// Keep Better Auth's real 3-signup/10-second guard enabled across the serial suite.
test.beforeEach(async () => {
  await setTimeout(10_100);
});

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

test("EX12 real browser preserves sources and clears private views across sessions, tabs and back", async ({
  browser,
  page,
}, info) => {
  const subject = `obligation-${randomUUID()}`;
  const firstLabel = `Fonte A ${randomUUID()}`;
  const secondLabel = `Fonte B ${randomUUID()}`;
  await signUp(page);
  await page.getByRole("button", { name: "Criar espaço privado" }).click();
  await expect(page.locator(".d01-world-id span")).toBeVisible();
  const world = Schema.decodeUnknownSync(WorldId)(
    await page.locator(".d01-world-id span").textContent()
  );
  await page
    .getByLabel("Adicionar arquivos", { exact: true })
    .setInputFiles([
      sourceFile(subject, firstLabel, "100.00"),
      sourceFile(subject, secondLabel, "200.00"),
    ]);
  await expect(
    page.getByText(
      "Fontes admitidas. Informe a obrigação para consultar os registros.",
      { exact: true }
    )
  ).toBeVisible();
  await inspect(page, subject);
  await expect(page.getByText(firstLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(secondLabel, { exact: true })).toBeVisible();
  await expect(page.getByText("100 BRL", { exact: true })).toBeVisible();
  await expect(page.getByText("200 BRL", { exact: true })).toBeVisible();
  await expect(page.getByText(/fontes divergentes/u)).toBeVisible();
  await expect(
    page.getByText("Não verificado — não comprova pagamento", { exact: true })
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Inspecionar evidência de ${firstLabel}` })
    .click();
  await expect(page.locator("blockquote")).toContainText(firstLabel);
  await page.screenshot({
    fullPage: true,
    path: info.outputPath("authorized-frame.png"),
  });
  await page
    .getByRole("button", { name: `Inspecionar evidência de ${secondLabel}` })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("blockquote")).toContainText(secondLabel);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    fullPage: true,
    path: info.outputPath("document-zoom-200.png"),
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  const otherContext = await browser.newContext({ baseURL });
  try {
    const other = await otherContext.newPage();
    await signUp(other);
    await other.getByLabel("Abrir espaço pelo identificador").fill(world);
    const deniedAccess = other.waitForResponse((response) =>
      response.url().endsWith("/api/d03/sharing")
    );
    await other
      .getByRole("button", { exact: true, name: "Abrir espaço" })
      .click();
    const access = await deniedAccess;
    expect(access.status()).toBe(404);
    expect(await access.json()).toStrictEqual({
      _tag: "NotFoundOrDenied",
      code: "NOT_FOUND_OR_DENIED",
    });
    await expect(other.locator(".d01-world-id")).toHaveCount(0);
    await expect(other.getByLabel("Identificador da obrigação")).toHaveCount(0);
    // Opening now checks access before exposing the form. A direct read must still be denied.
    const deniedRead = await other.request.post("/api/d01/execute", {
      data: {
        input: { atFrame: null, subjectKey: subject },
        operation: "Inspect",
        purpose: "personal-records",
        schemaVersion: "d01.v1",
        worldRef: { realm: "live", worldId: world },
      },
      headers: { Origin: baseURL },
    });
    expect(deniedRead.status()).toBe(404);
    expect(await deniedRead.json()).toStrictEqual({
      _tag: "NotFoundOrDenied",
      code: "NOT_FOUND_OR_DENIED",
    });
    await expect(
      other.getByRole("heading", {
        name: "Não foi possível abrir este conteúdo",
      })
    ).toBeVisible();
    await expect(other.getByText(firstLabel, { exact: true })).toHaveCount(0);
    await expect(other.locator("blockquote")).toHaveCount(0);
  } finally {
    await otherContext.close();
  }

  const sibling = await page.context().newPage();
  await sibling.goto("/");
  await sibling.getByLabel("Abrir espaço pelo identificador").fill(world);
  await sibling
    .getByRole("button", { exact: true, name: "Abrir espaço" })
    .click();
  await inspect(sibling, subject);
  await confirmedLogout(page);
  await expect(
    page.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  await expect(sibling.getByText(firstLabel, { exact: true })).toHaveCount(0);
  await expect(
    sibling.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  await page.goto("about:blank");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  await expect(page.getByText(firstLabel, { exact: true })).toHaveCount(0);
  await expect(page.locator("blockquote")).toHaveCount(0);
  await sibling.close();
});

test("EX12 real membership revocation removes a visible frame and evidence", async ({
  page,
}) => {
  const subject = `revocation-${randomUUID()}`;
  const label = `Revoked source ${randomUUID()}`;
  await signUp(page);
  const sessionResponse = await page.request.get("/api/auth/get-session");
  const session = Schema.decodeUnknownSync(BrowserSession)(
    await sessionResponse.json()
  );
  await page.getByRole("button", { name: "Criar espaço privado" }).click();
  await expect(page.locator(".d01-world-id span")).toBeVisible();
  const world = Schema.decodeUnknownSync(WorldId)(
    await page.locator(".d01-world-id span").textContent()
  );
  await page
    .getByLabel("Adicionar arquivos", { exact: true })
    .setInputFiles(sourceFile(subject, label, "100.00"));
  await expect(
    page.getByText(
      "Fontes admitidas. Informe a obrigação para consultar os registros.",
      { exact: true }
    )
  ).toBeVisible();
  await inspect(page, subject);
  await page
    .getByRole("button", { name: `Inspecionar evidência de ${label}` })
    .click();
  await expect(page.locator("blockquote")).toContainText(label);
  const rows = await Effect.runPromise(
    Effect.gen(function* revokeOwnedMembership() {
      const sql = yield* PgClient.PgClient;
      return yield* sql<{
        readonly principal_id: string;
      }>`UPDATE authority.memberships SET state = 'revoked'
      WHERE world_id = ${world} AND realm = 'live' AND principal_id = ${session.user.id}
      RETURNING principal_id`;
    }).pipe(
      Effect.provide(
        PgClient.layer({
          url: Effect.runSync(Config.redacted("ZOEN_AUTHORITY_DATABASE_URL")),
        })
      )
    )
  );
  expect(rows).toEqual([{ principal_id: session.user.id }]);
  await expect(
    page.getByRole("heading", { name: "Não foi possível abrir este conteúdo" })
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  await expect(page.locator("blockquote")).toHaveCount(0);
  await page.getByRole("button", { exact: true, name: "Sair" }).click();
});
