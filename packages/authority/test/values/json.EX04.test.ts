import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  digestBytes,
  intentDigest,
  structuredDigest,
} from "../../src/values/canonical.js";
import {
  parseDocumentText,
  parseEnvelopeBytes,
  parseJsonBytes,
} from "../../src/values/json.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const parse = (text: string) =>
  Effect.runSync(parseJsonBytes(bytes(text), D01_LIMITS.envelopeBytes));
const failure = <A, E>(effect: Effect.Effect<A, E>) => {
  const result = Effect.runSync(Effect.result(effect));
  if (Result.isSuccess(result)) {
    throw new Error("Expected rejection");
  }
  return result.failure;
};

const document = JSON.stringify({
  records: [
    {
      externalId: "row-1",
      predicate: "obligation.amount",
      subjectKey: "order-1",
      validTime: { _tag: "Unknown" },
      value: { _tag: "Known", amount: "0.10", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "source-1",
    label: "Ledger",
    namespace: "manual",
    revision: "1",
  },
});
const importRequest = (documentText: string) =>
  Effect.runSync(
    parseEnvelopeBytes(
      bytes(
        JSON.stringify({
          input: { document: documentText },
          operation: "ImportEvidence",
          operationId: "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14",
          purpose: "personal-records",
          schemaVersion: "worlds.v1",
          worldRef: {
            realm: "live",
            worldId: "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14",
          },
        })
      )
    )
  );

describe("EX04 strict JSON bytes", () => {
  it.each([
    '{"x":1,"x":2}',
    '{"x":1,"\\u0078":2}',
    '{"nested":{"x":1,"x":2}}',
    '{"__proto__":1,"__proto__":2}',
    '"\\ud800"',
    '"\\udfff"',
    '"\\ud800x"',
    "\uFEFF{}",
    "{} true",
    "[1,]",
    '{"x":1,}',
    "{x:1}",
    "01",
    "+1",
    '"\\ufdd0"',
    '"\\ufffe"',
    '"\\ud83f\\udfff"',
    '"\\u0000"',
    '{"\\u0000":1}',
    "NaN",
    "Infinity",
    "1e400",
    "9007199254740993",
    "1.00000000000000001",
    "1e0",
    "1.0",
    "1e-400",
    '"a\nb"',
    '"\\x20"',
    "",
  ])("rejects lossy or malformed input %s", (text) => {
    expect(
      failure(parseJsonBytes(bytes(text), D01_LIMITS.envelopeBytes))._tag
    ).toBe("InvalidInput");
  });

  it("decodes escaped Unicode, preserves proto keys and safe integers", () => {
    const value = parse(
      '{"emoji":"\\ud83d\\ude00","__proto__":{"x":1},"max":9007199254740991,"negative":-0}'
    );
    if (typeof value !== "object" || value === null) {
      throw new Error("Expected object");
    }
    expect(Object.hasOwn(value, "__proto__")).toBeTruthy();
    expect(Effect.runSync(canonicalJson(value))).toBe(
      '{"__proto__":{"x":1},"emoji":"😀","max":9007199254740991,"negative":0}'
    );
    expect(parse(' [ true, false, null, "\\\\", "\\\"" ] ')).toStrictEqual([
      true,
      false,
      null,
      "\\",
      '"',
    ]);
  });

  it.each([
    [0xc0, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe2, 0x82],
  ])("rejects invalid UTF-8 bytes %s", (...input) => {
    expect(
      failure(parseJsonBytes(Uint8Array.from(input), D01_LIMITS.envelopeBytes))
        ._tag
    ).toBe("InvalidInput");
  });

  it("counts UTF-8 bytes, total nodes and keys, and exact depth boundaries", () => {
    expect(Effect.runSync(parseJsonBytes(bytes('"é"'), 4))).toBe("é");
    expect(failure(parseJsonBytes(bytes('"é"'), 3))._tag).toBe("QuotaExceeded");
    expect(parse(`${"[".repeat(32)}0${"]".repeat(32)}`)).toHaveLength(1);
    expect(
      failure(
        parseJsonBytes(
          bytes(`${"[".repeat(33)}0${"]".repeat(33)}`),
          D01_LIMITS.envelopeBytes
        )
      )._tag
    ).toBe("QuotaExceeded");
  });

  it("counts array entries and object keys globally", () => {
    expect(
      parse(JSON.stringify(Array.from({ length: 9999 }, () => null)))
    ).toHaveLength(9999);
    expect(
      failure(
        parseJsonBytes(
          bytes(JSON.stringify(Array.from({ length: 10_000 }, () => null))),
          D01_LIMITS.envelopeBytes
        )
      )._tag
    ).toBe("QuotaExceeded");
    const object = Object.fromEntries(
      Array.from({ length: 5000 }, (_, index) => [String(index), null])
    );
    expect(
      failure(
        parseJsonBytes(bytes(JSON.stringify(object)), D01_LIMITS.envelopeBytes)
      )._tag
    ).toBe("QuotaExceeded");
  });

  it("does not repair invalid UTF-16 text before encoding documents", () => {
    expect(failure(parseDocumentText('"\uD800"'))._tag).toBe("InvalidInput");
    expect(
      failure(parseDocumentText(" ".repeat(D01_LIMITS.documentBytes + 1)))._tag
    ).toBe("QuotaExceeded");
  });

  it("applies envelope Schema after strict parsing", () => {
    const request =
      '{"schemaVersion":"worlds.v1","purpose":"personal-records","operation":"CreatePersonalWorld","operationId":"c4b14bfd-2f39-4fd9-967e-13aebf0f4e14","input":{}}';
    expect(Effect.runSync(parseEnvelopeBytes(bytes(request))).operation).toBe(
      "CreatePersonalWorld"
    );
    expect(
      failure(
        parseEnvelopeBytes(
          bytes(request.replace('"input":{}', '"input":{},"actor":"owner"'))
        )
      )._tag
    ).toBe("InvalidInput");
    expect(
      failure(
        parseEnvelopeBytes(
          bytes(request.replace('"input":{}', '"input":{},"input":{}'))
        )
      )._tag
    ).toBe("InvalidInput");
  });
});

describe("EX04 canonical bytes and domain-separated digests", () => {
  it("binds the exact document bytes and rejects duplicates inside that document", () => {
    const first = importRequest(document);
    const spaced = importRequest(` ${document}`);
    expect(Effect.runSync(intentDigest(first))).not.toBe(
      Effect.runSync(intentDigest(spaced))
    );
    const duplicate = importRequest(
      document.replace('"amount":"0.10"', '"amount":"0.10","amount":"0.20"')
    );
    expect(failure(intentDigest(duplicate))._tag).toBe("InvalidInput");
    const nul = importRequest(document.replace('"Ledger"', '"Led\\u0000ger"'));
    expect(failure(intentDigest(nul))._tag).toBe("InvalidInput");
    expect(
      Effect.runSync(parseDocumentText(document)).records[0]?.value
    ).toStrictEqual({ _tag: "Known", amount: "0.10", currency: "BRL" });
  });

  it("applies the smaller document byte limit within a valid envelope", () => {
    const exact =
      " ".repeat(D01_LIMITS.documentBytes - bytes(document).byteLength) +
      document;
    expect(Effect.runSync(parseDocumentText(exact)).records).toHaveLength(1);
    expect(failure(parseDocumentText(` ${exact}`))._tag).toBe("QuotaExceeded");
    expect(
      failure(
        parseEnvelopeBytes(bytes(" ".repeat(D01_LIMITS.envelopeBytes + 1)))
      )._tag
    ).toBe("QuotaExceeded");
  });

  it("matches the standard SHA256 byte vector and preserves Unicode form", () => {
    expect(digestBytes(bytes("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(Effect.runSync(canonicalJson({ a: [2, 1], z: "0.10" }))).toBe(
      '{"a":[2,1],"z":"0.10"}'
    );
    expect(digestBytes(bytes("é"))).not.toBe(digestBytes(bytes("e\u0301")));
  });

  it("is insertion-order invariant and separates intent/read-set/consequence domains", () => {
    const value = { a: "one", b: "two" };
    expect(Effect.runSync(structuredDigest("read-set", value))).toBe(
      Effect.runSync(structuredDigest("read-set", { a: "one", b: "two" }))
    );
    expect(Effect.runSync(structuredDigest("read-set", value))).not.toBe(
      Effect.runSync(structuredDigest("correction-consequence", value))
    );
    const request = Effect.runSync(
      parseEnvelopeBytes(
        bytes(
          '{"schemaVersion":"worlds.v1","purpose":"personal-records","operation":"CreatePersonalWorld","operationId":"c4b14bfd-2f39-4fd9-967e-13aebf0f4e14","input":{}}'
        )
      )
    );
    expect(Effect.runSync(intentDigest(request))).not.toBe(
      Effect.runSync(structuredDigest("read-set", request))
    );
  });

  it("rejects cycles, holes, getters, non-JSON metadata and lossy values", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    let getterCalls = 0;
    const getter = Object.defineProperty({}, "x", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return 1;
      },
    });
    for (const value of [
      cycle,
      Array.from({ length: 1 }),
      getter,
      { x: undefined },
      new Map(),
      Number.NaN,
      1.5,
      1n,
      "\uD800",
      Object.defineProperty({}, "hidden", { value: 1 }),
      { [Symbol("x")]: 1 },
    ]) {
      expect(failure(canonicalJson(value))._tag).toBe("InvalidInput");
    }
    expect(getterCalls).toBe(0);
  });

  it("rejects NUL keys and values before canonical hashing", () => {
    expect(failure(canonicalJson({ "\u0000": 1 }))._tag).toBe("InvalidInput");
    expect(failure(canonicalJson({ label: "\u0000" }))._tag).toBe(
      "InvalidInput"
    );
  });

  it("rejects array prototypes that carry metadata outside canonical JSON", () => {
    const altered = [1, 2];
    Object.setPrototypeOf(altered, { custom: true });
    expect(failure(canonicalJson(altered))._tag).toBe("InvalidInput");
    expect(Effect.runSync(canonicalJson([1, 2]))).toBe("[1,2]");
  });
});
