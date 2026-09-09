import { ApplicationApi } from "@zoen/contracts/worlds/api";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

/** Typed ApplicationApi client — host supplies auth (Cookie header or Fetch credentials). */
export type ApplicationApiClient = HttpApiClient.ForApi<typeof ApplicationApi>;

/**
 * Shared SemanticRequest → ApplicationApi group routing.
 * Browser-safe: no session.json, no Cookie header injection.
 * Web uses Fetch credentials; CLI/MCP wrap with cookie-authenticated execute below.
 */
export const routeExecute = Effect.fn(function* routeExecute(
  client: ApplicationApiClient,
  payload: SemanticRequest
) {
  switch (payload.operation) {
    case "CreatePersonalWorld": {
      return yield* client.worlds.execute({ payload });
    }
    case "ImportEvidence": {
      return yield* client.worlds.execute({ payload });
    }
    case "Inspect": {
      return yield* client.worlds.execute({ payload });
    }
    case "OpenEvidence": {
      return yield* client.worlds.execute({ payload });
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
    case "PurgeWorldContent": {
      return yield* client.erasure.execute({ payload });
    }
    case "RequestWorldErasure": {
      return yield* client.erasure.execute({ payload });
    }
    default: {
      const _exhaustive: never = payload;
      void _exhaustive;
      return yield* Effect.die("unreachable SemanticRequest operation");
    }
  }
});

/**
 * Cookie-authenticated ApplicationApi routing shared by CLI and MCP.
 * Auth (sign-in / sign-out) stays on the CLI; MCP only reuses session.json.
 * Web must not use this — browser auth is HttpOnly cookie via Fetch credentials.
 */
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
  return yield* routeExecute(client, payload);
});
