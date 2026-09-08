import {
  DeleteObjectCommand,
  GetObjectLegalHoldCommand,
  GetObjectRetentionCommand,
  ListMultipartUploadsCommand,
  ListObjectVersionsCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type {
  ErasureVersionEntry,
  ErasureVersionManifest,
  ErasureVersionPurgeOutcome,
} from "@zoen/contracts/erasure/values";
import { ErasureLimits } from "@zoen/contracts/erasure/values";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { ErasureObjectInventory } from "@zoen/ontology/ports/erasure/inventory";
import type {
  ErasureMultipartManifest,
  ErasureMultipartUpload,
} from "@zoen/ontology/ports/erasure/inventory";
import { ErasurePurgeStore } from "@zoen/ontology/ports/erasure/purge";
import type { ErasureVersionTarget } from "@zoen/ontology/ports/erasure/purge";
import { Clock, Context, Effect, Layer, Redacted } from "effect";

import { decodeConfig } from "../worlds/config.js";
import type { S3EvidenceConfig } from "../worlds/config.js";
import {
  isRealmErasureObjectKey,
  worldObjectInventoryPrefixes,
  worldObjectPrefix,
} from "./prefix.js";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });

const s3Name = (error: unknown): string => {
  if (!(error instanceof S3ServiceException)) {
    return "";
  }
  return `${error.name} ${error.message ?? ""}`;
};

const isNoSuch = (error: unknown) =>
  error instanceof S3ServiceException &&
  error.$metadata.httpStatusCode === 404 &&
  /NoSuchKey|NoSuchVersion|NoSuchObjectLock|ObjectLockConfigurationNotFound/iu.test(
    s3Name(error)
  );

const isAccessDenied = (error: unknown) =>
  error instanceof S3ServiceException &&
  (error.$metadata.httpStatusCode === 403 ||
    /AccessDenied|ObjectLocked/iu.test(s3Name(error)));

const isMissingHoldDoc = (error: unknown) =>
  error instanceof S3ServiceException &&
  (error.$metadata.httpStatusCode === 404 ||
    /NoSuchObjectLock|ObjectLockConfigurationNotFound|NoSuchKey|NoSuchVersion|retention/iu.test(
      s3Name(error)
    ));

/**
 * Preserve opaque VersionId strings exactly, including literal "null".
 * Unlike EvidenceObjectStore, never collapse "null" → omit/undefined.
 */
const requireVersionId = (versionId: string | undefined): string | null => {
  if (versionId === undefined || versionId.length === 0) {
    return null;
  }
  return versionId;
};

const entryOf = (input: {
  readonly key: string | undefined;
  readonly versionId: string | undefined;
  readonly deleteMarker: boolean;
  readonly isLatest: boolean | undefined;
}): ErasureVersionEntry | null => {
  const { key, deleteMarker, isLatest } = input;
  const versionId = requireVersionId(input.versionId);
  if (key === undefined || key.length === 0 || versionId === null) {
    return null;
  }
  return {
    deleteMarker,
    isLatest: isLatest === true,
    key,
    versionId,
  };
};

const cursorKey = (keyMarker: string, versionIdMarker: string | undefined) =>
  `${keyMarker}\u0000${versionIdMarker ?? ""}`;

export const layer = (
  configuration: S3EvidenceConfig
): Layer.Layer<ErasureObjectInventory | ErasurePurgeStore, Unavailable> =>
  Layer.effectContext(
    Effect.gen(function* erasureStorageLayer() {
      const config = yield* decodeConfig(configuration).pipe(
        Effect.mapError(() => unavailable())
      );
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

      const listPage = (
        prefix: string,
        keyMarker: string | undefined,
        versionIdMarker: string | undefined
      ) =>
        Effect.tryPromise({
          catch: unavailable,
          try: (signal) =>
            client.send(
              new ListObjectVersionsCommand({
                Bucket: config.bucket,
                MaxKeys: ErasureLimits.inventoryPageSize,
                Prefix: prefix,
                ...(keyMarker === undefined ? {} : { KeyMarker: keyMarker }),
                ...(versionIdMarker === undefined
                  ? {}
                  : { VersionIdMarker: versionIdMarker }),
              }),
              { abortSignal: signal }
            ),
        });

      const listPrefixVersions = (prefix: string) =>
        Effect.gen(function* listOnePrefix() {
          const entries: ErasureVersionEntry[] = [];
          let keyMarker: string | undefined;
          let versionIdMarker: string | undefined;
          const visited = new Set<string>();
          let page = 0;
          for (;;) {
            const response = yield* listPage(
              prefix,
              keyMarker,
              versionIdMarker
            );
            for (const version of response.Versions ?? []) {
              const entry = entryOf({
                deleteMarker: false,
                isLatest: version.IsLatest,
                key: version.Key,
                versionId: version.VersionId,
              });
              if (entry === null) {
                return yield* unavailable();
              }
              entries.push(entry);
            }
            for (const marker of response.DeleteMarkers ?? []) {
              const entry = entryOf({
                deleteMarker: true,
                isLatest: marker.IsLatest,
                key: marker.Key,
                versionId: marker.VersionId,
              });
              if (entry === null) {
                return yield* unavailable();
              }
              entries.push(entry);
            }
            if (response.IsTruncated !== true) {
              break;
            }
            if (response.NextKeyMarker === undefined) {
              return yield* unavailable();
            }
            const cursor = cursorKey(
              response.NextKeyMarker,
              response.NextVersionIdMarker
            );
            if (visited.has(cursor)) {
              return yield* unavailable();
            }
            visited.add(cursor);
            keyMarker = response.NextKeyMarker;
            versionIdMarker = response.NextVersionIdMarker;
            page += 1;
            if (page >= ErasureLimits.inventoryPagesPerPrefix) {
              return yield* unavailable();
            }
          }
          return entries;
        });

      const listWorldVersions = (worldRef: WorldRef) =>
        Effect.gen(function* listAllVersions() {
          if (worldRef.realm !== config.realm) {
            return yield* unavailable();
          }
          // Canonical worlds/ inventory only (no dual-read residual prefixes).
          const prefix = worldObjectPrefix(worldRef);
          const entries: ErasureVersionEntry[] = [];
          for (const inventoryPrefix of worldObjectInventoryPrefixes(
            worldRef
          )) {
            const page = yield* listPrefixVersions(inventoryPrefix);
            entries.push(...page);
          }
          const manifest: ErasureVersionManifest = { entries, prefix };
          return manifest;
        });

      const inspectHold = (target: ErasureVersionTarget) =>
        Effect.gen(function* inspectObjectHold() {
          if (!isRealmErasureObjectKey(target.key, config.realm)) {
            return yield* unavailable();
          }
          const legal = yield* Effect.tryPromise({
            catch: unavailable,
            try: async (signal) => {
              try {
                const response = await client.send(
                  new GetObjectLegalHoldCommand({
                    Bucket: config.bucket,
                    Key: target.key,
                    VersionId: target.versionId,
                  }),
                  { abortSignal: signal }
                );
                return response.LegalHold?.Status === "ON"
                  ? ("LegalHold" as const)
                  : ("continue" as const);
              } catch (error) {
                if (isMissingHoldDoc(error) || isNoSuch(error)) {
                  return "continue" as const;
                }
                return "Unknown" as const;
              }
            },
          });
          if (legal !== "continue") {
            return legal;
          }
          const nowMs = yield* Clock.currentTimeMillis;
          return yield* Effect.tryPromise({
            catch: unavailable,
            try: async (signal) => {
              try {
                const response = await client.send(
                  new GetObjectRetentionCommand({
                    Bucket: config.bucket,
                    Key: target.key,
                    VersionId: target.versionId,
                  }),
                  { abortSignal: signal }
                );
                const mode = response.Retention?.Mode;
                const until = response.Retention?.RetainUntilDate;
                if (
                  (mode === "GOVERNANCE" || mode === "COMPLIANCE") &&
                  until !== undefined &&
                  until.getTime() > nowMs
                ) {
                  return "Retention" as const;
                }
                return "Clear" as const;
              } catch (error) {
                if (isMissingHoldDoc(error) || isNoSuch(error)) {
                  return "Clear" as const;
                }
                return "Unknown" as const;
              }
            },
          });
        });

      const deleteExactVersion = (target: ErasureVersionTarget) =>
        Effect.tryPromise({
          catch: unavailable,
          try: async (signal) => {
            try {
              await client.send(
                new DeleteObjectCommand({
                  Bucket: config.bucket,
                  Key: target.key,
                  // Always set VersionId — including literal "null". Never omit.
                  VersionId: target.versionId,
                }),
                { abortSignal: signal }
              );
              return "Removed" as const satisfies ErasureVersionPurgeOutcome;
            } catch (error) {
              if (isNoSuch(error)) {
                return "AlreadyAbsent" as const satisfies ErasureVersionPurgeOutcome;
              }
              if (isAccessDenied(error)) {
                return "Blocked" as const satisfies ErasureVersionPurgeOutcome;
              }
              return "Unknown" as const satisfies ErasureVersionPurgeOutcome;
            }
          },
        });

      const purgeVersion = (target: ErasureVersionTarget) =>
        Effect.gen(function* purgeOneVersion() {
          if (
            target.versionId.length === 0 ||
            !isRealmErasureObjectKey(target.key, config.realm)
          ) {
            return yield* unavailable();
          }
          const hold = yield* inspectHold(target);
          if (
            hold === "Retention" ||
            hold === "LegalHold" ||
            hold === "Unknown"
          ) {
            return "Blocked" as const satisfies ErasureVersionPurgeOutcome;
          }
          return yield* deleteExactVersion(target);
        });

      const purgeManifest = (entries: readonly ErasureVersionEntry[]) =>
        Effect.gen(function* purgeAll() {
          const results: {
            readonly entry: ErasureVersionEntry;
            readonly outcome: ErasureVersionPurgeOutcome;
          }[] = [];
          for (const entry of entries) {
            const outcome = yield* purgeVersion({
              deleteMarker: entry.deleteMarker,
              key: entry.key,
              versionId: entry.versionId,
            });
            results.push({ entry, outcome });
          }
          return results;
        });

      const listMultipartPage = (
        prefix: string,
        keyMarker: string | undefined,
        uploadIdMarker: string | undefined
      ) =>
        Effect.tryPromise({
          catch: unavailable,
          try: (signal) =>
            client.send(
              new ListMultipartUploadsCommand({
                Bucket: config.bucket,
                MaxUploads: ErasureLimits.inventoryPageSize,
                Prefix: prefix,
                ...(keyMarker === undefined ? {} : { KeyMarker: keyMarker }),
                ...(uploadIdMarker === undefined
                  ? {}
                  : { UploadIdMarker: uploadIdMarker }),
              }),
              { abortSignal: signal }
            ),
        });

      const listWorldMultipartUploads = (worldRef: WorldRef) =>
        Effect.gen(function* listMultipart() {
          if (worldRef.realm !== config.realm) {
            return yield* unavailable();
          }
          const prefix = worldObjectPrefix(worldRef);
          const uploads: ErasureMultipartUpload[] = [];
          let keyMarker: string | undefined;
          let uploadIdMarker: string | undefined;
          const visited = new Set<string>();
          let page = 0;
          for (;;) {
            const response = yield* listMultipartPage(
              prefix,
              keyMarker,
              uploadIdMarker
            );
            for (const upload of response.Uploads ?? []) {
              if (
                upload.Key === undefined ||
                upload.Key.length === 0 ||
                upload.UploadId === undefined ||
                upload.UploadId.length === 0
              ) {
                return yield* unavailable();
              }
              if (!isRealmErasureObjectKey(upload.Key, config.realm)) {
                return yield* unavailable();
              }
              uploads.push({ key: upload.Key, uploadId: upload.UploadId });
            }
            if (response.IsTruncated !== true) {
              break;
            }
            // General-purpose / versioned buckets require both continuation markers;
            // KeyMarker-only pages can skip same-key uploads and falsely empty inventory.
            if (
              response.NextKeyMarker === undefined ||
              response.NextKeyMarker.length === 0 ||
              response.NextUploadIdMarker === undefined ||
              response.NextUploadIdMarker.length === 0
            ) {
              return yield* unavailable();
            }
            const cursor = `${response.NextKeyMarker}\u0000${response.NextUploadIdMarker}`;
            if (visited.has(cursor)) {
              return yield* unavailable();
            }
            visited.add(cursor);
            keyMarker = response.NextKeyMarker;
            uploadIdMarker = response.NextUploadIdMarker;
            page += 1;
            if (page >= ErasureLimits.inventoryPagesPerPrefix) {
              return yield* unavailable();
            }
          }
          const manifest: ErasureMultipartManifest = { prefix, uploads };
          return manifest;
        });

      const inventory = ErasureObjectInventory.of({
        listWorldMultipartUploads,
        listWorldVersions,
      });
      const purge = ErasurePurgeStore.of({
        inspectHold,
        purgeManifest,
        purgeVersion,
      });
      return Context.make(ErasureObjectInventory, inventory).pipe(
        Context.add(ErasurePurgeStore, purge)
      );
    })
  );
