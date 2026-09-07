import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Schema } from "effect";

import { digestReleaseBytes } from "../src/all-in-one-release-align.ts";
import type { ReleaseAlignStep } from "../src/all-in-one-release-align.ts";
import { applyHostedReleaseAlign } from "../src/all-in-one-release-apply.ts";

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const samplePolicy = { profileId: "d04-hosted-retained-v1" };

const withTempRoot = <A, E>(
  body: (paths: {
    readonly installationPath: string;
    readonly releaseFile: string;
    readonly runtimeEnvPath: string;
  }) => Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>
) =>
  Effect.gen(function* tempRoot() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "zoen-align-" });
    return yield* body({
      installationPath: path.join(root, "installation.json"),
      releaseFile: path.join(root, "release.json"),
      runtimeEnvPath: path.join(root, "runtime.env"),
    });
  }).pipe(Effect.scoped);

describe("applyHostedReleaseAlign workflow", () => {
  it.effect(
    "reconciles worlds then rewrites installation on digest change",
    () =>
      withTempRoot(({ installationPath, releaseFile, runtimeEnvPath }) =>
        Effect.gen(function* assertAlignWorkflow() {
          const fs = yield* FileSystem.FileSystem;
          const oldBytes = new TextEncoder().encode('{"format":"old"}\n');
          const newBytes = new TextEncoder().encode('{"format":"new"}\n');
          const oldDigest = digestReleaseBytes(oldBytes);
          const newDigest = digestReleaseBytes(newBytes);
          const installed = {
            installation: {
              cellEpoch: "1",
              cellId: "11111111-1111-4111-8111-111111111111",
              generationId: "22222222-2222-4222-8222-222222222222",
              releaseDigest: oldDigest,
            },
            policy: samplePolicy,
          };
          yield* fs.writeFileString(
            installationPath,
            yield* encodeJson(installed),
            { mode: 0o600 }
          );
          yield* fs.writeFileString(
            runtimeEnvPath,
            'ZOEN_AUTHORITY_DATABASE_URL="postgresql://auth@127.0.0.1/zoen"\n',
            { mode: 0o600 }
          );
          yield* fs.writeFile(releaseFile, newBytes);

          const reconciled: ReleaseAlignStep[] = [];
          const result = yield* applyHostedReleaseAlign({
            encodeInstallation: (value) => encodeJson(value).pipe(Effect.orDie),
            fs,
            installationPath,
            reconcileWorlds: (step) =>
              Effect.sync(() => {
                reconciled.push(step);
              }),
            releaseFile,
            runtimeEnvPath,
          });

          expect(reconciled).toHaveLength(1);
          expect(reconciled[0]).toMatchObject({
            releaseDigest: newDigest,
            step: "reconcile-worlds",
          });
          expect(result).toStrictEqual({
            event: "all-in-one.bootstrap.release-aligned",
            from: oldDigest,
            to: newDigest,
          });
          const rewrittenText = yield* fs.readFileString(installationPath);
          const rewritten = yield* Schema.decodeEffect(
            Schema.fromJsonString(
              Schema.Struct({
                installation: Schema.Struct({
                  releaseDigest: Schema.String,
                }),
              })
            )
          )(rewrittenText);
          expect(rewritten.installation.releaseDigest).toBe(newDigest);
        })
      ).pipe(
        Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
      )
  );

  it.effect("reconciles worlds without rewrite when installation matches", () =>
    withTempRoot(({ installationPath, releaseFile, runtimeEnvPath }) =>
      Effect.gen(function* assertReconcileOnly() {
        const fs = yield* FileSystem.FileSystem;
        const bytes = new TextEncoder().encode('{"format":"same"}\n');
        const digest = digestReleaseBytes(bytes);
        const installed = {
          installation: {
            cellEpoch: "1",
            cellId: "11111111-1111-4111-8111-111111111111",
            generationId: "22222222-2222-4222-8222-222222222222",
            releaseDigest: digest,
          },
          policy: samplePolicy,
        };
        const installationText = yield* encodeJson(installed);
        yield* fs.writeFileString(installationPath, installationText);
        yield* fs.writeFileString(
          runtimeEnvPath,
          'ZOEN_AUTHORITY_DATABASE_URL="postgresql://auth@127.0.0.1/zoen"\n'
        );
        yield* fs.writeFile(releaseFile, bytes);

        const reconciled: string[] = [];
        const result = yield* applyHostedReleaseAlign({
          encodeInstallation: (value) => encodeJson(value).pipe(Effect.orDie),
          fs,
          installationPath,
          reconcileWorlds: (step) =>
            Effect.sync(() => {
              reconciled.push(step.releaseDigest);
            }),
          releaseFile,
          runtimeEnvPath,
        });
        expect(reconciled).toStrictEqual([digest]);
        expect(result).toStrictEqual({
          event: "all-in-one.bootstrap.release-reconciled",
          releaseDigest: digest,
        });
        expect(yield* fs.readFileString(installationPath)).toBe(
          installationText
        );
      })
    ).pipe(Effect.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)))
  );
});
