import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** The login form clears locally before the provider has confirmed sign-out. */
// oxlint-disable-next-line effecttsgo/async-function -- This helper sequences the native Playwright Page and response promises.
export const confirmedLogout = async (page: Page) => {
  const response = page.waitForResponse(
    (result) =>
      result.url().endsWith("/api/auth/sign-out") &&
      result.request().method() === "POST"
  );
  await page.getByRole("button", { exact: true, name: "Sair" }).click();
  const signedOut = await response;
  expect(signedOut.status()).toBe(200);
  const session = await page.request.get("/api/auth/get-session");
  expect(session.status()).toBe(200);
  expect(await session.json()).toBeNull();
};
