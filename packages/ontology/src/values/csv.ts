import { InvalidInput, QuotaExceeded } from "@zoen/contracts/worlds/errors";
import { decodeImportDocument } from "@zoen/contracts/worlds/evidence";
import { WorldLimits } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { validUnicode } from "./json.js";

const header =
  "schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo";
const invalid = (): never => {
  throw new InvalidInput({ code: "INVALID_INPUT" });
};
const fieldCount = 14;
// Label is the largest textual field in the published ImportDocument schema.
const maximumFieldLength = 200;

/** Parse only the frozen CSV representation; semantic fields are decoded by their shared schemas. */
const rowsFromText = (text: string) => {
  if (!text.startsWith(header) || !validUnicode(text)) {
    return invalid();
  }
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 32 && point !== 9 && point !== 10 && point !== 13) {
      return invalid();
    }
  }
  let offset = header.length;
  const separator = text.startsWith("\r\n", offset) ? "\r\n" : "\n";
  if (!text.startsWith(separator, offset)) {
    return invalid();
  }
  offset += separator.length;
  const rows: string[][] = [];
  const field = () => {
    let value = "";
    const append = (character: string) => {
      value += character;
      if (value.length > maximumFieldLength) {
        invalid();
      }
    };
    if (text[offset] === '"') {
      offset += 1;
      let closed = false;
      while (offset < text.length) {
        const character = text[offset];
        offset += 1;
        if (character === '"') {
          if (text[offset] === '"') {
            append('"');
            offset += 1;
          } else {
            closed = true;
            break;
          }
        } else if (character === "\r") {
          if (text[offset] !== "\n") {
            return invalid();
          }
          append("\r\n");
          offset += 1;
        } else if (character !== undefined) {
          append(character);
        }
      }
      if (!closed) {
        return invalid();
      }
    } else {
      while (offset < text.length) {
        const character = text[offset];
        if (character === "," || character === "\r" || character === "\n") {
          break;
        }
        if (character === '"' || character === undefined) {
          return invalid();
        }
        append(character);
        offset += 1;
      }
    }
    return value;
  };
  while (offset < text.length) {
    if (rows.length >= WorldLimits.records) {
      return invalid();
    }
    const row: string[] = [];
    for (let column = 0; column < fieldCount; column += 1) {
      row.push(field());
      if (column < fieldCount - 1) {
        if (text[offset] !== ",") {
          return invalid();
        }
        offset += 1;
      }
    }
    rows.push(row);
    if (offset < text.length) {
      if (!text.startsWith(separator, offset)) {
        return invalid();
      }
      offset += separator.length;
    }
  }
  if (rows.length === 0) {
    return invalid();
  }
  return rows;
};

const projectRows = (rows: readonly (readonly string[])[]) => {
  let source:
    | {
        namespace: string | undefined;
        externalId: string | undefined;
        revision: string | undefined;
        label: string | undefined;
      }
    | undefined;
  const records = rows.map((row) => {
    const [
      version,
      namespace,
      externalId,
      revision,
      label,
      recordId,
      subjectKey,
      predicate,
      valueTag,
      amount,
      currency,
      timeTag,
      from,
      to,
    ] = row;
    if (version !== "worlds.csv.v1") {
      return invalid();
    }
    if (source === undefined) {
      source = { externalId, label, namespace, revision };
    } else if (
      source.namespace !== namespace ||
      source.externalId !== externalId ||
      source.revision !== revision ||
      source.label !== label
    ) {
      return invalid();
    }
    if (
      valueTag !== "Known" &&
      !(valueTag === "Unknown" && amount === "" && currency === "")
    ) {
      return invalid();
    }
    if (
      timeTag !== "DateInterval" &&
      !(timeTag === "Unknown" && from === "" && to === "")
    ) {
      return invalid();
    }
    return {
      externalId: recordId,
      predicate,
      subjectKey,
      validTime:
        timeTag === "DateInterval"
          ? { _tag: "DateInterval", from, to }
          : { _tag: "Unknown" },
      value:
        valueTag === "Known"
          ? { _tag: "Known", amount, currency }
          : { _tag: "Unknown" },
    };
  });
  return { records, schemaVersion: "worlds.v1", source };
};

export const parseCsvBytes = (bytes: Uint8Array) =>
  Effect.try({
    catch: (error) =>
      Schema.is(QuotaExceeded)(error)
        ? error
        : new InvalidInput({ code: "INVALID_INPUT" }),
    try: () => {
      if (bytes.byteLength > WorldLimits.documentBytes) {
        throw new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
      }
      const text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      return projectRows(rowsFromText(text));
    },
  }).pipe(
    Effect.flatMap(decodeImportDocument),
    Effect.catchTag(
      "SchemaError",
      () => new InvalidInput({ code: "INVALID_INPUT" })
    )
  );

/** Validate UTF-16 before encoding can replace a lone surrogate. */
export const parseCsvText = (text: string) =>
  validUnicode(text)
    ? parseCsvBytes(new TextEncoder().encode(text))
    : Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }));
