import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import {
  CaptureId,
  EvidenceObjectStore,
  ObjectLocation,
  StorageFailure,
} from "@zoen/authority/ports/d01/storage";
import type { DocumentStageInput } from "@zoen/authority/ports/d01/storage";
import { digestBytes } from "@zoen/authority/values/canonical";
import {
  D01_LIMITS,
  Digest,
  DocumentFormat,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import { Context, Data, Effect, Layer, Redacted, Schema, Stream } from "effect";

import { collectExactBytes } from "./bytes.js";
import { decodeConfig } from "./config.js";
import type { S3EvidenceConfig } from "./config.js";
import { S3Health } from "./health.ts";

export type { S3EvidenceConfig } from "./config.js";

const unavailable = () => new StorageFailure({ reason: "Unavailable" });
const invalid = () => new StorageFailure({ reason: "InvalidInput" });
const mismatch = () => new StorageFailure({ reason: "DigestMismatch" });

const storageError = (error: unknown) =>
  error instanceof S3ServiceException &&
  error.$metadata.httpStatusCode === 404 &&
  (error.name === "NoSuchKey" || error.name === "NoSuchVersion")
    ? new StorageFailure({ reason: "NotFound" })
    : unavailable();

class ObjectExists extends Data.TaggedError("ObjectExists") {}
const putError = (error: unknown) =>
  error instanceof S3ServiceException && error.$metadata.httpStatusCode === 412
    ? new ObjectExists()
    : storageError(error);

const CaptureExpectation = Schema.Struct({
  captureId: CaptureId,
  expectedBytes: Schema.Int.check(
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(D01_LIMITS.documentBytes)
  ),
  expectedDigest: Digest,
  worldRef: WorldRef,
}).annotate(exact);

const DocumentExpectation = Schema.Struct({
  ...CaptureExpectation.fields,
  documentFormat: DocumentFormat,
}).annotate(exact);
const mediaType = (format: DocumentFormat | undefined) =>
  format === "d01.csv.v1" ? "text/csv" : "application/json";

const keyFor = (world: WorldRef, capture: CaptureId) =>
  `d01/${world.realm}/${world.worldId.toLowerCase()}/captures/${capture.toLowerCase()}`;
const version = (versionId: string | undefined) =>
  versionId === undefined || versionId === "null" ? null : versionId;

const validateLocation = (location: ObjectLocation) =>
  Schema.decodeEffect(ObjectLocation)(location).pipe(
    Effect.mapError(invalid),
    Effect.filterOrFail(
      (decoded) =>
        decoded.worldRef.realm === "live" &&
        decoded.key === keyFor(decoded.worldRef, decoded.captureId),
      invalid
    )
  );

/** Real S3 only. The bucket must already exist; the layer never creates infrastructure. */
export const layer = (
  configuration: S3EvidenceConfig
): Layer.Layer<EvidenceObjectStore | S3Health, StorageFailure> =>
  Layer.effectContext(
    Effect.gen(function* s3EvidenceLayer() {
      const config = yield* decodeConfig(configuration);
      const client = yield* Effect.acquireRelease(
        Effect.try({
          catch: unavailable,
          try: () =>
            new S3Client({
              credentials: {
                accessKeyId: Redacted.value(config.credentials.accessKeyId),
                secretAccessKey: Redacted.value(
                  config.credentials.secretAccessKey
                ),
              },
              endpoint: config.endpoint.href,
              forcePathStyle: config.forcePathStyle,
              maxAttempts: 1,
              region: config.region,
              requestHandler: {
                connectionTimeout: config.connectionTimeoutMillis,
                requestTimeout: config.requestTimeoutMillis,
              },
            }),
        }),
        (resource) =>
          Effect.sync(() => {
            resource.destroy();
          })
      );

      const retrieve = (location: ObjectLocation) =>
        Effect.gen(function* retrieveExactObject() {
          const response = yield* Effect.tryPromise({
            catch: storageError,
            try: (signal) =>
              client.send(
                new GetObjectCommand({
                  Bucket: config.bucket,
                  Key: location.key,
                  VersionId: location.versionId ?? undefined,
                }),
                { abortSignal: signal }
              ),
          });
          if (response.Body === undefined) {
            return yield* unavailable();
          }
          const body = yield* Effect.try({
            catch: unavailable,
            try: () => response.Body?.transformToWebStream(),
          });
          if (body === undefined) {
            return yield* unavailable();
          }
          const result = yield* Effect.acquireUseRelease(
            Effect.succeed(body),
            (readable) =>
              Effect.gen(function* readBoundedObject() {
                if (
                  response.ContentLength !== location.byteLength ||
                  response.ContentType !== mediaType(location.documentFormat) ||
                  (location.versionId !== null &&
                    response.VersionId !== location.versionId)
                ) {
                  return yield* mismatch();
                }
                const content = Stream.fromReadableStream<
                  unknown,
                  StorageFailure
                >({
                  evaluate: () => readable,
                  onError: unavailable,
                }).pipe(
                  Stream.mapEffect((chunk) =>
                    Schema.decodeUnknownEffect(Schema.Uint8Array)(chunk).pipe(
                      Effect.mapError(unavailable)
                    )
                  )
                );
                const data = yield* collectExactBytes(
                  content,
                  location.byteLength,
                  "DigestMismatch"
                );
                if (digestBytes(data) !== location.digest) {
                  return yield* mismatch();
                }
                return data;
              }),
            (readable) =>
              readable.locked
                ? Effect.void
                : Effect.tryPromise({
                    catch: unavailable,
                    try: () => readable.cancel(),
                  }).pipe(Effect.ignore)
          );
          return { bytes: result, versionId: version(response.VersionId) };
        });

      const validateExpectation = (input: typeof CaptureExpectation.Type) =>
        Schema.decodeEffect(CaptureExpectation)(input).pipe(
          Effect.mapError(invalid),
          Effect.filterOrFail(
            (metadata) => metadata.worldRef.realm === config.realm,
            invalid
          )
        );

      const targetFor = (
        metadata: typeof CaptureExpectation.Type,
        documentFormat?: DocumentFormat
      ): ObjectLocation => ({
        byteLength: metadata.expectedBytes,
        captureId: metadata.captureId,
        digest: metadata.expectedDigest,
        ...(documentFormat === undefined ? {} : { documentFormat }),
        key: keyFor(metadata.worldRef, metadata.captureId),
        versionId: null,
        worldRef: metadata.worldRef,
      });

      const stage = (
        input: Omit<DocumentStageInput, "documentFormat">,
        documentFormat?: DocumentFormat
      ) =>
        Effect.gen(function* stageExactObject() {
          const metadata = yield* validateExpectation({
            captureId: input.captureId,
            expectedBytes: input.expectedBytes,
            expectedDigest: input.expectedDigest,
            worldRef: input.worldRef,
          });
          const content = yield* collectExactBytes(
            input.content,
            metadata.expectedBytes,
            "InvalidInput"
          );
          if (digestBytes(content) !== metadata.expectedDigest) {
            return yield* mismatch();
          }
          const location = targetFor(metadata, documentFormat);
          const storedVersion = yield* Effect.tryPromise({
            catch: putError,
            try: (signal) =>
              client.send(
                new PutObjectCommand({
                  Body: content,
                  Bucket: config.bucket,
                  ChecksumSHA256: Buffer.from(
                    metadata.expectedDigest,
                    "hex"
                  ).toString("base64"),
                  ContentLength: content.byteLength,
                  ContentType: mediaType(documentFormat),
                  IfNoneMatch: "*",
                  Key: location.key,
                }),
                { abortSignal: signal }
              ),
          }).pipe(
            Effect.map((response) => version(response.VersionId)),
            Effect.catchTag("ObjectExists", () => Effect.succeed(null))
          );
          // Includes 412 recovery: success requires complete current/versioned bytes, never metadata alone.
          const observed = yield* retrieve({
            ...location,
            versionId: storedVersion,
          });
          return yield* Schema.decodeEffect(ObjectLocation)({
            ...location,
            versionId: observed.versionId,
          }).pipe(Effect.mapError(unavailable));
        });
      const locate = (
        metadata: typeof CaptureExpectation.Type,
        documentFormat?: DocumentFormat
      ) =>
        Effect.gen(function* locateUnconfirmedCapture() {
          const target = targetFor(metadata, documentFormat);
          const observed = yield* retrieve(target);
          return yield* Schema.decodeEffect(ObjectLocation)({
            ...target,
            versionId: observed.versionId,
          }).pipe(Effect.mapError(unavailable));
        });
      const validateDocument = (input: typeof DocumentExpectation.Type) =>
        Schema.decodeEffect(DocumentExpectation)(input).pipe(
          Effect.mapError(invalid),
          Effect.filterOrFail(
            (metadata) => metadata.worldRef.realm === config.realm,
            invalid
          )
        );
      const store = EvidenceObjectStore.of({
        locate: (input) =>
          validateExpectation(input).pipe(
            Effect.flatMap((metadata) => locate(metadata))
          ),
        locateDocument: (input) =>
          validateDocument(input).pipe(
            Effect.flatMap((metadata) =>
              locate(metadata, metadata.documentFormat)
            )
          ),
        read: (location) =>
          validateLocation(location).pipe(
            Effect.flatMap(retrieve),
            Effect.map((result) => result.bytes)
          ),
        remove: (location) =>
          validateLocation(location).pipe(
            Effect.flatMap((validated) =>
              Effect.tryPromise({
                catch: storageError,
                try: (signal) =>
                  client.send(
                    new DeleteObjectCommand({
                      Bucket: config.bucket,
                      Key: validated.key,
                      VersionId: validated.versionId ?? undefined,
                    }),
                    { abortSignal: signal }
                  ),
              })
            ),
            Effect.asVoid
          ),
        stage: (input) => stage(input),
        stageDocument: ({ content, ...input }) =>
          validateDocument(input).pipe(
            Effect.flatMap((metadata) =>
              stage({ ...metadata, content }, metadata.documentFormat)
            )
          ),
      });
      const check = Effect.gen(function* checkVersionedBucket() {
        yield* Effect.tryPromise({
          catch: unavailable,
          try: (signal) =>
            client.send(new HeadBucketCommand({ Bucket: config.bucket }), {
              abortSignal: signal,
            }),
        });
        const versioning = yield* Effect.tryPromise({
          catch: unavailable,
          try: (signal) =>
            client.send(
              new GetBucketVersioningCommand({ Bucket: config.bucket }),
              { abortSignal: signal }
            ),
        });
        if (versioning.Status !== "Enabled") {
          return yield* unavailable();
        }
        return null;
      }).pipe(Effect.asVoid);
      return Context.make(EvidenceObjectStore, store).pipe(
        Context.add(S3Health, S3Health.of({ check }))
      );
    })
  );
