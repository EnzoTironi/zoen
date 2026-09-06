import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const revision = "06535bdcec668f62ba6d91d8ebb17e0235ed568b";
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Observes the isolated old executable; does not manufacture release admission. */
export async function verifyLegacyBuild() {
  const fallback =
    "/Users/enzotironi/zoen-rebuild/.local/identity-baseline-20260905-2203/source";
  const supplied = process.env.ZOEN_TEST_LEGACY_ROOT ?? fallback;
  assert(supplied, "ZOEN_TEST_LEGACY_ROOT must identify a prepared legacy build");
  assert(isAbsolute(supplied), "Legacy root must be absolute");
  const root = await realpath(supplied);
  const proof = JSON.parse(
    await readFile(resolve(root, "../build-proof.json"), "utf8")
  );
  assert.equal(proof.format, "zoen-identity-baseline-build-v1");
  assert.equal(proof.revision, revision);
  assert.equal(await realpath(proof.source_root), root);
  const releasePath = resolve(root, "apps/server/dist/release.json");
  const releaseBytes = await readFile(releasePath);
  const releaseDigest = digest(releaseBytes);
  assert.equal(releaseDigest, proof.release_sha256);
  const release = JSON.parse(releaseBytes.toString("utf8"));
  assert.equal(release.format, "zoen-local-build-v1");
  const lockDigest = digest(await readFile(resolve(root, "pnpm-lock.yaml")));
  assert.equal(lockDigest, proof.lock_sha256);
  assert.equal(lockDigest, release.lock_sha256);
  assert(Array.isArray(release.files) && release.files.length > 0);
  const paths = new Set<string>();
  for (const entry of release.files) {
    assert.equal(typeof entry.path, "string");
    assert(!paths.has(entry.path), "Repeated release member");
    paths.add(entry.path);
    const file = await realpath(resolve(root, entry.path));
    const within = relative(root, file);
    assert(within !== "" && !within.startsWith("..") && !isAbsolute(within));
    assert.equal(digest(await readFile(file)), entry.sha256, entry.path);
  }
  assert(paths.has("apps/server/dist/main.js"));
  assert.equal(paths.size, proof.verified_release_files);
  return {
    directory: dirname(root),
    lockDigest,
    releaseDigest,
    releasePath,
    revision,
    root,
    verifiedFiles: paths.size,
  };
}

export type LegacyBuild = Awaited<ReturnType<typeof verifyLegacyBuild>>;
