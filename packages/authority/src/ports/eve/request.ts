import { EveConversationRequest } from "@zoen/contracts/eve/operations";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import { WorldLimits } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { parseJsonBytes } from "../../values/json.js";

export const parseEveBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, WorldLimits.envelopeBytes).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(EveConversationRequest)),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );
