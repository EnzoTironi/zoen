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
test.setTimeout(90_000);

test.beforeEach(async () => {
  await setTimeout(10_100);
});

const boloKey = "pedido-bolo-casamento-2026-09-20";
const customerOrders = JSON.stringify({
  records: [
    {
      externalId: "bolo-casamento-2026-09-20",
      predicate: "obligation.amount",
      subjectKey: boloKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-20",
        to: "2026-09-21",
      },
      value: { _tag: "Known", amount: "450.00", currency: "BRL" },
    },
    {
      externalId: "kit-festa-2026-09-20",
      predicate: "obligation.amount",
      subjectKey: "pedido-kit-festa-2026-09-20",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-20",
        to: "2026-09-21",
      },
      value: { _tag: "Known", amount: "180.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "pedidos-clientes-2026-09-20",
    label: "Lista de pedidos dos clientes — 20/09",
    namespace: "bakery.orders",
    revision: "1",
  },
});
const shopList = JSON.stringify({
  records: [
    {
      externalId: "bolo-casamento-2026-09-20",
      predicate: "obligation.amount",
      subjectKey: boloKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-20",
        to: "2026-09-21",
      },
      value: { _tag: "Known", amount: "520.00", currency: "BRL" },
    },
    {
      externalId: "pao-frances-encomenda-2026-09-22",
      predicate: "obligation.amount",
      subjectKey: "pedido-pao-frances-2026-09-22",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-22",
        to: "2026-09-23",
      },
      value: { _tag: "Known", amount: "95.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "lista-producao-2026-09-20",
    label: "Lista de produção da loja — 20/09",
    namespace: "bakery.shop",
    revision: "1",
  },
});
const validTime = {
  from: "2026-09-20",
  to: "2026-09-21",
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

test("ZA-23 browser bakery lists: contested order, CLI agreement, correct and undo", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const email = `${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    await page.goto("/");
    await page.getByRole("button", { name: "Quero criar uma conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("ZA-23 bakery owner");
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
        buffer: Buffer.from(customerOrders),
        mimeType: "application/json",
        name: "bakery-order-list-pedidos.json",
      },
      {
        buffer: Buffer.from(shopList),
        mimeType: "application/json",
        name: "bakery-order-list-producao.json",
      },
    ]);
    await expect(
      page.getByText(
        "Fontes admitidas. Informe a obrigação para consultar os registros.",
        { exact: true }
      )
    ).toBeVisible();

    const frame = await inspect(page, boloKey);
    expect(frame.contested).toBe(true);
    expect(frame.selection).toStrictEqual({ _tag: "unresolved" });
    await expect(page.getByText(/fontes divergem/u)).toBeVisible();
    await expect(
      page.getByText("Lista de pedidos dos clientes — 20/09", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Lista de produção da loja — 20/09", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/fontes divergentes/u)).toBeVisible();
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("za23-contested-bolo.png"),
    });

    const world = frame.worldRef.worldId;
    const cliInspect = await cli(baseURL, directory, [
      "inspect",
      "--world-id",
      world,
      "--subject-key",
      boloKey,
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

    // Unrelated order commitment is not contested
    const kit = await inspect(page, "pedido-kit-festa-2026-09-20");
    expect(kit.contested).toBe(false);
    expect(kit.claims).toHaveLength(1);
    await expect(page.getByText(/fontes divergentes/u)).toHaveCount(0);

    const customerClaim = frame.claims.find(
      (claim) => claim.source.namespace === "bakery.orders"
    );
    if (customerClaim === undefined) {
      throw new Error("Customer order claim required");
    }
    // Re-open contested bolo for correction UI
    await inspect(page, boloKey);
    await page
      .getByLabel("Início do período", { exact: true })
      .fill(validTime.from);
    await page
      .getByLabel("Fim do período (exclusivo)", { exact: true })
      .fill(validTime.to);
    await page
      .getByLabel("Referência para sua decisão", { exact: true })
      .selectOption(customerClaim.claimRef);
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
    const corrected = await inspect(page, boloKey);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(corrected.claims).toHaveLength(2);

    await page
      .getByRole("button", {
        exact: true,
        name: "Desfazer decisão deste período",
      })
      .click();
    await expect(page.getByText(/Decisão desfeita\. Recibo/u)).toBeVisible();
    const undone = await inspect(page, boloKey);
    expect(undone.scopedCorrections).toEqual([]);
    expect(await inspect(page, boloKey, corrected.frameRef)).toEqual(corrected);
  } finally {
    await removeSessionDirectory(directory);
  }
});
