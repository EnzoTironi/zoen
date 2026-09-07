import { ApplicationApi } from "@zoen/contracts/d01/api";
import type { SemanticRequest } from "@zoen/contracts/d01/operations";
import { Effect, Redacted } from "effect";
import { Cookies, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { CliFailure } from "./output.js";

export const execute = Effect.fn(function* execute(
  baseUrl: string,
  cookie: Redacted.Redacted,
  payload: SemanticRequest
) {
  const client = yield* HttpApiClient.make(ApplicationApi, {
    baseUrl,
    transformClient: HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.setHeader("Origin", baseUrl),
        HttpClientRequest.setHeader("Cookie", Redacted.value(cookie))
      )
    ),
  });
  switch (payload.operation) {
    case "CreatePersonalWorld": {
      return yield* client.d01.execute({ payload });
    }
    case "ImportEvidence": {
      return yield* client.d01.execute({ payload });
    }
    case "Inspect": {
      return yield* client.d01.execute({ payload });
    }
    case "OpenEvidence": {
      return yield* client.d01.execute({ payload });
    }
    case "ProposeCorrection": {
      return yield* client.corrections.execute({ payload });
    }
    case "AnswerQuestion": {
      return yield* client.corrections.execute({ payload });
    }
    case "UndoCorrection": {
      return yield* client.corrections.execute({ payload });
    }
    case "GrantWorldReadAccess": {
      return yield* client.sharing.execute({ payload });
    }
    case "InspectWorldAccess": {
      return yield* client.sharing.execute({ payload });
    }
    case "RevokeWorldReadAccess": {
      return yield* client.sharing.execute({ payload });
    }
    case "InspectSubjectIdentity": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "InspectIdentityRecovery": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "ProposeIdentityResolution": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "ProposeIdentitySplit": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "ProposeIdentityUndo": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "ResolveIdentity": {
      return yield* client.subjectIdentity.execute({ payload });
    }
    case "InspectWorldErasure": {
      return yield* client.erasure.execute({ payload });
    }
    case "RequestWorldErasure": {
      return yield* client.erasure.execute({ payload });
    }
    case "AcceptConversationTurn": {
      return yield* client.eve.execute({ payload });
    }
    case "CancelConversationTurn": {
      return yield* client.eve.execute({ payload });
    }
    case "RecoverConversationJournal": {
      return yield* client.eve.execute({ payload });
    }
    case "SettleConversationMessage": {
      return yield* client.eve.execute({ payload });
    }
    default: {
      return yield* new CliFailure("CLI_INPUT");
    }
  }
});

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
  const expected = `${baseUrl.startsWith("https:") ? "__Secure-" : ""}zoen-d01.session_token`;
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
