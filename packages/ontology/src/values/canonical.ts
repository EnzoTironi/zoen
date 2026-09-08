import { createHash } from "node:crypto";

import { InvalidInput, QuotaExceeded } from "@zoen/contracts/worlds/errors";
import { decodeSemanticRequest } from "@zoen/contracts/worlds/operations";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { WorldLimits, Digest } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { parseImportDocument } from "./document.js";
import { validUnicode } from "./json.js";

const encoder = new TextEncoder();
const invalid = (): never => {
  throw new InvalidInput({ code: "INVALID_INPUT" });
};
const quota = (): never => {
  throw new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
};

/** Exact byte digest for evidence; no semantic-domain prefix. */
export const digestBytes = (bytes: Uint8Array): typeof Digest.Type =>
  Schema.decodeSync(Digest)(createHash("sha256").update(bytes).digest("hex"));

/** Sorted UTF-16 keys, exact strings and safe integers: the Worlds JSON subset. */
export const canonicalJson = (input: unknown) =>
  Effect.try({
    catch: (error) =>
      Schema.is(QuotaExceeded)(error)
        ? error
        : new InvalidInput({ code: "INVALID_INPUT" }),
    try: () => {
      const parts: string[] = [];
      const active = new Set<object>();
      let bytes = 0;
      let entries = 0;
      const append = (text: string): void => {
        bytes += encoder.encode(text).byteLength;
        if (bytes > WorldLimits.envelopeBytes) {
          quota();
        }
        parts.push(text);
      };
      const count = (): void => {
        entries += 1;
        if (entries > WorldLimits.entries) {
          quota();
        }
      };
      const container = (
        value: object,
        depth: number,
        descend: (value: unknown, depth: number) => void
      ): void => {
        if (Array.isArray(value)) {
          if (Object.getPrototypeOf(value) !== Array.prototype) {
            invalid();
          }
          if (Reflect.ownKeys(value).length !== value.length + 1) {
            invalid();
          }
          append("[");
          for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(
              value,
              String(index)
            );
            if (
              !descriptor ||
              !("value" in descriptor) ||
              descriptor.enumerable !== true
            ) {
              return invalid();
            }
            if (index > 0) {
              append(",");
            }
            descend(descriptor.value, depth + 1);
          }
          append("]");
        } else {
          const prototype: unknown = Object.getPrototypeOf(value);
          if (prototype !== Object.prototype && prototype !== null) {
            invalid();
          }
          const keys = Object.keys(value).toSorted();
          if (Reflect.ownKeys(value).length !== keys.length) {
            invalid();
          }
          append("{");
          for (const [index, key] of keys.entries()) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !("value" in descriptor) || !validUnicode(key)) {
              return invalid();
            }
            count();
            if (index > 0) {
              append(",");
            }
            append(JSON.stringify(key));
            append(":");
            descend(descriptor.value, depth + 1);
          }
          append("}");
        }
      };
      const visit = (value: unknown, depth: number): void => {
        if (depth > WorldLimits.depth) {
          quota();
        }
        count();
        if (value === null) {
          append("null");
          return;
        }
        if (typeof value === "boolean") {
          append(value ? "true" : "false");
          return;
        }
        if (typeof value === "string") {
          if (!validUnicode(value)) {
            invalid();
          }
          append(JSON.stringify(value));
          return;
        }
        if (typeof value === "number") {
          if (!Number.isSafeInteger(value)) {
            invalid();
          }
          append(JSON.stringify(value));
          return;
        }
        if (typeof value !== "object" || value === null) {
          return invalid();
        }
        if (active.has(value)) {
          invalid();
        }
        active.add(value);
        container(value, depth, visit);
        active.delete(value);
      };
      visit(input, 0);
      return parts.join("");
    },
  });

export type DigestDomain =
  | "read-set"
  | "correction-consequence"
  | "identity-consequence";

const domainDigest = (domain: DigestDomain | "intent", value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((canonical) =>
      digestBytes(encoder.encode(`zoen:worlds:${domain}:v1\n${canonical}`))
    )
  );

/** Callers validate their private ReadSet or public consequence schema first. */
export const structuredDigest = (domain: DigestDomain, value: unknown) =>
  domainDigest(domain, value);

/**
 * Verify retained pre-identity read-set seals only. New writes use structuredDigest
 * (zoen:worlds). Not an admission dual-read — historical integrity for Stale vs Unavailable.
 */
export const legacyReadSetDigest = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((canonical) =>
      digestBytes(encoder.encode(`zoen:d01:read-set:v1\n${canonical}`))
    )
  );

export const intentDigest = (request: SemanticRequest) =>
  Effect.gen(function* computeIntentDigest() {
    // Check the original object too: schema decoding must not erase non-JSON metadata.
    yield* canonicalJson(request);
    const decoded = yield* decodeSemanticRequest(request).pipe(
      Effect.catchTag("SchemaError", () =>
        Effect.fail(new InvalidInput({ code: "INVALID_INPUT" }))
      )
    );
    if (decoded.operation === "ImportEvidence") {
      yield* parseImportDocument(decoded.input);
    }
    return yield* domainDigest("intent", decoded);
  });
