import { InvalidInput } from "@zoen/contracts/d01/errors";
import { ImportEvidence } from "@zoen/contracts/d01/operations";
import { Effect, Schema } from "effect";

import { parseCsvText } from "./csv.js";
import { parseDocumentText } from "./json.js";

/** Shared by admission and intent hashing; the original request is never rewritten. */
export const parseImportDocument = Effect.fn("values.parseImportDocument")(
  function* parseImportDocument(input: unknown) {
    const decoded = yield* Schema.decodeUnknownEffect(
      ImportEvidence.fields.input
    )(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const document = yield* "format" in decoded
      ? parseCsvText(decoded.document)
      : parseDocumentText(decoded.document);
    if (
      new Set(document.records.map((record) => record.externalId)).size !==
      document.records.length
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    return document;
  }
);
