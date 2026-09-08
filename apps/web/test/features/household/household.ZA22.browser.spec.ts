import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { FrameInspected, Inspect } from "@zoen/contracts/worlds/operations";
import { Config, Effect, Option, Schema } from "effect";

import {
  cli,
  makeSessionDirectory,
  removeSessionDirectory,
} from "../../integration/corrections/real-cli.ts";

const baseURL = Effect.runSync(
  Config.string("ZOEN_TEST_WEB_URL").pipe(
    Config.orElse(() => Config.string("ZOEN_PUBLIC_URL"))
  )
);
test.use({ baseURL });
test.setTimeout(120_000);

test.beforeEach(async () => {
  await setTimeout(10_100);
});

const luzKey = "conta-luz-2026-09";
const bankList = JSON.stringify({
  records: [
    {
      externalId: "luz-2026-09",
      predicate: "obligation.amount",
      subjectKey: luzKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "189.90", currency: "BRL" },
    },
    {
      externalId: "agua-2026-09",
      predicate: "obligation.amount",
      subjectKey: "conta-agua-2026-09",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "72.40", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "extrato-setembro-2026",
    label: "Extrato do banco — setembro",
    namespace: "household.bank",
    revision: "1",
  },
});
const sheetList = JSON.stringify({
  records: [
    {
      externalId: "luz-2026-09",
      predicate: "obligation.amount",
      subjectKey: luzKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "210.00", currency: "BRL" },
    },
    {
      externalId: "internet-2026-q3",
      predicate: "obligation.amount",
      subjectKey: "internet-2026-q3",
      validTime: {
        _tag: "DateInterval",
        from: "2026-07-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "99.90", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "planilha-contas-setembro-2026",
    label: "Planilha de contas — setembro",
    namespace: "household.spreadsheet",
    revision: "1",
  },
});
const validTime = {
  from: "2026-09-01",
  to: "2026-10-01",
} as const;

const inspect = async (page: Page, subject: string, atFrame = "") => {
  await page
    .getByLabel("Identificador da obrigação", { exact: true })
    .fill(subject);
  await page
    .getByLabel("Referência de leitura anterior (opcional)", { exact: true })
    .fill(atFrame);
  const response = page.waitForResponse((candidate) => {
    if (!candidate.url().endsWith("/api/worlds/execute")) {
      return false;
    }
    const request = Schema.decodeUnknownOption(Inspect)(
      candidate.request().postDataJSON()
    );
    return (
      Option.isSome(request) &&
      request.value.input.subjectKey === subject &&
      request.value.input.atFrame === (atFrame === "" ? null : atFrame)
    );
  });
  await page
    .getByRole("button", { exact: true, name: "Consultar fontes" })
    .click();
  const actual = await response;
  const { frame } = Schema.decodeUnknownSync(FrameInspected)(
    await actual.json()
  );
  await expect(
    page.getByRole("heading", { exact: true, name: subject })
  ).toBeVisible();
  return frame;
};

test("ZA-22 browser household lists: contested commitment, CLI agreement, correct and undo", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const email = `${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    await page.goto("/");
    await page.getByRole("button", { name: "Quero criar uma conta" }).click();
    await page
      .getByLabel("Nome", { exact: true })
      .fill("ZA-22 household owner");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page
      .getByRole("button", { exact: true, name: "Criar conta" })
      .click();
    await expect(
      page.getByRole("button", { name: "Criar espaço privado" })
    ).toBeVisible();
    const signedIn = await cli(
      baseURL,
      directory,
      ["sign-in", "--email", email],
      `${password}\n`
    );
    expect(signedIn).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: '{"_tag":"SignedIn"}\n',
    });

    await page.getByRole("button", { name: "Criar espaço privado" }).click();
    await expect(page.locator(".worlds-world-id span")).toBeVisible();
    await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles([
      {
        buffer: Buffer.from(bankList),
        mimeType: "application/json",
        name: "household-bill-list-banco.json",
      },
      {
        buffer: Buffer.from(sheetList),
        mimeType: "application/json",
        name: "household-bill-list-planilha.json",
      },
    ]);
    await expect(
      page.getByText(
        "Fontes admitidas. Informe a obrigação para consultar os registros.",
        { exact: true }
      )
    ).toBeVisible();

    const frame = await inspect(page, luzKey);
    expect(frame.contested).toBe(true);
    expect(frame.selection).toStrictEqual({ _tag: "unresolved" });
    await expect(
      page.getByText(
        "As fontes divergem em um período comparável. Confira ambas as fontes e a interpretação atual.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      page.getByText("Extrato do banco — setembro", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Planilha de contas — setembro", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/fontes divergentes/u)).toBeVisible();
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("za22-contested-luz.png"),
    });

    const world = frame.worldRef.worldId;
    const cliInspect = await cli(baseURL, directory, [
      "inspect",
      "--world-id",
      world,
      "--subject-key",
      luzKey,
    ]);
    expect(cliInspect.exitCode).toBe(0);
    expect(cliInspect.stderr).toBe("");
    const cliFrame = Schema.decodeUnknownSync(FrameInspected)(
      JSON.parse(cliInspect.stdout)
    ).frame;
    expect(cliFrame.contested).toBe(true);
    expect(cliFrame.selection).toStrictEqual(frame.selection);
    expect(
      cliFrame.claims
        .map((claim) => ({
          amount: claim.value._tag === "Known" ? claim.value.amount : null,
          currency: claim.value._tag === "Known" ? claim.value.currency : null,
          label: claim.source.label,
          namespace: claim.source.namespace,
        }))
        .toSorted((left, right) =>
          left.namespace.localeCompare(right.namespace)
        )
    ).toStrictEqual(
      frame.claims
        .map((claim) => ({
          amount: claim.value._tag === "Known" ? claim.value.amount : null,
          currency: claim.value._tag === "Known" ? claim.value.currency : null,
          label: claim.source.label,
          namespace: claim.source.namespace,
        }))
        .toSorted((left, right) =>
          left.namespace.localeCompare(right.namespace)
        )
    );

    // ZA-22-02 — unrelated commitment is not contested
    const agua = await inspect(page, "conta-agua-2026-09");
    expect(agua.contested).toBe(false);
    expect(agua.claims).toHaveLength(1);
    await expect(page.getByText(/fontes divergentes/u)).toHaveCount(0);

    // Re-open contested luz so the decision select lists its claims (not água).
    const contestedAgain = await inspect(page, luzKey);
    expect(contestedAgain.contested).toBe(true);
    const bankClaim = contestedAgain.claims.find(
      (claim) => claim.source.namespace === "household.bank"
    );
    if (bankClaim === undefined) {
      throw new Error("Bank claim required");
    }
    await page
      .getByLabel("Início do período", { exact: true })
      .fill(validTime.from);
    await page
      .getByLabel("Fim do período (exclusivo)", { exact: true })
      .fill(validTime.to);
    await page
      .getByLabel("Referência para sua decisão", { exact: true })
      .selectOption(bankClaim.claimRef);
    await page
      .getByRole("button", { exact: true, name: "Revisar proposta" })
      .click();
    await expect(
      page.getByRole("region", {
        exact: true,
        name: "Proposta para confirmação",
      })
    ).toBeVisible();
    await page
      .getByRole("button", { exact: true, name: "Confirmar decisão" })
      .click();
    await expect(page.getByText(/Decisão registrada\. Recibo/u)).toBeVisible();
    const corrected = await inspect(page, luzKey);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(corrected.claims).toHaveLength(2);

    await page
      .getByRole("button", {
        exact: true,
        name: "Desfazer decisão deste período",
      })
      .click();
    await expect(page.getByText(/Decisão desfeita\. Recibo/u)).toBeVisible();
    const undone = await inspect(page, luzKey);
    expect(undone.scopedCorrections).toEqual([]);
    expect(await inspect(page, luzKey, corrected.frameRef)).toEqual(corrected);
  } finally {
    await removeSessionDirectory(directory);
  }
});
