import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { NodeServices } from "@effect/platform-node";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  CorrectionApplied,
  CorrectionUndone,
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  ImportEvidence,
  SemanticRequest,
} from "@zoen/contracts/d01/operations";
import { Config, Effect, FileSystem, Option, Path, Schema } from "effect";

import {
  cli,
  makeSessionDirectory,
  removeSessionDirectory,
} from "../d02/real-cli.ts";

// Explicit isolated CSV profile only: never fall back to a retained JSON installation.
const baseURL = Effect.runSync(Config.string("ZOEN_TEST_CSV_WEB_URL"));
const validTime = {
  _tag: "DateInterval",
  from: "2026-09-01",
  to: "2026-10-01",
} as const;
const waitForOperation = (
  page: Page,
  operation: SemanticRequest["operation"]
) =>
  page.waitForResponse((response) => {
    if (
      !response.url().endsWith("/api/d01/execute") &&
      !response.url().endsWith("/api/d01/corrections")
    ) {
      return false;
    }
    const request = Schema.decodeUnknownOption(SemanticRequest)(
      response.request().postDataJSON()
    );
    return Option.isSome(request) && request.value.operation === operation;
  });
const signUp = async (page: Page) => {
  const email = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("base64url");
  await page.goto("/");
  await page.getByRole("button", { name: "Quero criar uma conta" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("CSV browser owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { exact: true, name: "Criar conta" }).click();
  await expect(
    page.getByRole("button", { name: "Criar espaço privado" })
  ).toBeVisible();
  return { email, password };
};
const createWorld = async (page: Page) => {
  await page.getByRole("button", { name: "Criar espaço privado" }).click();
  await expect(page.locator(".d01-world-id span")).toBeVisible();
};
const quoted = (text: string) => `"${text.replaceAll('"', '""')}"`;
const csvSource = (subject: string, label: string, amount: string) =>
  [
    "schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo",
    `d01.csv.v1,csv-browser,${randomUUID()},1,${quoted(label)},r1,${subject},obligation.amount,Known,${amount},BRL,DateInterval,${validTime.from},${validTime.to}`,
    "",
  ].join("\r\n");
const jsonSource = (subject: string, label: string, amount: string) =>
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
    schemaVersion: "d01.v1",
    source: {
      externalId: randomUUID(),
      label,
      namespace: "json-browser",
      revision: "1",
    },
  });
const upload = async (page: Page, document: string, format: "json" | "csv") => {
  await page
    .getByLabel("Formato dos arquivos", { exact: true })
    .selectOption(format);
  const response = waitForOperation(page, "ImportEvidence");
  await page.getByLabel("Adicionar arquivos", { exact: true }).setInputFiles({
    buffer: Buffer.from(document),
    mimeType: format === "csv" ? "text/csv" : "application/json",
    name: `source.${format}`,
  });
  return await response;
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
  const response = waitForOperation(page, "ProposeCorrection");
  await page
    .getByRole("button", { exact: true, name: "Revisar proposta" })
    .click();
  const actual = await response;
  expect(actual.status()).toBe(200);
  await expect(
    page.getByRole("region", { exact: true, name: "Proposta para confirmação" })
  ).toBeVisible();
};

test.use({ baseURL });
test.setTimeout(60_000);
test.beforeEach(async () => {
  await setTimeout(10_100);
});

test("CSV-13 browser retains original CSV and operation across network retry and CLI replay", async ({
  page,
  context,
  browser,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const { email, password } = await signUp(page);
    await createWorld(page);
    await expect(
      page.getByLabel("Formato dos arquivos", { exact: true })
    ).toHaveValue("json");
    const subject = `csv-${randomUUID()}`;
    const label = 'Fonte CSV, "setembro"\r\n<script>literal</script>';
    const document = csvSource(subject, label, "100.00");
    const wrong = await upload(page, document, "json");
    expect(await wrong.json()).toEqual({
      _tag: "InvalidInput",
      code: "INVALID_INPUT",
    });
    await expect(
      page.getByRole("button", { name: "Tentar novamente" })
    ).toHaveCount(0);
    await page
      .getByLabel("Formato dos arquivos", { exact: true })
      .selectOption("csv");
    await expect(
      page.getByLabel("Adicionar arquivos", { exact: true })
    ).toBeAttached();
    const failedRequest = page.waitForRequest((request) => {
      if (!request.url().endsWith("/api/d01/execute")) {
        return false;
      }
      return Option.isSome(
        Schema.decodeUnknownOption(ImportEvidence)(request.postDataJSON())
      );
    });
    try {
      await context.setOffline(true);
      await page
        .getByLabel("Adicionar arquivos", { exact: true })
        .setInputFiles({
          buffer: Buffer.from(document),
          mimeType: "application/json",
          name: "deliberately-mislabeled.json",
        });
      await expect(
        page.getByRole("button", { exact: true, name: "Tentar novamente" })
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    const failed = await failedRequest;
    const attempted = Schema.decodeUnknownSync(ImportEvidence)(
      failed.postDataJSON()
    );
    expect(attempted.input).toEqual({ document, format: "d01.csv.v1" });
    await page
      .getByLabel("Formato dos arquivos", { exact: true })
      .selectOption("json");
    const retried = waitForOperation(page, "ImportEvidence");
    await page
      .getByRole("button", { exact: true, name: "Tentar novamente" })
      .click();
    const response = await retried;
    expect(response.request().postDataJSON()).toEqual(attempted);
    const imported = Schema.decodeUnknownSync(EvidenceImported)(
      await response.json()
    );
    const signedIn = await cli(
      baseURL,
      directory,
      ["sign-in", "--email", email],
      `${password}\n`
    );
    expect(signedIn.exitCode).toBe(0);
    const replay = await cli(
      baseURL,
      directory,
      [
        "import",
        "--format",
        "csv",
        "--world-id",
        attempted.worldRef.worldId,
        "--operation-id",
        attempted.operationId,
      ],
      document
    );
    expect(replay.exitCode).toBe(0);
    expect(replay.stderr).toBe("");
    expect(
      Schema.decodeUnknownSync(EvidenceImported)(JSON.parse(replay.stdout))
    ).toEqual(imported);
    const filePath = await Effect.runPromise(
      Effect.gen(function* writeOriginalCsv() {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const target = path.join(directory, "original.csv");
        yield* fs.writeFile(target, new TextEncoder().encode(document));
        return target;
      }).pipe(Effect.provide(NodeServices.layer))
    );
    const fileReplay = await cli(baseURL, directory, [
      "import",
      "--format",
      "csv",
      "--file",
      filePath,
      "--world-id",
      attempted.worldRef.worldId,
      "--operation-id",
      attempted.operationId,
    ]);
    expect(fileReplay.exitCode).toBe(0);
    expect(fileReplay.stderr).toBe("");
    expect(
      Schema.decodeUnknownSync(EvidenceImported)(JSON.parse(fileReplay.stdout))
    ).toEqual(imported);
    const frame = await inspect(page, subject);
    expect(frame.claims).toHaveLength(1);
    expect(frame.claims[0]).toMatchObject({
      recordId: "r1",
      recordIndex: 0,
      value: { _tag: "Known", amount: "100", currency: "BRL" },
      verification: "unverified",
    });
    await expect(page.getByText(/registro 1 \(r1\)/u)).toBeVisible();
    const opened = waitForOperation(page, "OpenEvidence");
    await page
      .getByRole("button", { name: /Inspecionar evidência de Fonte CSV/u })
      .click();
    const openedResponse = await opened;
    const original = Schema.decodeUnknownSync(EvidenceOpened)(
      await openedResponse.json()
    );
    expect(original.mediaType).toBe("text/csv");
    expect(Buffer.from(original.document)).toEqual(Buffer.from(document));
    await expect(page.locator("blockquote")).toBeVisible();
    expect(await page.locator("blockquote").textContent()).toBe(document);
    await expect(page.locator("blockquote script")).toHaveCount(0);
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("original-csv.png"),
    });
    const otherContext = await browser.newContext({ baseURL });
    try {
      const other = await otherContext.newPage();
      await signUp(other);
      await other
        .getByLabel("Abrir espaço pelo identificador")
        .fill(attempted.worldRef.worldId);
      await other
        .getByRole("button", { exact: true, name: "Abrir espaço" })
        .click();
      await other.getByLabel("Identificador da obrigação").fill(subject);
      await other.getByRole("button", { name: "Consultar fontes" }).click();
      await expect(
        other.getByRole("heading", {
          name: "Não foi possível abrir este conteúdo",
        })
      ).toBeVisible();
      await expect(other.locator("blockquote")).toHaveCount(0);
      await expect(other.getByText(/Fonte CSV/u)).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
    await page.getByRole("button", { exact: true, name: "Sair" }).click();
    await expect(
      page.getByRole("heading", { name: "Entre para continuar" })
    ).toBeVisible();
    await page.goto("about:blank");
    await page.goBack();
    await expect(page.locator("blockquote")).toHaveCount(0);
    await expect(page.getByText(/Fonte CSV/u)).toHaveCount(0);
    const signedOut = await cli(baseURL, directory, ["sign-out"]);
    expect(signedOut.exitCode).toBe(0);
  } finally {
    await removeSessionDirectory(directory);
  }
});

test("CSV-13 explicit CSV batch rejects JSON without fallback and resets format at World boundaries", async ({
  page,
}) => {
  await signUp(page);
  await createWorld(page);
  const document = jsonSource(
    `json-${randomUUID()}`,
    "JSON remains JSON",
    "200.00"
  );
  const response = await upload(page, document, "csv");
  expect(await response.json()).toEqual({
    _tag: "InvalidInput",
    code: "INVALID_INPUT",
  });
  expect(
    Schema.decodeUnknownSync(ImportEvidence)(response.request().postDataJSON())
      .input
  ).toEqual({ document, format: "d01.csv.v1" });
  await expect(
    page.getByLabel("Formato dos arquivos", { exact: true })
  ).toHaveValue("csv");
  await expect(
    page.getByLabel("Adicionar arquivos", { exact: true })
  ).toBeAttached();
  const subject = `recovered-${randomUUID()}`;
  const accepted = await upload(
    page,
    csvSource(subject, "CSV after rejection", "125.00"),
    "csv"
  );
  expect(accepted.status()).toBe(200);
  const recovered = await inspect(page, subject);
  expect(recovered.claims).toHaveLength(1);
  await createWorld(page);
  await expect(
    page.getByLabel("Formato dos arquivos", { exact: true })
  ).toHaveValue("json");
  await page.getByRole("button", { exact: true, name: "Sair" }).click();
});

test("CSV-14 mixed real CSV and JSON preserve divergence correction history unknown undo and stale consent", async ({
  page,
}, info) => {
  const directory = await makeSessionDirectory();
  try {
    const { email, password } = await signUp(page);
    await createWorld(page);
    const subject = `mixed-${randomUUID()}`;
    const csv = await upload(
      page,
      csvSource(subject, "Fonte CSV", "100.00"),
      "csv"
    );
    expect(csv.status()).toBe(200);
    const json = await upload(
      page,
      jsonSource(subject, "Fonte JSON", "200.00"),
      "json"
    );
    expect(json.status()).toBe(200);
    expect(
      Object.hasOwn(
        Schema.decodeUnknownSync(ImportEvidence)(json.request().postDataJSON())
          .input,
        "format"
      )
    ).toBe(false);
    const jsonRequest = Schema.decodeUnknownSync(ImportEvidence)(
      json.request().postDataJSON()
    );
    const signedIn = await cli(
      baseURL,
      directory,
      ["sign-in", "--email", email],
      `${password}\n`
    );
    expect(signedIn.exitCode).toBe(0);
    const jsonReplay = await cli(
      baseURL,
      directory,
      [
        "import",
        "--world-id",
        jsonRequest.worldRef.worldId,
        "--operation-id",
        jsonRequest.operationId,
      ],
      jsonRequest.input.document
    );
    expect(jsonReplay.exitCode).toBe(0);
    expect(jsonReplay.stderr).toBe("");
    expect(
      Schema.decodeUnknownSync(EvidenceImported)(JSON.parse(jsonReplay.stdout))
    ).toEqual(Schema.decodeUnknownSync(EvidenceImported)(await json.json()));
    const original = await inspect(page, subject);
    expect(original.claims).toHaveLength(2);
    expect(original.contested).toBe(true);
    expect(original.verification).toBe("unverified");
    expect(
      new Set(original.claims.map((claim) => claim.source.namespace))
    ).toEqual(new Set(["csv-browser", "json-browser"]));
    await expect(page.getByText("100 BRL", { exact: true })).toBeVisible();
    await expect(page.getByText("200 BRL", { exact: true })).toBeVisible();
    const csvClaim = original.claims.find(
      (claim) => claim.source.namespace === "csv-browser"
    );
    if (csvClaim === undefined) {
      throw new Error("CSV import must produce its attributed claim");
    }
    await propose(page, csvClaim.claimRef);
    const answer = waitForOperation(page, "AnswerQuestion");
    await page
      .getByRole("button", { exact: true, name: "Confirmar decisão" })
      .click();
    const answerResponse = await answer;
    Schema.decodeUnknownSync(CorrectionApplied)(await answerResponse.json());
    const corrected = await inspect(page, subject);
    expect(corrected.claims).toEqual(original.claims);
    expect(corrected.scopedCorrections).toHaveLength(1);
    expect(await inspect(page, subject, original.frameRef)).toEqual(original);
    await inspect(page, subject);
    const undo = waitForOperation(page, "UndoCorrection");
    await page
      .getByRole("button", {
        exact: true,
        name: "Desfazer decisão deste período",
      })
      .click();
    const undoResponse = await undo;
    Schema.decodeUnknownSync(CorrectionUndone)(await undoResponse.json());
    const undone = await inspect(page, subject);
    expect(undone.scopedCorrections).toEqual([]);
    expect(await inspect(page, subject, corrected.frameRef)).toEqual(corrected);
    await inspect(page, subject);
    await propose(page, "unknown");
    const unknown = waitForOperation(page, "AnswerQuestion");
    await page
      .getByRole("button", { exact: true, name: "Não sei responder" })
      .click();
    const unknownResponse = await unknown;
    Schema.decodeUnknownSync(CorrectionApplied)(await unknownResponse.json());
    const unknownFrame = await inspect(page, subject);
    expect(unknownFrame.scopedCorrections.map((item) => item.choice)).toEqual([
      { _tag: "unknown" },
    ]);
    expect(unknownFrame.claims).toEqual(original.claims);
    await propose(page, csvClaim.claimRef);
    const concurrent = Schema.decodeSync(ImportEvidence)({
      input: {
        document: csvSource(subject, "Fonte CSV posterior", "300.00"),
        format: "d01.csv.v1",
      },
      operation: "ImportEvidence",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "d01.v1",
      worldRef: original.worldRef,
    });
    const changed = await page.request.post("/api/d01/execute", {
      data: concurrent,
      headers: { origin: baseURL },
    });
    expect(changed.status()).toBe(200);
    const stale = waitForOperation(page, "AnswerQuestion");
    await page
      .getByRole("button", { exact: true, name: "Confirmar decisão" })
      .click();
    const staleResponse = await stale;
    expect(await staleResponse.json()).toEqual({
      _tag: "Stale",
      code: "STALE",
    });
    await expect(
      page.getByRole("button", { exact: true, name: "Tentar novamente" })
    ).toHaveCount(0);
    const afterStale = await inspect(page, subject);
    expect(afterStale.scopedCorrections).toEqual(
      unknownFrame.scopedCorrections
    );
    await page.screenshot({
      fullPage: true,
      path: info.outputPath("mixed-sources-preserved.png"),
    });
    await page.getByRole("button", { exact: true, name: "Sair" }).click();
    const signedOut = await cli(baseURL, directory, ["sign-out"]);
    expect(signedOut.exitCode).toBe(0);
  } finally {
    await removeSessionDirectory(directory);
  }
});
