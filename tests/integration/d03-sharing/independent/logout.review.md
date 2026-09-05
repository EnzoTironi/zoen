# Independent EX12 logout timing review

Date: 2026-09-05. Reviewer checkout: `/Users/enzotironi/zoen-ex03`, HEAD `9af5eec`. Runtime supplied by root: existing `http://127.0.0.1:4316`, build `767f757`; no rebuild or product mutation. Root reported CI run `33992182271`, commit `40ab4db`, failing the login heading after about:blank/back.

## Finding

The existing test can navigate away after local clearing but before the real Better Auth sign-out completes. The login heading is not evidence that the provider has removed the session. A controlled browser experiment reproduced the same post-back failure without fabricated provider responses. Waiting for real sign-out HTTP 200 and real get-session null before navigating passed while preserving the post-back login/content-removal oracle.

`state.ts` logout sets refreshPaused, broadcasts, and invalidates with session null before launching BrowserApi.logout. `invalidate` aborts the active controller. The pagehide/visibility/dispose lifecycle can interrupt an unfinished request. The sibling receives an immediate clearing notice as well. `client.ts` requires HTTP 200 for logout, but the immediate login heading does not await this result.

## Experiments actually executed

- Natural timing, three serial repetitions of the existing two-tab logout/back sequence: 3 passed in 35.3 seconds.
- Held transport: one real ordinary account, actual imported evidence and rendered Frame, sibling opening the same World. Playwright route held sign-out before forwarding; it never fulfilled a request or supplied fake data. Both login headings were visible before forwarding. Navigation proceeded; the held route was released after about:blank. The unchanged post-back login assertion failed. Real get-session after back returned HTTP 200 with a session still present.
- Confirmed transport: no hold; real sign-out HTTP 200, then real get-session HTTP 200/null, then about:blank/back. Login remained visible; source and evidence absent. Passed in 11.2 seconds.
- The controlled comparison reported 1 failed and 1 passed in 28.5 seconds. Its held case is deliberately retained as failing diagnostic evidence, not a passing acceptance test.

Initial diagnostic copies stopped before logout because this review checkout had an obsolete second-user selector. These runs were interrupted and are not causal evidence. The independent experiment removed that unrelated second-user branch while retaining actual owner, evidence, sibling, logout and back behavior. No expected product result was changed to conceal a failure.

## Recorded timing

All offsets below are milliseconds since the experiment body began, after the normal signup-rate-limit wait.

| Event | Held transport | Confirmed transport |
| --- | ---: | ---: |
| Sign-out request | 1105 | 964 |
| Both login headings visible | 1108 | 969 |
| Sign-out HTTP 200 | not observed | 985 |
| Confirmed get-session null | not established | 992 |
| about:blank loaded | 1113 | 997 |
| Held request released | 1115 | n/a |
| Back completed | 1130 | 1010 |
| Real provider session after back | present, 1142 | null, 1015 |

The held case does not expose a requestfailed event for sign-out; the narrower direct evidence is absence of its response, successful route release after navigation, and the provider session remaining present. No HTTP 503 was observed in these authentication timelines. World, Frame and evidence remained absent after back in the held case, but the signed-in account controls returned. This is not proof of private payload leakage.

## Artifacts and scope

Diagnostic source was temporarily `apps/web/test/integration/d03-sharing/independent/logout.review.browser.spec.ts`. Its exact executed contents are preserved below, outside default test discovery. The temporary executable was removed after preservation, as requested by root.

Held timeline and screenshots: `/Users/enzotironi/zoen-ex03/test-results/acceptance-1788643306325/integration-d03-sharing-in-4fe47-rves-EX12-navigation-oracle-chromium/` (logout-timeline.json, test-failed-1.png, test-failed-2.png, error-context.md).

Confirmed timeline: `/Users/enzotironi/zoen-ex03/test-results/acceptance-1788643323190/integration-d03-sharing-in-2c09d-rves-EX12-navigation-oracle-chromium/logout-timeline.json`.

Command: `ZOEN_TEST_WEB_URL=http://127.0.0.1:4316 pnpm exec playwright test --config playwright.acceptance.config.ts apps/web/test/integration/d03-sharing/independent/logout.review.browser.spec.ts`, using installed Node 24.18.1. No mocks, privileged identity, fake service response, concurrent suite, server rebuild or product change.

Recommended test correction: register waitForResponse before clicking Sair, retain immediate content-clearing assertions, require sign-out 200 and get-session null, then perform the existing back-navigation assertions. This does not prove logout survives page closure before provider acknowledgement. A product requirement to guarantee that stronger behavior requires separate design and proof; this review does not claim it.

## Independent review of the witness correction

Reviewed root commit `477cedd8b6602b0b25a1cec462dcbc8975926f30`. The helper registers its response observer before clicking, requires the real POST sign-out HTTP 200 and real get-session HTTP 200/null, and both JSON/CSV consumers retain the post-back login and content-removal assertions. No product behavior changed and no oracle was relaxed. This is source review plus the independent causal experiment above, not a claim that this reviewer executed the updated twelve-test suite; root owns that run.

## Preserved diagnostic source

SHA-256 of the exact UTF-8 bytes inside the following fence (including its final newline, excluding fence delimiters): `1fcd971912320664c1a222ab63292b8a7aada23eecc50a62d54190a88adaa632`.

```text
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { WorldId } from "@zoen/contracts/d01/values";
import { Config, Effect, Schema } from "effect";


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

for (const mode of ["held-until-navigation", "confirmed-before-navigation"] as const) {
test(`Independent logout ${mode} preserves EX12 navigation oracle`, async ({
  page,
}, info) => {
  const started = Date.now();
  const timeline: Array<Record<string, unknown>> = [];
  const record = (event: string, data: Record<string, unknown> = {}) => {
    timeline.push({ elapsedMs: Date.now() - started, event, ...data });
  };
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/")) record("auth-request", { path: new URL(request.url()).pathname });
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/auth/")) record("auth-requestfailed", { path: new URL(request.url()).pathname, failure: request.failure()?.errorText });
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/auth/")) record("auth-response", { path: new URL(response.url()).pathname, status: response.status() });
  });
  try {
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

  const sibling = await page.context().newPage();
  await sibling.goto("/");
  await sibling.getByLabel("Abrir espaço pelo identificador").fill(world);
  await sibling
    .getByRole("button", { exact: true, name: "Abrir espaço" })
    .click();
  await inspect(sibling, subject);
  let releaseLogout = () => {};
  if (mode === "held-until-navigation") {
    const gate = new Promise<void>((resolve) => { releaseLogout = resolve; });
    await page.route("**/api/auth/sign-out", async (route) => {
      record("sign-out-held-before-provider");
      await gate;
      try { await route.continue(); record("held-sign-out-released"); }
      catch { record("held-sign-out-already-cancelled"); }
    });
  }
  const logoutResponse = mode === "confirmed-before-navigation"
    ? page.waitForResponse((response) => response.url().endsWith("/api/auth/sign-out"))
    : null;
  record("logout-click-start");
  await page.getByRole("button", { exact: true, name: "Sair" }).click();
  record("logout-click-done");
  await expect(
    page.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  await expect(sibling.getByText(firstLabel, { exact: true })).toHaveCount(0);
  await expect(
    sibling.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  record("both-login-headings-visible");
  if (logoutResponse !== null) {
    const response = await logoutResponse;
    expect(response.status()).toBe(200);
    const session = await page.request.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    expect(await session.json()).toBeNull();
    record("provider-logout-confirmed-and-session-null");
  }
  await page.goto("about:blank");
  record("about-blank-loaded");
  releaseLogout();
  await page.goBack();
  record("go-back-complete");
  const afterBack = await page.request.get("/api/auth/get-session");
  record("after-back-provider-session", { status: afterBack.status(), sessionPresent: (await afterBack.json()) !== null });
  await expect(
    page.getByRole("heading", { name: "Entre para continuar" })
  ).toBeVisible();
  await expect(page.getByText(firstLabel, { exact: true })).toHaveCount(0);
  await expect(page.locator("blockquote")).toHaveCount(0);
  await sibling.close();
  } finally {
    record("final-ui", { url: page.url(), text: await page.locator("body").innerText().catch(() => "unavailable") });
    const timelinePath = info.outputPath("logout-timeline.json");
    await writeFile(timelinePath, JSON.stringify(timeline, null, 2));
    await info.attach("logout-timeline.json", { path: timelinePath, contentType: "application/json" });
  }
});


}
```
