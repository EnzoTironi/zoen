import { expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import { importRequest } from "../../../src/features/d01/requests.ts";

const world = Schema.decodeSync(WorldRef)({
  realm: "live",
  worldId: "11111111-1111-4111-8111-111111111111",
});
const csv =
  'schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo\r\nd01.csv.v1,manual,f1,1,"Ação, ""literal""\r\nsegunda linha",r1,invoice-1,obligation.amount,Unknown,,,Unknown,,\r\n';

it.effect(
  "EX19 explicit CSV selection preserves original bytes despite a JSON filename and MIME",
  () =>
    Effect.gen(function* explicitCsv() {
      const file = new File([new TextEncoder().encode(csv)], "source.json", {
        type: "application/json",
      });
      const request = yield* importRequest(file, world, "csv");
      expect(request.input).toStrictEqual({
        document: csv,
        format: "d01.csv.v1",
      });
      expect(new TextEncoder().encode(request.input.document)).toStrictEqual(
        new Uint8Array(yield* Effect.tryPromise(() => file.arrayBuffer()))
      );
      expect(request.worldRef).toStrictEqual(world);
      expect(request.operation).toBe("ImportEvidence");
    })
);

it.effect(
  "EX19 default and explicit JSON keep the legacy envelope without a materialized format",
  () =>
    Effect.gen(function* legacyJson() {
      const document = '{"schemaVersion":"d01.v1","source":"unchanged"}\n';
      for (const format of [undefined, "json"] as const) {
        const request = yield* importRequest(
          new File([document], "source.csv", { type: "text/csv" }),
          world,
          format
        );
        expect(request.input).toStrictEqual({ document });
        expect(Object.hasOwn(request.input, "format")).toBeFalsy();
      }
    })
);

it.effect(
  "EX19 JSON selection does not detect or rewrite CSV before server admission",
  () =>
    Effect.gen(function* noInference() {
      const request = yield* importRequest(
        new File([csv], "source.csv", { type: "text/csv" }),
        world,
        "json"
      );
      expect(request.input).toStrictEqual({ document: csv });
    })
);

it.effect(
  "EX19 CSV selection leaves grammar validation and formula-like text to the server",
  () =>
    Effect.gen(function* noClientParser() {
      const document =
        'not,the,header\r\n"unterminated,=SUM(A1:A2),<script>literal</script>';
      const request = yield* importRequest(
        new File([document], "untrusted.csv"),
        world,
        "csv"
      );
      expect(request.input).toStrictEqual({ document, format: "d01.csv.v1" });
    })
);

it.effect(
  "EX19 CSV file decoding refuses invalid UTF-8 before sending an altered document",
  () =>
    Effect.gen(function* strictUtf8() {
      const result = yield* importRequest(
        new File([new Uint8Array([0xc3, 0x28])], "invalid.csv"),
        world,
        "csv"
      ).pipe(Effect.flip);
      expect(result).toMatchObject({
        _tag: "InvalidInput",
        code: "INVALID_INPUT",
      });
    })
);
