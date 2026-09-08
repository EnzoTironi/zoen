import { InvalidInput } from "@zoen/contracts/worlds/errors";
import { CorrectionRequest } from "@zoen/contracts/worlds/operations";
import { WorldLimits } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { parseJsonBytes } from "../../values/json.js";

export const parseCorrectionBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, WorldLimits.envelopeBytes).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(CorrectionRequest)),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );
