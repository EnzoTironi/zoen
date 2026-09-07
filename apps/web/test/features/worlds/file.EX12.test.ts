import { it, expect } from "@effect/vitest";
import { Effect } from "effect";

import { readDocument } from "../../../src/features/worlds/file.ts";

it.effect(
  "EX12 file boundary preserves duplicate JSON keys and a BOM for the strict server parser",
  () =>
    Effect.gen(function* exactText() {
      const text = '\uFEFF{"key":1,"key":2}';
      const file = new File([new TextEncoder().encode(text)], "duplicate.json");
      expect(yield* readDocument(file)).toBe(text);
    })
);

it.effect(
  "EX12 file boundary rejects malformed UTF-8 rather than replacing bytes before admission",
  () =>
    Effect.gen(function* malformedUtf8() {
      const file = new File(
        [
          new Uint8Array([
            0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d,
          ]),
        ],
        "invalid.json"
      );
      expect(yield* readDocument(file).pipe(Effect.flip)).toMatchObject({
        _tag: "InvalidInput",
        code: "INVALID_INPUT",
      });
    })
);
