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

const consultaKey = "compromisso-consulta-ortodontia-2026-09-22";
const agenda = JSON.stringify({
  records: [
    {
      externalId: "consulta-ortodontia-2026-09-22",
      predicate: "obligation.amount",
      subjectKey: consultaKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-22",
        to: "2026-09-23",
      },
      value: { _tag: "Known", amount: "280.00", currency: "BRL" },
    },
    {
      externalId: "retorno-avaliacao-2026-09-24",
      predicate: "obligation.amount",
      subjectKey: "compromisso-retorno-avaliacao-2026-09-24",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-24",
        to: "2026-09-25",
      },
      value: { _tag: "Known", amount: "120.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "agenda-administrativa-2026-09-22",
    label: "Agenda administrativa — 22/09",
    namespace: "clinic.appointments",
    revision: "1",
  },
});
const feeSchedule = JSON.stringify({
  records: [
    {
      externalId: "consulta-ortodontia-2026-09-22",
      predicate: "obligation.amount",
      subjectKey: consultaKey,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-22",
        to: "2026-09-23",
      },
      value: { _tag: "Known", amount: "350.00", currency: "BRL" },
    },
    {
      externalId: "limpeza-preventiva-2026-09-25",
      predicate: "obligation.amount",
      subjectKey: "compromisso-limpeza-preventiva-2026-09-25",
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-25",
        to: "2026-09-26",
      },
      value: { _tag: "Known", amount: "200.00", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "tabela-honorarios-2026-09-22",
    label: "Tabela de honorários — 22/09",
    namespace: "clinic.fees",
    revision: "1",
  },
});
const validTime = {
  from: "2026-09-22",
  to: "2026-09-23",
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

test("ZA-24 browser clinic admin: contested fees, CLI agreement, correct", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const email = `${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    await page.goto("/");
    await page.getByRole("button", { name: "Quero criar uma conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("ZA-24 clinic admin");
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
        buffer: Buffer.from(agenda),
        mimeType: "application/json",
        name: "clinic-appointment-agenda.json",
      },
      {
        buffer: Buffer.from(feeSchedule),
        mimeType: "application/json",
        name: "clinic-fee-schedule.json",
      },
    ]);
    await expect(
      page.getByText(
        "Fontes admitidas. Informe a obrigação para consultar os registros.",
        { exact: true }
      )
    ).toBeVisible();

    const frame = await inspect(page, consultaKey);
    expect(frame.contested).toBe(true);
    expect(frame.selection).toStrictEqual({ _tag: "unresolved" });
    await expect(page.getByText(/fontes divergem/u)).toBeVisible();
    await expect(
      page.getByText("Agenda administrativa — 22/09", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("Tabela de honorários — 22/09", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/fontes divergentes/u)).toBeVisible();
    await expect(
      page.getByText("Não verificado — não comprova pagamento", { exact: true })
    ).toBeVisible();
    // Clinical exclusion: no clinical labels in the admin UI.
    await expect(
      page.getByText(/diagn[oó]stico|prontu[aá]rio|tratamento/iu)
    ).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("za24-contested-consulta.png"),
    });

    const world = frame.worldRef.worldId;
    const cliInspect = await cli(baseURL, directory, [
      "inspect",
      "--world-id",
      world,
      "--subject-key",
      consultaKey,
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

    const retorno = await inspect(
      page,
      "compromisso-retorno-avaliacao-2026-09-24"
    );
    expect(retorno.contested).toBe(false);
    expect(retorno.claims).toHaveLength(1);
    await expect(page.getByText(/fontes divergentes/u)).toHaveCount(0);

    const agendaClaim = frame.claims.find(
      (claim) => claim.source.namespace === "clinic.appointments"
    );
    if (agendaClaim === undefined) {
      throw new Error("Agenda claim required");
    }
    await inspect(page, consultaKey);
    await page
      .getByLabel("Início do período", { exact: true })
      .fill(validTime.from);
    await page
      .getByLabel("Fim do período (exclusivo)", { exact: true })
      .fill(validTime.to);
    await page
      .getByLabel("Referência para sua decisão", { exact: true })
      .selectOption(agendaClaim.claimRef);
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
    const corrected = await inspect(page, consultaKey);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(corrected.claims).toHaveLength(2);
  } finally {
    await removeSessionDirectory(directory);
  }
});
