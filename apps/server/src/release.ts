import { fileURLToPath } from "node:url";

import { Digest, exact } from "@zoen/contracts/worlds/values";
import { digestBytes } from "@zoen/ontology/values/canonical";
import { parseJsonBytes } from "@zoen/ontology/values/json";
import { Effect, FileSystem, Schema } from "effect";

const ReleaseManifest = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({ path: Schema.String, sha256: Digest }).annotate(exact)
  ),
  format: Schema.Literal("zoen-local-build-v1"),
  lock_sha256: Digest,
}).annotate(exact);

export class ReleaseMismatch extends Schema.TaggedError<ReleaseMismatch>()(
  "ReleaseMismatch",
  {}
) {}

/** Verify the actual bytes loaded by Node and served to the browser before opening any runtime pool. */
export const verifyRelease = Effect.gen(function* verifyExecutableRelease() {
  const fs = yield* FileSystem.FileSystem;
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const manifestBytes = yield* fs.readFile(
    fileURLToPath(new URL("release.json", import.meta.url))
  );
  const manifest = yield* parseJsonBytes(manifestBytes, 1_048_576).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(ReleaseManifest))
  );
  if (
    manifest.files.length === 0 ||
    digestBytes(yield* fs.readFile(`${root}pnpm-lock.yaml`)) !==
      manifest.lock_sha256
  ) {
    return yield* new ReleaseMismatch();
  }
  const seen = new Set<string>();
  for (const entry of manifest.files) {
    const parts = entry.path.split("/");
    if (
      seen.has(entry.path) ||
      parts.some((part) => part === ".." || part === "." || part === "") ||
      !/^(?:packages\/(?:contracts|authority)|apps\/(?:server|cli|web))\/(?:dist\/|package\.json$)/u.test(
        entry.path
      ) ||
      entry.path.includes("\\")
    ) {
      return yield* new ReleaseMismatch();
    }
    seen.add(entry.path);
    if (
      digestBytes(yield* fs.readFile(`${root}${entry.path}`)) !== entry.sha256
    ) {
      return yield* new ReleaseMismatch();
    }
  }
  return digestBytes(manifestBytes);
});
