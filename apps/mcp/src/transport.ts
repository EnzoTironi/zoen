import { ApplicationApi } from "@zoen/contracts/worlds/api";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { McpFailure } from "./output.js";

/** Same ApplicationApi routes as CLI — policy + receipts stay on the server. */
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
      return yield* new McpFailure("MCP_INPUT");
    }
  }
});
