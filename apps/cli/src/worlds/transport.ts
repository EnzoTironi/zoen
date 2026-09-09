import { Effect, Redacted } from "effect";
import { Cookies, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { CliFailure } from "./output.js";

export { execute } from "@zoen/application-client/execute";

export const authenticate = Effect.fn(function* authenticate(
  baseUrl: string,
  action: "sign-up" | "sign-in",
  email: string,
  password: Redacted.Redacted,
  name: string
) {
  const response = yield* HttpClientRequest.post(
    `${baseUrl}/api/auth/${action}/email`
  ).pipe(
    HttpClientRequest.setHeader("Origin", baseUrl),
    HttpClientRequest.bodyJsonUnsafe({
      email,
      password: Redacted.value(password),
      ...(action === "sign-up" ? { name } : {}),
    }),
    HttpClient.execute,
    Effect.mapError(() => new CliFailure("CLI_TRANSPORT"))
  );
  if (response.status < 200 || response.status >= 300) {
    return yield* new CliFailure("CLI_AUTH");
  }
  const expected = `${baseUrl.startsWith("https:") ? "__Secure-" : ""}zoen-worlds.session_token`;
  if ((response.cookies.cookies[expected]?.value ?? "") === "") {
    return yield* new CliFailure("CLI_AUTH");
  }
  return Redacted.make(Cookies.toCookieHeader(response.cookies));
});

export const signOut = Effect.fn(function* signOut(
  baseUrl: string,
  cookie: Redacted.Redacted
) {
  const response = yield* HttpClientRequest.post(
    `${baseUrl}/api/auth/sign-out`
  ).pipe(
    HttpClientRequest.setHeader("Origin", baseUrl),
    HttpClientRequest.setHeader("Cookie", Redacted.value(cookie)),
    HttpClientRequest.bodyJsonUnsafe({}),
    HttpClient.execute,
    Effect.mapError(() => new CliFailure("CLI_TRANSPORT"))
  );
  if (response.status < 200 || response.status >= 300) {
    return yield* new CliFailure("CLI_AUTH");
  }
  return { _tag: "SignedOut" } as const;
});
