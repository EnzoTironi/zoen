import { ImportEvidence } from "@zoen/contracts/d01/operations";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { digestBytes, intentDigest } from "../../src/values/canonical.js";
import { parseCsvBytes } from "../../src/values/csv.js";
import { parseImportDocument } from "../../src/values/document.js";

const header =
  "schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo";
const columns = header.split(",");
const baseline = {
  amount: "100.00",
  currency: "BRL",
  predicate: "obligation.amount",
  recordExternalId: "row-1",
  schemaVersion: "d01.csv.v1",
  sourceExternalId: "bill-2026-09",
  sourceLabel: "Fatura, setembro",
  sourceNamespace: "manual",
  sourceRevision: "1",
  subjectKey: "invoice-1",
  validFrom: "2026-09-01",
  validTimeTag: "DateInterval",
  validTo: "2026-10-01",
  valueTag: "Known",
};
type Row = typeof baseline;
const quote = (value: string) =>
  /[,"\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
const row = (changes: Partial<Row> = {}) => {
  const values: Record<string, string> = { ...baseline, ...changes };
  return columns.map((key) => quote(values[key] ?? "")).join(",");
};
const csv = (rows = [row()], separator = "\n") =>
  [header, ...rows].join(separator);
const parse = (text: string) =>
  Effect.runSync(parseImportDocument({ document: text, format: "d01.csv.v1" }));
const fail = <A, E>(effect: Effect.Effect<A, E>) => {
  const result = Effect.runSync(effect.pipe(Effect.result));
  if (Result.isSuccess(result)) {
    throw new Error("Expected rejection");
  }
  return result.failure;
};
const invalid = (text: string) => {
  expect(
    fail(parseImportDocument({ document: text, format: "d01.csv.v1" }))
  ).toMatchObject({ _tag: "InvalidInput", code: "INVALID_INPUT" });
};
const request = (
  document: string,
  format: "d01.csv.v1" | null = "d01.csv.v1"
) =>
  Schema.decodeSync(ImportEvidence)({
    input: format === null ? { document } : { document, format },
    operation: "ImportEvidence",
    operationId: "11111111-1111-4111-8111-111111111111",
    purpose: "personal-records",
    schemaVersion: "d01.v1",
    worldRef: {
      realm: "live",
      worldId: "22222222-2222-4222-8222-222222222222",
    },
  });

describe("EX17 frozen CSV representation", () => {
  it("CSV-01 maps the published example to exact records without treating the header as a claim", () => {
    const text = csv([
      row(),
      row({
        amount: "",
        currency: "",
        recordExternalId: "row-2",
        subjectKey: "invoice-2",
        validFrom: "",
        validTimeTag: "Unknown",
        validTo: "",
        valueTag: "Unknown",
      }),
    ]);
    expect(parse(text)).toStrictEqual({
      records: [
        {
          externalId: "row-1",
          predicate: "obligation.amount",
          subjectKey: "invoice-1",
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount: "100.00", currency: "BRL" },
        },
        {
          externalId: "row-2",
          predicate: "obligation.amount",
          subjectKey: "invoice-2",
          validTime: { _tag: "Unknown" },
          value: { _tag: "Unknown" },
        },
      ],
      schemaVersion: "d01.v1",
      source: {
        externalId: "bill-2026-09",
        label: "Fatura, setembro",
        namespace: "manual",
        revision: "1",
      },
    });
  });

  it("CSV-02 preserves quoted separators, doubled quotes, multiline text and literal backslashes", () => {
    const label = 'Fatura, "setembro"\ncontinua\r\nsem trim ';
    for (const separator of ["\n", "\r\n"]) {
      for (const ending of ["", separator]) {
        const text =
          csv(
            [row({ sourceLabel: label, sourceRevision: "\\literal\t" })],
            separator
          ) + ending;
        expect(parse(text).source).toMatchObject({
          label,
          revision: "\\literal\t",
        });
        expect(parse(text).records).toHaveLength(1);
      }
    }
    const emptyQuoted = csv([
      row({ amount: "", currency: "", valueTag: "Unknown" }).replace(
        "Unknown,,,",
        'Unknown,"","",'
      ),
    ]);
    expect(parse(emptyQuoted).records[0]?.value).toStrictEqual({
      _tag: "Unknown",
    });
  });

  it("CSV-02 rejects other dialects, broken quotes, wrong columns and extra records", () => {
    const simple = row({ sourceLabel: "Plain" });
    const malformed = [
      "",
      header,
      `${header}\n`,
      `sep=,\n${csv()}`,
      csv().replace("schemaVersion,", '"schemaVersion",'),
      csv().replace(
        "sourceNamespace,sourceExternalId",
        "sourceExternalId,sourceNamespace"
      ),
      csv().replace("sourceLabel,", "sourceLabel ,"),
      csv().replace(header, header.replaceAll(",", ";")),
      `${header},extra\n${simple},extra`,
      `${header}\n${simple.split(",").slice(0, 13).join(",")}`,
      `${header}\n${simple},extra`,
      `${csv()}\n\n`,
      `${header}\n${simple}\r\n${simple}`,
      `${header}\r\n${simple}\n`,
      csv().replace('"Fatura, setembro"', '"Fatura, setembro" '),
      csv().replace('"Fatura, setembro"', '"Fatura, setembro'),
      csv().replace('"Fatura, setembro"', 'Fa"tura'),
      csv().replace('"Fatura, setembro"', '"Fatura\\"setembro"'),
      csv().replace('"Fatura, setembro"', '"Fatura\rsetembro"'),
      `${csv()}\n# comment`,
      `${csv()}\nTotal,100`,
    ];
    expect(
      malformed.map(
        (text) =>
          fail(parseImportDocument({ document: text, format: "d01.csv.v1" }))
            ._tag
      )
    ).toStrictEqual(malformed.map(() => "InvalidInput"));
  });

  it("CSV-03 uses exact decimal and civil-date schemas with independent unknown axes", () => {
    for (const amount of [
      "0",
      "0.00",
      "-0",
      "-0.00",
      "-1",
      "99999999999999999999.123456789012345678",
    ]) {
      expect(parse(csv([row({ amount })])).records[0]?.value).toStrictEqual({
        _tag: "Known",
        amount,
        currency: "BRL",
      });
    }
    for (const changes of [
      { amount: "" },
      { currency: "" },
      { amount: "+1" },
      { amount: "1e3" },
      { amount: "01" },
      { amount: "1,23" },
      { amount: "1.000,00" },
      { amount: "R$1" },
      { amount: "NaN" },
      { amount: "Infinity" },
      { amount: "1.1234567890123456789" },
      { amount: "100000000000000000000" },
      { currency: "brl" },
      { currency: "GBP" },
      { valueTag: "Unknown" },
      { amount: "", valueTag: "Unknown" },
      { amount: "", currency: "", valueTag: "null" },
      { validFrom: "01/09/2026" },
      { validFrom: "0000-01-01" },
      { validFrom: "2026-02-29" },
      { validTo: "2026-09-01" },
      { validFrom: "2026-10-02" },
      { validFrom: "" },
      { validTimeTag: "Unknown" },
    ]) {
      invalid(csv([row(changes)]));
    }
    expect(
      parse(csv([row({ validFrom: "0001-01-01", validTo: "9999-12-31" })]))
        .records[0]?.validTime
    ).toStrictEqual({
      _tag: "DateInterval",
      from: "0001-01-01",
      to: "9999-12-31",
    });
    expect(
      parse(csv([row({ validFrom: "", validTimeTag: "Unknown", validTo: "" })]))
        .records[0]?.value._tag
    ).toBe("Known");
    expect(
      parse(csv([row({ amount: "", currency: "", valueTag: "Unknown" })]))
        .records[0]?.validTime._tag
    ).toBe("DateInterval");
  });

  it("CSV-04 rejects changed source metadata, duplicate records and invalid Unicode without repair", () => {
    for (const changes of [
      { sourceExternalId: "other" },
      { sourceLabel: "Other" },
      { sourceNamespace: "other" },
      { sourceRevision: "2" },
      { schemaVersion: "d01.v1" },
    ]) {
      invalid(csv([row(), row({ recordExternalId: "row-2", ...changes })]));
    }
    invalid(csv([row(), row()]));
    invalid(`\uFEFF${csv()}`);
    for (const sourceLabel of [
      "\u0000",
      "\u0001",
      "\u000B",
      "\u001F",
      "\uD800",
      "\uFDD0",
      "\uFFFE",
      "\uD83F\uDFFF",
    ]) {
      invalid(csv([row({ sourceLabel })]));
    }
    for (const bytes of [
      [0xc0, 0xaf],
      [0xed, 0xa0, 0x80],
      [0xf4, 0x90, 0x80, 0x80],
      [0xe2, 0x82],
    ]) {
      expect(fail(parseCsvBytes(Uint8Array.from(bytes)))).toMatchObject({
        _tag: "InvalidInput",
      });
    }
    for (const label of ["é", "e\u0301", "embedded\uFEFFtext", "=SUM(A1:A2)"]) {
      expect(parse(csv([row({ sourceLabel: label })])).source.label).toBe(
        label
      );
    }
    expect(
      digestBytes(new TextEncoder().encode(csv([row({ sourceLabel: "é" })])))
    ).not.toBe(
      digestBytes(
        new TextEncoder().encode(csv([row({ sourceLabel: "e\u0301" })]))
      )
    );
  });

  it("CSV-05 reaches the exact byte ceiling with 200 valid records and rejects one extra byte or row", () => {
    const source = {
      sourceExternalId: "s".repeat(128),
      sourceLabel: "界".repeat(110),
      sourceNamespace: "n".repeat(128),
      sourceRevision: "界".repeat(128),
      subjectKey: "s".repeat(128),
    };
    const ids = Array.from({ length: 200 }, (_, index) => `r${index}`);
    const render = () =>
      csv(ids.map((recordExternalId) => row({ ...source, recordExternalId })));
    let missing =
      D01_LIMITS.documentBytes - new TextEncoder().encode(render()).byteLength;
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      if (id === undefined) {
        throw new Error("A record ID must exist");
      }
      const length = Math.min(128 - id.length, missing);
      ids[index] = id + "x".repeat(length);
      missing -= length;
    }
    const exact = render();
    expect(missing).toBe(0);
    expect(new TextEncoder().encode(exact)).toHaveLength(
      D01_LIMITS.documentBytes
    );
    expect(parse(exact).records).toHaveLength(200);
    expect(
      fail(
        parseImportDocument({ document: `${exact}\n`, format: "d01.csv.v1" })
      )
    ).toMatchObject({ _tag: "QuotaExceeded" });
    invalid(
      csv(
        Array.from({ length: 201 }, (_, index) =>
          row({ recordExternalId: `r${index}` })
        )
      )
    );
    expect(
      fail(
        parseImportDocument({
          document: " ".repeat(D01_LIMITS.documentBytes + 1),
          format: "d01.csv.v1",
        })
      )
    ).toMatchObject({ _tag: "InvalidInput" });
  });

  it("CSV-06 retains exact original text in intent and shares validity between normalization and hashing", () => {
    const text = csv([row({ sourceLabel: "Plain" })]);
    const variants = [
      text,
      text.replaceAll("\n", "\r\n"),
      text.replace(",Plain,", ',"Plain",'),
      `${text}\n`,
    ];
    const digests = variants.map((document) =>
      Effect.runSync(intentDigest(request(document)))
    );
    expect(new Set(digests).size).toBe(variants.length);
    for (const variant of variants) {
      expect(parse(variant)).toStrictEqual(parse(text));
    }
    for (const bad of [
      csv([row(), row()]),
      csv().replace("Known,100.00", "Known,1e3"),
      `${csv()}\n\n`,
    ]) {
      invalid(bad);
      expect(fail(intentDigest(request(bad)))).toMatchObject({
        _tag: "InvalidInput",
      });
    }
    expect(fail(parseImportDocument({ document: text }))).toMatchObject({
      _tag: "InvalidInput",
    });
  });

  it("CSV-06 preserves the legacy JSON golden digest and shared uniqueness checks", () => {
    const json =
      '{"records":[{"externalId":"r","predicate":"obligation.amount","subjectKey":"s","validTime":{"_tag":"Unknown"},"value":{"_tag":"Known","amount":"0.10","currency":"BRL"}}],"schemaVersion":"d01.v1","source":{"externalId":"s","label":"Source","namespace":"manual","revision":"1"}}';
    const legacy = request(json, null);
    expect(legacy.input).toStrictEqual({ document: json });
    expect(Effect.runSync(intentDigest(legacy))).toBe(
      "ea2dbd3bcb5b792ae88b833bfb830c8936ee1f1bce8d4ba03ed4cdb89b40e373"
    );
    const parsed = parse(csv());
    const duplicatedJson = JSON.stringify({
      ...parsed,
      records: [parsed.records[0], parsed.records[0]],
    });
    expect(
      fail(parseImportDocument({ document: duplicatedJson }))
    ).toMatchObject({ _tag: "InvalidInput" });
    expect(fail(intentDigest(request(duplicatedJson, null)))).toMatchObject({
      _tag: "InvalidInput",
    });
  });
});
