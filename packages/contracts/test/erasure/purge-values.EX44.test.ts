import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  ErasureObjectHoldState,
  ErasureObjectVersionId,
  ErasureRestoreAfterErasure,
  ErasureVersionEntry,
  ErasureVersionManifest,
  ErasureVersionPurgeOutcome,
} from "../../src/erasure/values.js";

describe("EX44 erasure purge value schemas", () => {
  it("preserves literal null version ids", () => {
    expect(Schema.decodeUnknownSync(ErasureObjectVersionId)("null")).toBe(
      "null"
    );
    expect(
      Schema.decodeUnknownSync(ErasureObjectVersionId)(
        "8cae56c0-f40f-4ea6-8298-918f67420e0b"
      )
    ).toBe("8cae56c0-f40f-4ea6-8298-918f67420e0b");
  });

  it("encodes version entries and manifests", () => {
    const entry = Schema.decodeUnknownSync(ErasureVersionEntry)({
      deleteMarker: false,
      isLatest: true,
      key: "d01/live/00000000-0000-4000-8000-000000000001/captures/a",
      versionId: "null",
    });
    expect(entry.versionId).toBe("null");
    const manifest = Schema.decodeUnknownSync(ErasureVersionManifest)({
      entries: [entry],
      prefix: "d01/live/00000000-0000-4000-8000-000000000001/",
    });
    expect(manifest.entries).toHaveLength(1);
  });

  it("keeps restoreAfterErasure false and hold/outcome enums closed", () => {
    expect(
      Schema.decodeUnknownSync(ErasureRestoreAfterErasure)(false)
    ).toBeFalsy();
    expect(Schema.decodeUnknownSync(ErasureObjectHoldState)("Clear")).toBe(
      "Clear"
    );
    expect(
      Schema.decodeUnknownSync(ErasureVersionPurgeOutcome)("Blocked")
    ).toBe("Blocked");
    expect(() =>
      Schema.decodeUnknownSync(ErasureVersionPurgeOutcome)("Success")
    ).toThrow(/./u);
  });
});
