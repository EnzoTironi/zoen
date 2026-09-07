import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  AnswerQuestion,
  CorrectionApplied,
  FrameInspected,
  Inspect,
  ProposeCorrection,
  SemanticSuccess,
} from "@zoen/contracts/worlds/operations";
import { Config, Effect, Option, Schema } from "effect";

import {
  cli,
  makeSessionDirectory,
  removeSessionDirectory,
} from "./real-cli.ts";

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
const parseSuccess = Schema.decodeUnknownSync(SemanticSuccess);
const validTime = {
  _tag: "DateInterval",
  from: "2026-09-01",
  to: "2026-10-01",
} as const;
const source = (subject: string, label: string, amount: string) =>
  JSON.stringify({
    records: [
      {
        externalId: "r1",
        predicate: "obligation.amount",
        subjectKey: subject,
        validTime,
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "worlds.v1",
    source: {
      externalId: randomUUID(),
      label,
      namespace: "ex14-browser",
      revision: "1",
    },
  });
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
const propose = async (page: Page, choice: string) => {
  await page
    .getByLabel("Início do período", { exact: true })
    .fill(validTime.from);
  await page
    .getByLabel("Fim do período (exclusivo)", { exact: true })
    .fill(validTime.to);
  await page
    .getByLabel("Referência para sua decisão", { exact: true })
    .selectOption(choice);
  const response = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/api/corrections/execute")
  );
  await page
    .getByRole("button", { exact: true, name: "Revisar proposta" })
    .click();
  const actual = await response;
  const request = Schema.decodeUnknownSync(ProposeCorrection)(
    actual.request().postDataJSON()
  );
  const result = parseSuccess(await actual.json());
  expect(result._tag).toBe("CorrectionProposed");
  await expect(
    page.getByRole("region", { exact: true, name: "Proposta para confirmação" })
  ).toBeVisible();
  return { request, result };
};

test("EX14 browser decisions replay through CLI and preserve stale consent, historical frames and undo", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const email = `${randomUUID()}@example.test`;
    const password = randomBytes(24).toString("base64url");
    const subject = `invoice-${randomUUID()}`;
    await page.goto("/");
    await page.getByRole("button", { name: "Quero criar uma conta" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("EX14 browser owner");
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
    await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles(
      ["100", "200"].map((amount) => ({
        buffer: Buffer.from(source(subject, `Fonte ${amount}`, amount)),
        mimeType: "application/json",
        name: `source-${amount}.json`,
      }))
    );
    await expect(
      page.getByText(
        "Fontes admitidas. Informe a obrigação para consultar os registros.",
        { exact: true }
      )
    ).toBeVisible();
    const original = await inspect(page, subject);
    const [claim] = original.claims;
    if (claim === undefined) {
      throw new Error("Real import must yield a claim");
    }
    const world = original.worldRef.worldId;
    const proposal = await propose(page, claim.claimRef);
    const proposalReplay = await cli(baseURL, directory, [
      "propose-correction",
      "--world-id",
      world,
      "--operation-id",
      proposal.request.operationId,
      "--frame-ref",
      original.frameRef,
      "--subject-key",
      subject,
      "--valid-from",
      validTime.from,
      "--valid-to",
      validTime.to,
      "--choice",
      "select-claim",
      "--claim-ref",
      claim.claimRef,
    ]);
    expect(proposalReplay.exitCode).toBe(0);
    expect(proposalReplay.stderr).toBe("");
    expect(parseSuccess(JSON.parse(proposalReplay.stdout))).toEqual(
      proposal.result
    );
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("proposal.png"),
    });
    const answerResponse = page.waitForResponse((candidate) =>
      candidate.url().endsWith("/api/corrections/execute")
    );
    await page
      .getByRole("button", { exact: true, name: "Confirmar decisão" })
      .click();
    const answer = await answerResponse;
    const answerRequest = Schema.decodeUnknownSync(AnswerQuestion)(
      answer.request().postDataJSON()
    );
    const applied = Schema.decodeUnknownSync(CorrectionApplied)(
      await answer.json()
    );
    await expect(page.getByText(/Decisão registrada\. Recibo/u)).toBeVisible();
    const replay = await cli(baseURL, directory, [
      "answer-question",
      "--world-id",
      world,
      "--operation-id",
      answerRequest.operationId,
      "--question-ref",
      answerRequest.input.questionRef,
      "--consequence-digest",
      answerRequest.input.consequenceDigest,
      "--answer",
      "confirm",
    ]);
    expect(replay.exitCode).toBe(0);
    expect(replay.stderr).toBe("");
    expect(parseSuccess(JSON.parse(replay.stdout))).toEqual(applied);
    const corrected = await inspect(page, subject);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(corrected.claims).toEqual(original.claims);
    expect(corrected.contested).toBe(true);
    expect(corrected.verification).toBe("unverified");
    expect(await inspect(page, subject, original.frameRef)).toEqual(original);
    await expect(
      page.getByRole("region", { exact: true, name: "Decisões registradas" })
    ).toHaveCount(0);
    await inspect(page, subject);
    await page
      .getByRole("button", {
        exact: true,
        name: "Desfazer decisão deste período",
      })
      .click();
    await expect(page.getByText(/Decisão desfeita\. Recibo/u)).toBeVisible();
    const undone = await inspect(page, subject);
    expect(undone.scopedCorrections).toEqual([]);
    expect(await inspect(page, subject, corrected.frameRef)).toEqual(corrected);
    await inspect(page, subject);
    await propose(page, claim.claimRef);
    const changed = await cli(
      baseURL,
      directory,
      ["import", "--world-id", world, "--operation-id", randomUUID()],
      source(subject, "Fonte nova", "300")
    );
    expect(changed.exitCode).toBe(0);
    const staleResponse = page.waitForResponse((candidate) =>
      candidate.url().endsWith("/api/corrections/execute")
    );
    await page
      .getByRole("button", { exact: true, name: "Confirmar decisão" })
      .click();
    const stale = await staleResponse;
    expect(await stale.json()).toEqual({ _tag: "Stale", code: "STALE" });
    await expect(
      page.getByText(
        "A base mudou. Consulte novamente antes de propor outra decisão.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        exact: true,
        name: "Proposta para confirmação",
      })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Tentar novamente" })
    ).toHaveCount(0);
    const afterStale = await inspect(page, subject);
    expect(afterStale.scopedCorrections).toEqual([]);
    await propose(page, "unknown");
    await page
      .getByRole("button", { exact: true, name: "Não sei responder" })
      .click();
    await expect(page.getByText(/Decisão registrada\. Recibo/u)).toBeVisible();
    const unknown = await inspect(page, subject);
    expect(unknown.scopedCorrections.map((item) => item.choice)).toEqual([
      { _tag: "unknown" },
    ]);
    expect(unknown.claims).toEqual(afterStale.claims);
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("explicit-unknown.png"),
    });
    await page.getByRole("button", { exact: true, name: "Sair" }).click();
    const signedOut = await cli(baseURL, directory, ["sign-out"]);
    expect(signedOut.exitCode).toBe(0);
  } finally {
    await removeSessionDirectory(directory);
  }
});
