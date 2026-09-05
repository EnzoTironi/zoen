import { InvalidInput } from "@zoen/contracts/d01/errors";
import {
  CreatePersonalWorld,
  ImportEvidence,
} from "@zoen/contracts/d01/operations";
import type { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import { readDocument } from "./file.ts";

export const envelope = {
  purpose: "personal-records",
  schemaVersion: "d01.v1",
} as const;

export const newOperationId = Effect.try({
  catch: () => new InvalidInput({ code: "INVALID_INPUT" }),
  // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- Use the browser cryptographic UUID implementation; retry retains the result.
  try: () => crypto.randomUUID(),
});

export const createWorldRequest = Effect.gen(function* createWorldRequest() {
  return yield* Schema.decodeEffect(CreatePersonalWorld)({
    ...envelope,
    input: {},
    operation: "CreatePersonalWorld",
    operationId: yield* newOperationId,
  });
});

export type ImportFileFormat = "json" | "csv";

export const importRequest = Effect.fn("web.importRequest")(
  function* importRequest(
    file: File,
    worldRef: WorldRef,
    format: ImportFileFormat = "json"
  ) {
    return yield* Schema.decodeEffect(ImportEvidence)({
      ...envelope,
      input: {
        document: yield* readDocument(file),
        ...(format === "csv" ? { format: "d01.csv.v1" } : {}),
      },
      operation: "ImportEvidence",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
  }
);
