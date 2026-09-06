import { InvalidInput } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { SubjectIdentityRequest } from "@zoen/contracts/subject-identity/operations";
import { Effect, Schema } from "effect";

import { parseJsonBytes } from "../../values/json.js";

export const parseSubjectIdentityBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, D01_LIMITS.envelopeBytes).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(SubjectIdentityRequest)),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );
