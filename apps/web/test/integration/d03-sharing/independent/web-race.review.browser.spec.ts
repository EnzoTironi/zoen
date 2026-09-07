import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  SemanticRequest,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Config, Deferred, Effect, Schema } from "effect";

const baseURL = Effect.runSync(Config.string("ZOEN_TEST_SHARING_WEB_URL"));
const d01 = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
};
const gate = () => {
  const deferred = Deferred.makeUnsafe<null>();
  return {
    promise: Effect.runPromise(Deferred.await(deferred)),
    release: () => Effect.runSync(Deferred.succeed(deferred, null)),
  };
};
const signup = async (api: APIRequestContext) => {
  const response = await api.post(`${baseURL}/api/auth/sign-up/email`, {
    data: {
      email: `${randomUUID()}@example.test`,
      name: "Independent web review",
      password: randomBytes(24).toString("base64url"),
    },
    headers: { origin: baseURL },
  });
  expect(response.status()).toBe(200);
  return Schema.decodeUnknownSync(
    Schema.Struct({
      user: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
    })
  )(await response.json()).user.id;
};
const send = async (api: APIRequestContext, path: string, data: unknown) => {
  // Membership mutations refuse while a disclosure permit is still pending (HTTP 503
  // Unavailable). Product semantics reuse the same operationId/intention after ACK.
  const post = () =>
    api.post(`${baseURL}${path}`, {
      data,
      headers: { origin: baseURL },
    });
  const retryUnavailable = async (
    response: Awaited<ReturnType<typeof post>>,
    attempt: number
  ): Promise<Awaited<ReturnType<typeof post>>> => {
    if (response.status() !== 503 || attempt >= 10) {
      return response;
    }
    expect(await response.json()).toStrictEqual({
      _tag: "Unavailable",
      code: "UNAVAILABLE",
    });
    await setTimeout(25 * (attempt + 1));
    return await retryUnavailable(await post(), attempt + 1);
  };
  const response = await retryUnavailable(await post(), 0);
  expect(response.status()).toBe(200);
  return Schema.decodeUnknownSync(Schema.Unknown)(await response.json());
};
const operation = (page: Page, name: string) =>
  page.waitForResponse((response) => {
    if (
      !response.url().includes("/api/worlds/") &&
      !response.url().endsWith("/api/d03/sharing")
    ) {
      return false;
    }
    return (
      Schema.decodeUnknownSync(SemanticRequest)(
        response.request().postDataJSON()
      ).operation === name
    );
  });

test.use({ baseURL });
test.setTimeout(40_000);
// Preserve the real provider signup guard across serial scenarios.
test.beforeEach(async () => {
  await setTimeout(10_100);
});
test("independent EX23 denial during another read clears data immediately and ignores the delayed real success", async ({
  page,
  browser,
}, testInfo) => {
  const readerContext = await browser.newContext({ baseURL });
  const allowAccess = gate();
  const allowEvidence = gate();
  try {
    await signup(page.request);
    const principalRef = await signup(readerContext.request);
    const created = Schema.decodeUnknownSync(WorldCreated)(
      await send(page.request, "/api/worlds/execute", {
        ...d01,
        input: {},
        operation: "CreatePersonalWorld",
        operationId: randomUUID(),
      })
    );
    const { worldRef } = created;
    const subject = `denial-race-${randomUUID()}`;
    const sourceLabel = `Private race source ${randomUUID()}`;
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
          value: { _tag: "Known", amount: "712.45", currency: "BRL" },
        },
      ],
      schemaVersion: "worlds.v1",
      source: {
        externalId: randomUUID(),
        label: sourceLabel,
        namespace: "independent-web",
        revision: "1",
      },
    });
    await send(page.request, "/api/worlds/execute", {
      ...d01,
      input: { document },
      operation: "ImportEvidence",
      operationId: randomUUID(),
      worldRef,
    });
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: null, principalRef },
      operation: "GrantWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    const reader = await readerContext.newPage();
    await reader.goto("/");
    await reader
      .getByLabel("Abrir espaço pelo identificador", { exact: true })
      .fill(worldRef.worldId);
    await reader
      .getByRole("button", { exact: true, name: "Abrir espaço" })
      .click();
    await expect(
      reader.getByText("Seu papel: leitor", { exact: true })
    ).toBeVisible();
    await reader
      .getByLabel("Identificador da obrigação", { exact: true })
      .fill(subject);
    const inspected = operation(reader, "Inspect");
    await reader
      .getByRole("button", { exact: true, name: "Consultar fontes" })
      .click();
    const inspectedResponse = await inspected;
    expect(inspectedResponse.status()).toBe(200);
    await expect(
      reader.getByRole("button", {
        exact: true,
        name: `Inspecionar evidência de ${sourceLabel}`,
      })
    ).toBeVisible();

    const accessWaiting = gate();
    const evidenceCaptured = gate();
    const evidenceDelivered = gate();
    const events: string[] = [];
    let heldAccess = false;
    await reader.route("**/api/d03/sharing", async (route) => {
      const request = Schema.decodeUnknownSync(SemanticRequest)(
        route.request().postDataJSON()
      );
      if (
        !heldAccess &&
        request.operation === "InspectWorldAccess" &&
        request.input.principalRef === null
      ) {
        heldAccess = true;
        events.push("refresh.request.held");
        accessWaiting.release();
        await allowAccess.promise;
      }
      await route.continue();
    });
    await reader.route("**/api/worlds/execute", async (route) => {
      const request = Schema.decodeUnknownSync(SemanticRequest)(
        route.request().postDataJSON()
      );
      if (request.operation !== "OpenEvidence") {
        await route.continue();
        return;
      }
      // Obtain the real server response; buffer only its delivery, preserving status, headers and body.
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        _tag: "EvidenceOpened",
        document,
      });
      events.push("real.evidence.200.captured");
      evidenceCaptured.release();
      await allowEvidence.promise;
      try {
        await route.fulfill({ response });
      } catch {
        /* Context invalidation may abort this actual transport. */
      }
      events.push("delayed.evidence.delivery.finished");
      evidenceDelivered.release();
    });
    await accessWaiting.promise;
    await reader
      .getByRole("button", {
        exact: true,
        name: `Inspecionar evidência de ${sourceLabel}`,
      })
      .click();
    await evidenceCaptured.promise;
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: "0", principalRef },
      operation: "RevokeWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    events.push("real.revoke.200");
    const denied = operation(reader, "InspectWorldAccess");
    allowAccess.release();
    const denial = await denied;
    expect(denial.status()).toBe(404);
    expect(await denial.json()).toStrictEqual({
      _tag: "NotFoundOrDenied",
      code: "NOT_FOUND_OR_DENIED",
    });
    events.push("real.denial.delivered.while.evidence.busy");
    await expect
      .soft(
        reader.locator(".d01-world-id"),
        "Observed denial must immediately invalidate the current World, even while another request is busy"
      )
      .toHaveCount(0, { timeout: 1000 });
    allowEvidence.release();
    await evidenceDelivered.promise;
    await reader.waitForFunction(
      () =>
        globalThis.document.querySelector(".d01-world-id") === null ||
        globalThis.document.querySelector("blockquote") !== null
    );
    await expect
      .soft(
        reader.locator("blockquote"),
        "An earlier real success must not repopulate evidence after denial"
      )
      .toHaveCount(0, { timeout: 1000 });
    await expect
      .soft(reader.locator(".d01-world-id"))
      .toHaveCount(0, { timeout: 1000 });
    await testInfo.attach("real-response-order", {
      body: JSON.stringify({ events, sourceLabel, worldRef }, null, 2),
      contentType: "application/json",
    });
  } finally {
    allowAccess.release();
    allowEvidence.release();
    await readerContext.close();
  }
});

test("independent EX23 Stale requires a new confirmation and a replayed grant receipt never claims current access", async ({
  page,
  browser,
}, testInfo) => {
  const recipient = await browser.newContext({ baseURL });
  const deliverReceipt = gate();
  try {
    await signup(page.request);
    const principalRef = await signup(recipient.request);
    const { worldRef } = Schema.decodeUnknownSync(WorldCreated)(
      await send(page.request, "/api/worlds/execute", {
        ...d01,
        input: {},
        operation: "CreatePersonalWorld",
        operationId: randomUUID(),
      })
    );
    await page.goto("/");
    await page
      .getByLabel("Abrir espaço pelo identificador", { exact: true })
      .fill(worldRef.worldId);
    await page
      .getByRole("button", { exact: true, name: "Abrir espaço" })
      .click();
    await expect(
      page.getByText("Seu papel: proprietário", { exact: true })
    ).toBeVisible();
    const inspectRecipient = async () => {
      await page
        .getByLabel("Identificador exato do destinatário", { exact: true })
        .fill(principalRef);
      await page
        .getByRole("button", { name: "Consultar acesso do destinatário" })
        .click();
      await expect(
        page.getByRole("region", { exact: true, name: "Acesso consultado" })
      ).toContainText(principalRef);
    };
    await inspectRecipient();
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("sem membership");
    await page
      .getByRole("button", { name: "Revisar concessão de leitura" })
      .click();
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: null, principalRef },
      operation: "GrantWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    const stale = operation(page, "GrantWorldReadAccess");
    await page
      .getByRole("button", { name: "Conceder leitura de todo o espaço" })
      .click();
    const staleResponse = await stale;
    expect(staleResponse.status()).toBe(409);
    expect(await staleResponse.json()).toMatchObject({ _tag: "Stale" });
    const staleRequest = Schema.decodeUnknownSync(SemanticRequest)(
      staleResponse.request().postDataJSON()
    );
    if (staleRequest.operation !== "GrantWorldReadAccess") {
      throw new Error("Expected actual stale grant request");
    }
    expect(staleRequest.input.expectedRevision).toBe(null);
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Confirmar alteração de acesso" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Tentar novamente" })
    ).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText(
      "Consulte o destinatário novamente"
    );
    await inspectRecipient();
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("ativo · revisão 0");
    await expect(
      page.getByRole("region", { name: "Confirmar alteração de acesso" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Revisar concessão de leitura" })
      .click();
    const receiptCaptured = gate();
    let confirmedRequest: SemanticRequest | null = null;
    let originalReceipt: unknown = null;
    await page.route("**/api/d03/sharing", async (route) => {
      const request = Schema.decodeUnknownSync(SemanticRequest)(
        route.request().postDataJSON()
      );
      if (request.operation !== "GrantWorldReadAccess") {
        await route.continue();
        return;
      }
      confirmedRequest = request;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      originalReceipt = Schema.decodeUnknownSync(Schema.Unknown)(
        await response.json()
      );
      receiptCaptured.release();
      await deliverReceipt.promise;
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Conceder leitura de todo o espaço" })
      .click();
    await receiptCaptured.promise;
    const reconfirmed =
      Schema.decodeUnknownSync(SemanticRequest)(confirmedRequest);
    if (reconfirmed.operation !== "GrantWorldReadAccess") {
      throw new Error("Expected actual reconfirmed grant request");
    }
    expect(reconfirmed.operationId).not.toBe(staleRequest.operationId);
    expect(reconfirmed.input).toStrictEqual({
      expectedRevision: "0",
      principalRef,
    });
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: "0", principalRef },
      operation: "RevokeWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    // The same real request replays after revoke; the result remains the original historical receipt.
    const replay = await send(page.request, "/api/d03/sharing", reconfirmed);
    expect(replay).toStrictEqual(originalReceipt);
    const current = await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { principalRef },
      operation: "InspectWorldAccess",
      worldRef,
    });
    expect(current).toMatchObject({
      _tag: "WorldAccessInspected",
      membership: { revision: "1", state: "revoked" },
    });
    const inspectedCurrent = page.waitForResponse((response) => {
      if (!response.url().endsWith("/api/d03/sharing")) {
        return false;
      }
      const request = Schema.decodeUnknownSync(SemanticRequest)(
        response.request().postDataJSON()
      );
      return (
        request.operation === "InspectWorldAccess" &&
        request.input.principalRef === principalRef
      );
    });
    deliverReceipt.release();
    const currentResponse = await inspectedCurrent;
    expect(await currentResponse.json()).toStrictEqual(current);
    await expect(
      page.getByRole("region", { exact: true, name: "Acesso consultado" })
    ).toContainText("leitor · revogado · revisão 1");
    const panel = page.getByRole("region", {
      exact: true,
      name: "Compartilhar leitura",
    });
    await expect(panel).toContainText("Recibo histórico");
    await expect(panel).toContainText("não comprova acesso atual");
    await expect(panel).not.toContainText("leitor · ativo · revisão 0");
    await testInfo.attach("real-stale-replay", {
      body: JSON.stringify(
        { current, originalReceipt, reconfirmed, staleRequest },
        null,
        2
      ),
      contentType: "application/json",
    });
  } finally {
    deliverReceipt.release();
    await recipient.close();
  }
});

test("independent EX23 denial of a prior retained Frame clears a newer Frame in the same World", async ({
  page,
  browser,
}, testInfo) => {
  const readerContext = await browser.newContext({ baseURL });
  const releaseHistory = gate();
  try {
    await signup(page.request);
    const principalRef = await signup(readerContext.request);
    const created = Schema.decodeUnknownSync(WorldCreated)(
      await send(page.request, "/api/worlds/execute", {
        ...d01,
        input: {},
        operation: "CreatePersonalWorld",
        operationId: randomUUID(),
      })
    );
    const { worldRef } = created;
    const subject = `denial-race-${randomUUID()}`;
    const sourceLabel = `Private race source ${randomUUID()}`;
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
          value: { _tag: "Known", amount: "712.45", currency: "BRL" },
        },
      ],
      schemaVersion: "worlds.v1",
      source: {
        externalId: randomUUID(),
        label: sourceLabel,
        namespace: "independent-web",
        revision: "1",
      },
    });
    await send(page.request, "/api/worlds/execute", {
      ...d01,
      input: { document },
      operation: "ImportEvidence",
      operationId: randomUUID(),
      worldRef,
    });
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: null, principalRef },
      operation: "GrantWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    const reader = await readerContext.newPage();
    await reader.goto("/");
    await reader
      .getByLabel("Abrir espaço pelo identificador", { exact: true })
      .fill(worldRef.worldId);
    await reader
      .getByRole("button", { exact: true, name: "Abrir espaço" })
      .click();
    await expect(
      reader.getByText("Seu papel: leitor", { exact: true })
    ).toBeVisible();
    await reader
      .getByLabel("Identificador da obrigação", { exact: true })
      .fill(subject);
    const inspected = operation(reader, "Inspect");
    await reader
      .getByRole("button", { exact: true, name: "Consultar fontes" })
      .click();
    const inspectedResponse = await inspected;
    expect(inspectedResponse.status()).toBe(200);
    await expect(
      reader.getByRole("button", {
        exact: true,
        name: `Inspecionar evidência de ${sourceLabel}`,
      })
    ).toBeVisible();

    const waiting = gate();
    let heldHistory = false;
    let priorFrame: string | null = null;
    await reader.route("**/api/worlds/execute", async (route) => {
      const request = Schema.decodeUnknownSync(SemanticRequest)(
        route.request().postDataJSON()
      );
      if (
        !heldHistory &&
        request.operation === "Inspect" &&
        request.input.atFrame !== null
      ) {
        heldHistory = true;
        priorFrame = request.input.atFrame;
        waiting.release();
        await releaseHistory.promise;
      }
      await route.continue();
    });
    // Ordinary periodic refresh first confirms membership, then revalidates the retained Frame.
    await waiting.promise;
    const fresh = operation(reader, "Inspect");
    await reader
      .getByRole("button", { exact: true, name: "Consultar fontes" })
      .click();
    const freshResponse = await fresh;
    expect(freshResponse.status()).toBe(200);
    const newest = Schema.decodeUnknownSync(
      Schema.Struct({ frame: Schema.Struct({ frameRef: Schema.String }) })
    )(await freshResponse.json());
    expect(newest.frame.frameRef).not.toBe(priorFrame);
    await expect(
      reader.getByText(`Leitura ${newest.frame.frameRef}`, { exact: true })
    ).toBeVisible();
    await send(page.request, "/api/d03/sharing", {
      ...sharing,
      input: { expectedRevision: "0", principalRef },
      operation: "RevokeWorldReadAccess",
      operationId: randomUUID(),
      worldRef,
    });
    const denied = operation(reader, "Inspect");
    releaseHistory.release();
    const denial = await denied;
    expect(denial.status()).toBe(404);
    expect(await denial.json()).toStrictEqual({
      _tag: "NotFoundOrDenied",
      code: "NOT_FOUND_OR_DENIED",
    });
    await expect
      .soft(
        reader.locator(".d01-world-id"),
        "A real denial in the same World and epoch must invalidate even when the displayed Frame changed"
      )
      .toHaveCount(0, { timeout: 1000 });
    await expect
      .soft(
        reader.getByRole("button", {
          exact: true,
          name: `Inspecionar evidência de ${sourceLabel}`,
        })
      )
      .toHaveCount(0, { timeout: 1000 });
    await testInfo.attach("real-frame-denial-order", {
      body: JSON.stringify(
        { newest: newest.frame.frameRef, priorFrame, worldRef },
        null,
        2
      ),
      contentType: "application/json",
    });
  } finally {
    releaseHistory.release();
    await readerContext.close();
  }
});
