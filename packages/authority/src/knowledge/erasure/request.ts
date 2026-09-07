import { WorldErasureRequest } from "@zoen/contracts/erasure/operations";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { parseJsonBytes } from "../../values/json.js";

export const parseErasureBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, D01_LIMITS.envelopeBytes).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(WorldErasureRequest)),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );
