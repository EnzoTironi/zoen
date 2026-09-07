import { randomUUID } from "node:crypto";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "@effect/vitest";
import {
  EvidenceObjectStore,
  StorageFailure,
} from "@zoen/authority/ports/worlds/storage";
import { digestBytes } from "@zoen/authority/values/canonical";
import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Deferred, Effect, Fiber, Redacted, Schema, Stream } from "effect";

import { layer } from "../../../../src/adapters/object-storage/worlds/s3.js";
import {
  createClient,
  payload,
  reservation,
  sdk,
  stageInput,
  withStorage,
} from "./fixture.js";

describe("EX07 real S3 capture", () => {
  it.live(
    "locates an unrecorded upload from reservation metadata and observes later arrivals",
    () =>
      withStorage(() =>
        Effect.gen(function* locateUnconfirmedUpload() {
          const store = yield* EvidenceObjectStore;
          const input = stageInput();
          const metadata = reservation(input);
          expect((yield* store.locate(metadata).pipe(Effect.flip)).reason).toBe(
            "NotFound"
          );
          // The caller discards the upload response: no stored ObjectLocation is supplied to locate.
          yield* store.stage(input);
          const located = yield* store.locate(metadata);
          expect(yield* store.read(located)).toStrictEqual(payload);
          expect(located.captureId).toBe(input.captureId);
          yield* store.remove(located);
          expect((yield* store.locate(metadata).pipe(Effect.flip)).reason).toBe(
            "NotFound"
          );
        })
      )
  );

  it.live(
    "refuses mismatched expectations when locating an existing capture",
    () =>
      withStorage(() =>
        Effect.gen(function* locateWrongExpectation() {
          const store = yield* EvidenceObjectStore;
          const input = stageInput();
          yield* store.stage(input);
          const metadata = reservation(input);
          expect(
            (yield* store
              .locate({
                ...metadata,
                expectedBytes: metadata.expectedBytes + 1,
              })
              .pipe(Effect.flip)).reason
          ).toBe("DigestMismatch");
          expect(
            (yield* store
              .locate({
                ...metadata,
                expectedDigest: digestBytes(new Uint8Array([1])),
              })
              .pipe(Effect.flip)).reason
          ).toBe("DigestMismatch");
          expect(
            (yield* store
              .locate({
                ...metadata,
                worldRef: { ...metadata.worldRef, realm: "evaluation" },
              })
              .pipe(Effect.flip)).reason
          ).toBe("InvalidInput");
          expect(
            yield* store.read(yield* store.locate(metadata))
          ).toStrictEqual(payload);
        })
      )
  );

  it.live(
    "round-trips exact scoped bytes and reconciles a real conditional PUT replay",
    () =>
      withStorage(({ client, config }) =>
        Effect.gen(function* roundTrip() {
          const store = yield* EvidenceObjectStore;
          const input = stageInput();
          const location = yield* store.stage(input);
          const replay = yield* store.stage(input);
          expect(replay).toStrictEqual(location);
          expect(yield* store.read(location)).toStrictEqual(payload);
          expect(location.key).toBe(
            `worlds/live/${input.worldRef.worldId}/captures/${input.captureId}`
          );
          const listed = yield* sdk((signal) =>
            client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
              abortSignal: signal,
            })
          );
          expect(listed.Contents?.map((object) => object.Key)).toStrictEqual([
            location.key,
          ]);
          expect(location.digest).toBe(digestBytes(payload));
        })
      )
  );

  it.live(
    "does not overwrite an existing capture with different complete bytes",
    () =>
      withStorage(() =>
        Effect.gen(function* immutableCapture() {
          const store = yield* EvidenceObjectStore;
          const input = stageInput();
          const location = yield* store.stage(input);
          const different = new TextEncoder().encode(
            '{"message":"changed","value":"0.20"}'
          );
          const conflict = yield* store
            .stage({
              ...input,
              content: Stream.make(different),
              expectedBytes: different.byteLength,
              expectedDigest: digestBytes(different),
            })
            .pipe(Effect.flip);
          expect(conflict.reason).toBe("DigestMismatch");
          expect(yield* store.read(location)).toStrictEqual(payload);
        })
      )
  );

  it.live(
    "leaves no object for truncated, failed, oversized or hash-mismatched streams",
    () =>
      withStorage(({ client, config }) =>
        Effect.gen(function* failedStreams() {
          const store = yield* EvidenceObjectStore;
          for (const amendment of [
            {
              content: Stream.make(payload.subarray(1)),
              reason: "InvalidInput",
            },
            {
              content: Stream.concat(
                Stream.make(payload),
                Stream.fail(new StorageFailure({ reason: "Unavailable" }))
              ),
              reason: "Unavailable",
            },
            {
              content: Stream.make(
                new Uint8Array(D01_LIMITS.documentBytes + 1)
              ),
              reason: "InvalidInput",
            },
            {
              expectedBytes: D01_LIMITS.documentBytes + 1,
              reason: "InvalidInput",
            },
            { expectedBytes: 0, reason: "InvalidInput" },
            {
              expectedDigest: digestBytes(
                new TextEncoder().encode("different")
              ),
              reason: "DigestMismatch",
            },
          ]) {
            const { reason, ...changes } = amendment;
            const failure = yield* store
              .stage({ ...stageInput(), ...changes })
              .pipe(Effect.flip);
            expect(failure.reason).toBe(reason);
          }
          const listed = yield* sdk((signal) =>
            client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
              abortSignal: signal,
            })
          );
          expect(listed.Contents ?? []).toStrictEqual([]);
        })
      )
  );

  it.live("cancels a live input stream before any S3 object exists", () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* interruptedStream() {
        const store = yield* EvidenceObjectStore;
        const started = yield* Deferred.make<null>();
        const content = Stream.concat(
          Stream.fromEffect(
            Deferred.succeed(started, null).pipe(
              Effect.as(payload.subarray(0, 1))
            )
          ),
          Stream.never
        );
        const fiber = yield* Effect.forkChild(
          store.stage({ ...stageInput(), content })
        );
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
        const listed = yield* sdk((signal) =>
          client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
            abortSignal: signal,
          })
        );
        expect(listed.Contents ?? []).toStrictEqual([]);
      })
    )
  );

  it.live(
    "accepts the exact byte ceiling and rejects an evaluation capture",
    () =>
      withStorage(({ client, config }) =>
        Effect.gen(function* exactLimitAndRealm() {
          const store = yield* EvidenceObjectStore;
          const maximum = new Uint8Array(D01_LIMITS.documentBytes).fill(32);
          const input = stageInput(maximum);
          const location = yield* store.stage(input);
          expect((yield* store.read(location)).byteLength).toBe(
            D01_LIMITS.documentBytes
          );
          expect(location.digest).toBe(digestBytes(maximum));
          const forbidden = yield* store
            .stage({
              ...stageInput(),
              worldRef: { ...input.worldRef, realm: "evaluation" },
            })
            .pipe(Effect.flip);
          expect(forbidden.reason).toBe("InvalidInput");
          const listed = yield* sdk((signal) =>
            client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
              abortSignal: signal,
            })
          );
          expect(listed.Contents?.map((object) => object.Key)).toStrictEqual([
            location.key,
          ]);
        })
      )
  );

  it.live(
    "rejects cross-scope locations and reports a removed object as NotFound",
    () =>
      withStorage(() =>
        Effect.gen(function* scopeAndRemoval() {
          const store = yield* EvidenceObjectStore;
          const location = yield* store.stage(stageInput());
          expect(
            (yield* store
              .read({ ...location, key: `${location.key}/other` })
              .pipe(Effect.flip)).reason
          ).toBe("InvalidInput");
          expect(
            (yield* store
              .remove({
                ...location,
                worldRef: { ...location.worldRef, realm: "evaluation" },
              })
              .pipe(Effect.flip)).reason
          ).toBe("InvalidInput");
          expect(yield* store.read(location)).toStrictEqual(payload);
          yield* store.remove(location);
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "NotFound"
          );
          yield* store.remove(location);
        })
      )
  );

  it.live(
    "detects altered bytes and content type from the real object store",
    () =>
      withStorage(({ client, config }) =>
        Effect.gen(function* corruptedObject() {
          const store = yield* EvidenceObjectStore;
          const location = yield* store.stage(stageInput());
          const changed = Uint8Array.from(payload);
          changed[0] = 32;
          yield* sdk((signal) =>
            client.send(
              new PutObjectCommand({
                Body: changed,
                Bucket: config.bucket,
                ContentType: "application/json",
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "DigestMismatch"
          );
          yield* sdk((signal) =>
            client.send(
              new PutObjectCommand({
                Body: payload,
                Bucket: config.bucket,
                ContentType: "text/plain",
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "DigestMismatch"
          );
        })
      )
  );

  it.live(
    "keeps exact object versions when the bucket enables versioning",
    () =>
      withStorage(({ client, config }) =>
        Effect.gen(function* versionedObject() {
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
          const input = stageInput();
          const location = yield* store.stage(input);
          expect(location.versionId).not.toBeNull();
          expect(yield* store.locate(reservation(input))).toStrictEqual(
            location
          );
          const newer = new TextEncoder().encode('{"newer":true}');
          yield* sdk((signal) =>
            client.send(
              new PutObjectCommand({
                Body: newer,
                Bucket: config.bucket,
                ContentType: "application/json",
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          expect(yield* store.read(location)).toStrictEqual(payload);
          yield* store.remove(location);
          expect((yield* store.read(location).pipe(Effect.flip)).reason).toBe(
            "NotFound"
          );
          const current = yield* sdk((signal) =>
            client.send(
              new GetObjectCommand({
                Bucket: config.bucket,
                Key: location.key,
              }),
              { abortSignal: signal }
            )
          );
          const body = yield* Effect.fromNullishOr(current.Body);
          expect(yield* sdk(() => body.transformToByteArray())).toStrictEqual(
            newer
          );
        })
      )
  );

  it.live(
    "maps real authentication rejection to a closed error without secrets",
    () =>
      withStorage(({ config }) =>
        Effect.gen(function* deniedStorage() {
          const store = yield* EvidenceObjectStore;
          const location = yield* store.stage(stageInput());
          const deniedSecret = `invalid-${randomUUID()}`;
          const deniedConfig = {
            ...config,
            credentials: {
              ...config.credentials,
              secretAccessKey: Redacted.make(deniedSecret),
            },
          };
          const denied = yield* Effect.gen(
            function* readWithDeniedCredentials() {
              const deniedStore = yield* EvidenceObjectStore;
              return yield* deniedStore.read(location);
            }
          ).pipe(Effect.provide(layer(deniedConfig)), Effect.flip);
          expect(
            yield* Schema.encodeEffect(StorageFailure)(denied)
          ).toStrictEqual({
            _tag: "StorageFailure",
            reason: "Unavailable",
          });
          expect(denied.message).not.toContain(deniedSecret);
          expect(denied.message).not.toContain(location.key);
          const badClient = yield* createClient(deniedConfig);
          const status = yield* Effect.tryPromise({
            catch: (error) =>
              error instanceof S3ServiceException
                ? error.$metadata.httpStatusCode
                : undefined,
            try: (signal) =>
              badClient.send(
                new GetObjectCommand({
                  Bucket: config.bucket,
                  Key: location.key,
                }),
                { abortSignal: signal }
              ),
          }).pipe(Effect.flip);
          expect(status).toBe(403);
        })
      )
  );
});
