import { randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { SemanticRequest, WorldCreated } from "@zoen/contracts/d01/operations";
import { Config, Deferred, Effect, Schema } from "effect";

const baseURL = Effect.runSync(Config.string("ZOEN_TEST_SHARING_WEB_URL"));
const d01 = { purpose: "personal-records", schemaVersion: "d01.v1" };
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
  const response = await api.post(`${baseURL}${path}`, {
    data,
    headers: { origin: baseURL },
  });
  expect(response.status()).toBe(200);
  return Schema.decodeUnknownSync(Schema.Unknown)(await response.json());
};
const operation = (page: Page, name: string) =>
  page.waitForResponse((response) => {
    if (
      !response.url().includes("/api/d01/") &&
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
      await send(page.request, "/api/d01/execute", {
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
      schemaVersion: "d01.v1",
      source: {
        externalId: randomUUID(),
        label: sourceLabel,
        namespace: "independent-web",
        revision: "1",
      },
    });
    await send(page.request, "/api/d01/execute", {
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
    await reader.route("**/api/d01/execute", async (route) => {
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
