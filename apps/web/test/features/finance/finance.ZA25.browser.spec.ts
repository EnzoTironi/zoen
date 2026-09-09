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

const consultoriaKey = "fatura-consultoria-2026-09";
const ledger = JSON.stringify({
  records: [
    {
      externalId: "fatura-consultoria-2026-09",
      predicate: "obligation.amount",
      subjectKey: consultoriaKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "3500.00", currency: "BRL" },
    },
    {
      externalId: "fatura-software-2026-09",
      predicate: "obligation.amount",
      subjectKey: "fatura-software-2026-09",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "890.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "livro-razao-faturas-2026-09",
    label: "Livro-razão / faturas — setembro (reconhecimento)",
    namespace: "finance.ledger",
    revision: "1",
  },
});
const statement = JSON.stringify({
  records: [
    {
      externalId: "fatura-consultoria-2026-09",
      predicate: "obligation.amount",
      subjectKey: consultoriaKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "3200.00", currency: "BRL" },
    },
    {
      externalId: "fatura-software-2026-09",
      predicate: "obligation.amount",
      subjectKey: "fatura-software-2026-09",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: "890.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "extrato-autorizado-2026-09",
    label: "Extrato autorizado — setembro (liquidação reportada)",
    namespace: "finance.statement",
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

test("ZA-25 browser finance lists: contested invoice, CLI agreement, correct and undo without payment proof", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const email = `${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    await page.goto("/");
    await page.getByRole("button", { name: "Quero criar uma conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("ZA-25 finance owner");
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
        buffer: Buffer.from(ledger),
        mimeType: "application/json",
        name: "finance-ledger-invoices.json",
      },
      {
        buffer: Buffer.from(statement),
        mimeType: "application/json",
        name: "finance-authorized-statement.json",
      },
    ]);
    await expect(
      page.getByText(
        "Fontes admitidas. Informe a obrigação para consultar os registros.",
        { exact: true }
      )
    ).toBeVisible();

    const frame = await inspect(page, consultoriaKey);
    expect(frame.contested).toBe(true);
    expect(frame.selection).toStrictEqual({ _tag: "unresolved" });
    expect(frame.verification).toBe("unverified");
    await expect(page.getByText(/fontes divergem/u)).toBeVisible();
    await expect(
      page.getByText("Livro-razão / faturas — setembro (reconhecimento)", {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByText("Extrato autorizado — setembro (liquidação reportada)", {
        exact: true,
      })
    ).toBeVisible();
    await expect(page.getByText(/fontes divergentes/u)).toBeVisible();
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("za25-contested-consultoria.png"),
    });

    const world = frame.worldRef.worldId;
    const cliInspect = await cli(baseURL, directory, [
      "inspect",
      "--world-id",
      world,
      "--subject-key",
      consultoriaKey,
    ]);
    expect(cliInspect.exitCode).toBe(0);
    expect(cliInspect.stderr).toBe("");
    const cliFrame = Schema.decodeUnknownSync(FrameInspected)(
      JSON.parse(cliInspect.stdout)
    ).frame;
    expect(cliFrame.contested).toBe(true);
    expect(cliFrame.verification).toBe("unverified");
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

    // Matching recognized vs statement amounts are not contested and stay unverified.
    const software = await inspect(page, "fatura-software-2026-09");
    expect(software.contested).toBe(false);
    expect(software.claims).toHaveLength(2);
    expect(software.selection._tag).toBe("set-valued");
    expect(software.verification).toBe("unverified");
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();

    const ledgerClaim = frame.claims.find(
      (claim) => claim.source.namespace === "finance.ledger"
    );
    if (ledgerClaim === undefined) {
      throw new Error("Ledger claim required");
    }
    await inspect(page, consultoriaKey);
    await page
      .getByLabel("Início do período", { exact: true })
      .fill(validTime.from);
    await page
      .getByLabel("Fim do período (exclusivo)", { exact: true })
      .fill(validTime.to);
    await page
      .getByLabel("Referência para sua decisão", { exact: true })
      .selectOption(ledgerClaim.claimRef);
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
    const corrected = await inspect(page, consultoriaKey);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(corrected.claims).toHaveLength(2);
    expect(corrected.verification).toBe("unverified");
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();

    await page
      .getByRole("button", {
        exact: true,
        name: "Desfazer decisão deste período",
      })
      .click();
    await expect(page.getByText(/Decisão desfeita\. Recibo/u)).toBeVisible();
    const undone = await inspect(page, consultoriaKey);
    expect(undone.scopedCorrections).toEqual([]);
    expect(undone.verification).toBe("unverified");
    expect(await inspect(page, consultoriaKey, corrected.frameRef)).toEqual(
      corrected
    );
  } finally {
    await removeSessionDirectory(directory);
  }
});
