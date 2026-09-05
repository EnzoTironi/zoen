import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketVersioningCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import {
  EvidenceObjectStore,
  ObjectLocation,
  StorageFailure,
} from "@zoen/authority/ports/d01/storage";
import { digestBytes } from "@zoen/authority/values/canonical";
import { Effect, Schema, Stream } from "effect";

import {
  payload,
  reservation,
  sdk,
  stageInput,
  withStorage,
} from "./fixture.js";

const csv = new TextEncoder().encode(
  'schemaVersion,sourceNamespace,sourceExternalId,sourceRevision,sourceLabel,recordExternalId,subjectKey,predicate,valueTag,amount,currency,validTimeTag,validFrom,validTo\r\nd01.csv.v1,manual,csv-1,1,"Ação, ""setembro""\r\noriginal",row-1,invoice-1,obligation.amount,Known,100.00,BRL,Unknown,,\r\n'
);
const csvInput = () => ({
  ...stageInput(csv),
  documentFormat: "d01.csv.v1" as const,
});
const csvReservation = (input: ReturnType<typeof csvInput>) => ({
  ...reservation(input),
  documentFormat: input.documentFormat,
});

it.live(
  "CSV-10 reads exact externally retained text/csv bytes with explicit format",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* retainedCsv() {
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const location = yield* Schema.decodeEffect(ObjectLocation)({
          byteLength: input.expectedBytes,
          captureId: input.captureId,
          digest: input.expectedDigest,
          documentFormat: input.documentFormat,
          key: `d01/live/${input.worldRef.worldId}/captures/${input.captureId}`,
          versionId: null,
          worldRef: input.worldRef,
        });
        yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: csv,
              Bucket: config.bucket,
              ContentType: "text/csv",
              Key: location.key,
            }),
            { abortSignal: signal }
          )
        );
        expect(yield* store.read(location)).toStrictEqual(csv);
      })
    )
);

it.live(
  "CSV-10 writes both explicit MIME types and keeps legacy JSON locations unchanged",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* explicitFormats() {
        const store = yield* EvidenceObjectStore;
        for (const [documentFormat, content, mime] of [
          ["d01.json.v1", payload, "application/json"],
          ["d01.csv.v1", csv, "text/csv"],
        ] as const) {
          const input = { ...stageInput(content), documentFormat };
          const location = yield* store.stageDocument(input);
          expect(location.documentFormat).toBe(documentFormat);
          const actual = yield* sdk((signal) =>
            client.send(
              new GetObjectCommand({
                Bucket: config.bucket,
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect(actual.ContentType).toBe(mime);
          expect(actual.ContentLength).toBe(content.byteLength);
          const body = yield* Effect.fromNullishOr(actual.Body);
          expect(yield* sdk(() => body.transformToByteArray())).toStrictEqual(
            content
          );
          expect(
            yield* store.locateDocument({
              ...reservation(input),
              documentFormat,
            })
          ).toStrictEqual(location);
        }
        const legacyInput = stageInput();
        const legacy = yield* store.stage(legacyInput);
        expect(Object.hasOwn(legacy, "documentFormat")).toBeFalsy();
        expect(yield* store.locate(reservation(legacyInput))).toStrictEqual(
          legacy
        );
        expect(yield* store.read(legacy)).toStrictEqual(payload);
      })
    )
);

it.live(
  "CSV-10 recovers an unrecorded versioned CSV upload and a real conditional PUT replay",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* recoverCsv() {
        yield* sdk((signal) =>
          client.send(
            new PutBucketVersioningCommand({
              Bucket: config.bucket,
              VersioningConfiguration: { Status: "Enabled" },
            }),
            { abortSignal: signal }
          )
        );
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        expect(
          (yield* store.locateDocument(csvReservation(input)).pipe(Effect.flip))
            .reason
        ).toBe("NotFound");
        yield* store.stageDocument(input);
        const located = yield* store.locateDocument(csvReservation(input));
        expect(located.versionId).not.toBeNull();
        expect(located.documentFormat).toBe("d01.csv.v1");
        expect(yield* store.stageDocument(input)).toStrictEqual(located);
        expect(yield* store.read(located)).toStrictEqual(csv);
      })
    )
);

it.live(
  "CSV-10 rejects every incompatible MIME on read locate and conditional upload recovery",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* badMime() {
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const location = yield* store.stageDocument(input);
        for (const mime of [
          "application/json",
          "text/plain",
          "text/csv; charset=utf-8",
          "TEXT/CSV",
        ]) {
          yield* sdk((signal) =>
            client.send(
              new PutObjectCommand({
                Body: csv,
                Bucket: config.bucket,
                ContentType: mime,
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "DigestMismatch"
          );
          expect(
            (yield* store
              .locateDocument(csvReservation(input))
              .pipe(Effect.flip)).reason
          ).toBe("DigestMismatch");
          expect(
            (yield* store.stageDocument(input).pipe(Effect.flip)).reason
          ).toBe("DigestMismatch");
        }
      })
    )
);

it.live(
  "CSV-10 refuses format reinterpretation and missing format means only legacy JSON",
  () =>
    withStorage(() =>
      Effect.gen(function* noFormatInference() {
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const location = yield* store.stageDocument(input);
        const { documentFormat: _format, ...legacyShape } = location;
        expect((yield* store.read(legacyShape).pipe(Effect.flip)).reason).toBe(
          "DigestMismatch"
        );
        expect(
          (yield* store.locate(reservation(input)).pipe(Effect.flip)).reason
        ).toBe("DigestMismatch");
        expect(
          (yield* store
            .stageDocument({ ...input, documentFormat: "d01.json.v1" })
            .pipe(Effect.flip)).reason
        ).toBe("DigestMismatch");
        const json = yield* store.stage(stageInput());
        expect(
          (yield* store
            .read({ ...json, documentFormat: "d01.csv.v1" })
            .pipe(Effect.flip)).reason
        ).toBe("DigestMismatch");
        expect(yield* store.read(location)).toStrictEqual(csv);
      })
    )
);

it.live(
  "CSV-10 detects changed CSV bytes lengths and digests from the real store",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* corruptBytes() {
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const location = yield* store.stageDocument(input);
        expect(
          (yield* store
            .read({ ...location, byteLength: location.byteLength + 1 })
            .pipe(Effect.flip)).reason
        ).toBe("DigestMismatch");
        expect(
          (yield* store
            .locateDocument({
              ...csvReservation(input),
              expectedDigest: digestBytes(payload),
            })
            .pipe(Effect.flip)).reason
        ).toBe("DigestMismatch");
        const changed = Uint8Array.from(csv);
        changed[0] = 32;
        for (const content of [changed, csv.subarray(1)]) {
          yield* sdk((signal) =>
            client.send(
              new PutObjectCommand({
                Body: content,
                Bucket: config.bucket,
                ContentType: "text/csv",
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "DigestMismatch"
          );
          expect(
            (yield* store
              .locateDocument(csvReservation(input))
              .pipe(Effect.flip)).reason
          ).toBe("DigestMismatch");
        }
      })
    )
);

it.live("CSV-10 rejects missing CSV objects and missing exact versions", () =>
  withStorage(({ client, config }) =>
    Effect.gen(function* missingVersion() {
      yield* sdk((signal) =>
        client.send(
          new PutBucketVersioningCommand({
            Bucket: config.bucket,
            VersioningConfiguration: { Status: "Enabled" },
          }),
          { abortSignal: signal }
        )
      );
      const store = yield* EvidenceObjectStore;
      const input = csvInput();
      const location = yield* store.stageDocument(input);
      expect(
        (yield* store
          .read({ ...location, versionId: randomUUID() })
          .pipe(Effect.flip)).reason
      ).toBe("NotFound");
      yield* store.remove(location);
      expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
        "NotFound"
      );
      expect(
        (yield* store.locateDocument(csvReservation(input)).pipe(Effect.flip))
          .reason
      ).toBe("NotFound");
    })
  )
);

it.live(
  "CSV-10 exact version deletion preserves later objects and separate legacy JSON",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* exactRemoval() {
        yield* sdk((signal) =>
          client.send(
            new PutBucketVersioningCommand({
              Bucket: config.bucket,
              VersioningConfiguration: { Status: "Enabled" },
            }),
            { abortSignal: signal }
          )
        );
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const old = yield* store.stageDocument(input);
        const json = yield* store.stage(stageInput());
        const newer = new TextEncoder().encode("newer,csv\r\n");
        yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: newer,
              Bucket: config.bucket,
              ContentType: "text/csv",
              Key: old.key,
            }),
            { abortSignal: signal }
          )
        );
        expect(yield* store.read(old)).toStrictEqual(csv);
        yield* store.remove(old);
        const retained = yield* store.locateDocument({
          ...csvReservation(input),
          expectedBytes: newer.byteLength,
          expectedDigest: digestBytes(newer),
        });
        expect(yield* store.read(retained)).toStrictEqual(newer);
        expect(yield* store.read(json)).toStrictEqual(payload);
      })
    )
);

it.live("CSV-10 invalid CSV streams never create an S3 object", () =>
  withStorage(({ client, config }) =>
    Effect.gen(function* badStreams() {
      const store = yield* EvidenceObjectStore;
      for (const [content, reason] of [
        [Stream.make(csv.subarray(1)), "InvalidInput"],
        [
          Stream.fail(new StorageFailure({ reason: "Unavailable" })),
          "Unavailable",
        ],
        [Stream.make(new Uint8Array(csv.byteLength)), "DigestMismatch"],
      ] as const) {
        expect(
          (yield* store
            .stageDocument({ ...csvInput(), content })
            .pipe(Effect.flip)).reason
        ).toBe(reason);
      }
      const objects = yield* sdk((signal) =>
        client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
          abortSignal: signal,
        })
      );
      expect(objects.Contents ?? []).toStrictEqual([]);
    })
  )
);

it.live(
  "CSV-10 explicit operations reject evaluation scope and reads reject a changed key",
  () =>
    withStorage(() =>
      Effect.gen(function* scopeGuards() {
        const store = yield* EvidenceObjectStore;
        const input = csvInput();
        const forbidden = {
          ...input,
          worldRef: { ...input.worldRef, realm: "evaluation" as const },
        };
        expect(
          (yield* store.stageDocument(forbidden).pipe(Effect.flip)).reason
        ).toBe("InvalidInput");
        expect(
          (yield* store
            .locateDocument(csvReservation(forbidden))
            .pipe(Effect.flip)).reason
        ).toBe("InvalidInput");
        const location = yield* store.stageDocument(input);
        expect(
          (yield* store
            .read({ ...location, key: `${location.key}/other` })
            .pipe(Effect.flip)).reason
        ).toBe("InvalidInput");
        expect(yield* store.read(location)).toStrictEqual(csv);
      })
    )
);
