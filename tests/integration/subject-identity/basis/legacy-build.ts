import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { Schema } from "effect";

const revision = "06535bdcec668f62ba6d91d8ebb17e0235ed568b";
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

const ReleaseFile = Schema.Struct({
  path: Schema.String,
  sha256: Schema.String,
});
const BuildProof = Schema.Struct({
  format: Schema.Literal("zoen-identity-baseline-build-v1"),
  lock_sha256: Schema.String,
  release_sha256: Schema.String,
  revision: Schema.String,
  source_root: Schema.String,
  verified_release_files: Schema.Number,
});
const ReleaseManifest = Schema.Struct({
  files: Schema.Array(ReleaseFile).check(Schema.isMinLength(1)),
  format: Schema.Literal("zoen-local-build-v1"),
  lock_sha256: Schema.String,
});

/** Observes the isolated old executable; does not manufacture release admission. */
export const verifyLegacyBuild = async () => {
  const supplied = process.env.ZOEN_TEST_LEGACY_ROOT;
  assert.ok(
    supplied,
    "ZOEN_TEST_LEGACY_ROOT must identify a prepared legacy build (python3 tooling/prepare_identity_baseline.py --out .local/identity-baseline-…)"
  );
  assert.ok(path.isAbsolute(supplied), "Legacy root must be absolute");
  const root = await realpath(supplied);
  const proof = Schema.decodeUnknownSync(BuildProof)(
    JSON.parse(
      await readFile(path.resolve(root, "../build-proof.json"), "utf-8")
    )
  );
  assert.equal(proof.format, "zoen-identity-baseline-build-v1");
  assert.equal(proof.revision, revision);
  assert.equal(await realpath(proof.source_root), root);
  const releasePath = path.resolve(root, "apps/server/dist/release.json");
  const releaseBytes = await readFile(releasePath);
  const releaseDigest = digest(releaseBytes);
  assert.equal(releaseDigest, proof.release_sha256);
  const release = Schema.decodeUnknownSync(ReleaseManifest)(
    JSON.parse(releaseBytes.toString("utf-8"))
  );
  assert.equal(release.format, "zoen-local-build-v1");
  const lockDigest = digest(
    await readFile(path.resolve(root, "pnpm-lock.yaml"))
  );
  assert.equal(lockDigest, proof.lock_sha256);
  assert.equal(lockDigest, release.lock_sha256);
  const paths = new Set<string>();
  const verified = await Promise.all(
    release.files.map(async (entry) => {
      assert.equal(typeof entry.path, "string");
      assert.ok(!paths.has(entry.path), "Repeated release member");
      paths.add(entry.path);
      const file = await realpath(path.resolve(root, entry.path));
      const within = path.relative(root, file);
      assert.ok(
        within !== "" && !within.startsWith("..") && !path.isAbsolute(within)
      );
      const actual = digest(await readFile(file));
      assert.equal(actual, entry.sha256, entry.path);
      return entry.path;
    })
  );
  assert.ok(verified.includes("apps/server/dist/main.js"));
  assert.equal(paths.size, proof.verified_release_files);
  return {
    directory: path.dirname(root),
    lockDigest,
    releaseDigest,
    releasePath,
    revision,
    root,
    verifiedFiles: paths.size,
  };
};

export type LegacyBuild = Awaited<ReturnType<typeof verifyLegacyBuild>>;
