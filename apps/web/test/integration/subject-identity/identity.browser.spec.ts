import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SemanticRequest } from "@zoen/contracts/d01/operations";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
} from "@zoen/contracts/subject-identity/operations";
import { Config, Effect, Option, Schema } from "effect";

// Explicit subject-identity profile only: never fall back to a prior JSON/CSV/sharing install.
const baseURL = Effect.runSync(
  Config.string("ZOEN_TEST_SUBJECT_IDENTITY_WEB_URL")
);
test.use({ baseURL });
test.setTimeout(90_000);
test.beforeEach(async () => {
  await setTimeout(10_100);
});

const waitForIdentity = (
  page: Page,
  operation:
    | "InspectSubjectIdentity"
    | "ProposeIdentityResolution"
    | "ResolveIdentity"
) =>
  page.waitForResponse((response) => {
    if (!response.url().endsWith("/api/d02/subject-identity")) {
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
    .fill("Subject identity browser");
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

const dualSubjectSource = (left: string, right: string, label: string) => ({
  buffer: Buffer.from(
    JSON.stringify({
      records: [
        {
          externalId: "row-a",
          predicate: "obligation.amount",
          subjectKey: left,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount: "100.00", currency: "BRL" },
        },
        {
          externalId: "row-b",
          predicate: "obligation.amount",
          subjectKey: right,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount: "120.00", currency: "BRL" },
        },
      ],
      schemaVersion: "d01.v1",
      source: {
        externalId: randomUUID(),
        label,
        namespace: "subject-identity-browser",
        revision: "1",
      },
    })
  ),
  mimeType: "application/json",
  name: `${label}.json`,
});

test("ID-15 owner inspects, proposes same-as and confirms over real HTTP fence", async ({
  page,
}) => {
  const left = `A-${randomUUID().slice(0, 8)}`;
  const right = `B-${randomUUID().slice(0, 8)}`;
  const label = `Identity source ${randomUUID()}`;
  await signUp(page);
  await page.getByRole("button", { name: "Criar espaço privado" }).click();
  await expect(page.locator(".d01-world-id span")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Identidade de assuntos" })
  ).toBeVisible();

  await page
    .getByLabel("Adicionar arquivos", { exact: true })
    .setInputFiles([dualSubjectSource(left, right, label)]);
  await expect(
    page.getByText(
      "Fontes admitidas. Informe a obrigação para consultar os registros.",
      { exact: true }
    )
  ).toBeVisible();

  await page
    .getByLabel("Âncoras (1 ou 2, separadas por vírgula)", { exact: true })
    .fill(`${left},${right}`);
  const inspected = waitForIdentity(page, "InspectSubjectIdentity");
  await page
    .getByRole("button", { exact: true, name: "Inspecionar identidade" })
    .click();
  const inspectResponse = await inspected;
  expect(inspectResponse.status()).toBe(200);
  const { frame } = Schema.decodeUnknownSync(SubjectIdentityInspected)(
    await inspectResponse.json()
  );
  expect(frame.kind).toBe("subject-identity");
  expect(frame.closureAnchors).toEqual(expect.arrayContaining([left, right]));
  await expect(
    page.getByRole("region", { name: "Frame de identidade" })
  ).toContainText("subject-identity");
  await expect(
    page.getByRole("region", { name: "Frame de identidade" })
  ).toContainText("Células:");

  await page.getByLabel("Esquerda", { exact: true }).fill(left);
  await page.getByLabel("Direita", { exact: true }).fill(right);
  const proposed = waitForIdentity(page, "ProposeIdentityResolution");
  await page
    .getByRole("button", { exact: true, name: "Propor resolução" })
    .click();
  const proposeResponse = await proposed;
  expect(proposeResponse.status()).toBe(200);
  const { question } = Schema.decodeUnknownSync(IdentityProposed)(
    await proposeResponse.json()
  );
  expect(question.kind).toBe("identity-resolution");
  await expect(
    page.getByRole("region", { name: "Question de identidade" })
  ).toContainText(question.consequenceDigest);
  await expect(
    page.getByRole("region", { name: "Question de identidade" })
  ).toContainText("private-author");

  await page
    .getByRole("button", { exact: true, name: "Revisar resposta same-as" })
    .click();
  await expect(
    page.getByRole("region", { name: "Confirmar resposta de identidade" })
  ).toBeVisible();
  const resolved = waitForIdentity(page, "ResolveIdentity");
  await page
    .getByRole("button", { exact: true, name: "Confirmar same-as" })
    .click();
  const resolveResponse = await resolved;
  expect(resolveResponse.status()).toBe(200);
  const applied = Schema.decodeUnknownSync(IdentityResolved)(
    await resolveResponse.json()
  );
  expect(applied.outcome).toBe("applied");
  expect(applied.decisionRef).not.toBeNull();
  await expect(page.getByText(/Última resolução: applied/u)).toBeVisible();
  await expect(page.getByText(/Recibo:/u)).toBeVisible();
});
