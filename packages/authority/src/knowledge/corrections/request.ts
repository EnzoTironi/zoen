import { InvalidInput } from "@zoen/contracts/d01/errors";
import { CorrectionRequest } from "@zoen/contracts/d01/operations";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import { parseJsonBytes } from "../../values/json.js";

export const parseCorrectionBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, D01_LIMITS.envelopeBytes).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(CorrectionRequest)),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );
