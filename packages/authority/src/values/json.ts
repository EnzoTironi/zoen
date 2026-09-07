import { InvalidInput, QuotaExceeded } from "@zoen/contracts/worlds/errors";
import { decodeImportDocument } from "@zoen/contracts/worlds/evidence";
import { decodeD01Request } from "@zoen/contracts/worlds/operations";
import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

export type JsonValue =
  | null
  | boolean
  | string
  | number
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** D01 excludes NUL for PostgreSQL text; I-JSON excludes noncharacters and surrogates. */
export const validUnicode = (value: string): boolean => {
  if (!value.isWellFormed()) {
    return false;
  }
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (
      point === 0 ||
      (point >= 0xfd_d0 && point <= 0xfd_ef) ||
      point % 65_536 >= 65_534
    ) {
      return false;
    }
  }
  return true;
};

const invalid = (): never => {
  throw new InvalidInput({ code: "INVALID_INPUT" });
};
const quota = (): never => {
  throw new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
};

/** D01 deliberately permits only safe integer JSON numbers; amounts are strings. */
export const parseJsonBytes = (bytes: Uint8Array, byteLimit: number) =>
  Effect.try({
    catch: (error) =>
      Schema.is(QuotaExceeded)(error)
        ? error
        : new InvalidInput({ code: "INVALID_INPUT" }),
    try: (): JsonValue => {
      if (
        !Number.isSafeInteger(byteLimit) ||
        byteLimit < 1 ||
        byteLimit > D01_LIMITS.envelopeBytes
      ) {
        invalid();
      }
      if (bytes.byteLength > byteLimit) {
        quota();
      }
      const text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      let offset = 0;
      let entries = 0;
      const take = (): string => {
        const character = text.charAt(offset);
        offset += 1;
        return character;
      };
      const whitespace = (): void => {
        while (
          offset < text.length &&
          /[\u0020\t\r\n]/u.test(text.charAt(offset))
        ) {
          offset += 1;
        }
      };
      const count = (): void => {
        entries += 1;
        if (entries > D01_LIMITS.entries) {
          quota();
        }
      };
      const string = (): string => {
        const start = offset;
        offset += 1;
        let escaped = false;
        while (offset < text.length) {
          const character = take();
          if (!escaped && character === '"') {
            // Parsing one scanned string token cannot erase object keys.
            const decoded: unknown = JSON.parse(text.slice(start, offset));
            if (typeof decoded !== "string" || !validUnicode(decoded)) {
              return invalid();
            }
            return decoded;
          }
          if (!escaped && (character.codePointAt(0) ?? 0) < 32) {
            invalid();
          }
          escaped = !escaped && character === "\\";
        }
        return invalid();
      };
      const object = (
        depth: number,
        parse: (depth: number) => JsonValue
      ): JsonValue => {
        offset += 1;
        whitespace();
        const result: Record<string, JsonValue> = {};
        if (text.charAt(offset) === "}") {
          offset += 1;
          return result;
        }
        while (true) {
          if (text.charAt(offset) !== '"') {
            invalid();
          }
          count();
          const key = string();
          if (Object.hasOwn(result, key)) {
            invalid();
          }
          whitespace();
          if (take() !== ":") {
            invalid();
          }
          Object.defineProperty(result, key, {
            enumerable: true,
            value: parse(depth + 1),
          });
          whitespace();
          const separator = take();
          if (separator === "}") {
            return result;
          }
          if (separator !== ",") {
            invalid();
          }
          whitespace();
        }
      };
      const array = (
        depth: number,
        parse: (depth: number) => JsonValue
      ): JsonValue => {
        offset += 1;
        whitespace();
        const result: JsonValue[] = [];
        if (text.charAt(offset) === "]") {
          offset += 1;
          return result;
        }
        while (true) {
          result.push(parse(depth + 1));
          whitespace();
          const separator = take();
          if (separator === "]") {
            return result;
          }
          if (separator !== ",") {
            invalid();
          }
          whitespace();
        }
      };
      const value = (depth: number): JsonValue => {
        if (depth > D01_LIMITS.depth) {
          quota();
        }
        count();
        whitespace();
        const character = text.charAt(offset);
        if (character === '"') {
          return string();
        }
        if (character === "{") {
          return object(depth, value);
        }
        if (character === "[") {
          return array(depth, value);
        }
        for (const [literal, decoded] of [
          ["true", true],
          ["false", false],
          ["null", null],
        ] as const) {
          if (text.startsWith(literal, offset)) {
            offset += literal.length;
            return decoded;
          }
        }
        const matched =
          /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(
            text.slice(offset)
          );
        if (!matched || !/^-?(?:0|[1-9][0-9]*)$/u.test(matched[0])) {
          return invalid();
        }
        offset += matched[0].length;
        const number = Number(matched[0]);
        if (!Number.isSafeInteger(number)) {
          return invalid();
        }
        return Object.is(number, -0) ? 0 : number;
      };
      const parsed = value(0);
      whitespace();
      if (offset !== text.length) {
        invalid();
      }
      return parsed;
    },
  });

export const parseEnvelopeBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, D01_LIMITS.envelopeBytes).pipe(
    Effect.flatMap(decodeD01Request),
    Effect.catchTag("SchemaError", () =>
      Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }))
    )
  );

export const parseDocumentBytes = (bytes: Uint8Array) =>
  parseJsonBytes(bytes, D01_LIMITS.documentBytes).pipe(
    Effect.flatMap(decodeImportDocument),
    Effect.catchTag("SchemaError", () =>
      Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }))
    )
  );

/** Validate UTF-16 before TextEncoder can replace an unpaired surrogate. */
export const parseDocumentText = (text: string) =>
  validUnicode(text)
    ? parseDocumentBytes(new TextEncoder().encode(text))
    : Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }));
