import { Effect, Schema } from "effect";
import type { FileSystem } from "effect/FileSystem";

import {
  planReleaseAlign,
  releaseAlignSteps,
} from "./all-in-one-release-align.ts";
import type {
  HostedInstallationFile,
  ReleaseAlignStep,
} from "./all-in-one-release-align.ts";

export class HostedReleaseAlignError extends Schema.TaggedError<HostedReleaseAlignError>()(
  "HostedReleaseAlignError",
  {
    code: Schema.Literals([
      "INVALID_INSTALLATION_FILE",
      "RUNTIME_ENV_MISSING_AUTHORITY",
      "RUNTIME_ENV_MALFORMED",
      "RESET_REQUIRED",
      "UNSUPPORTED_INSTALLATION_POLICY",
    ]),
  }
) {
  override get message(): string {
    return this.code;
  }
}

export type HostedReleaseAlignResult =
  | {
      readonly event: "all-in-one.bootstrap.release-reconciled";
      readonly releaseDigest: string;
    }
  | {
      readonly event: "all-in-one.bootstrap.release-aligned";
      readonly from: string;
      readonly to: string;
    };

/**
 * Marker-present same-release restart: reconcile worlds to the pinned
 * installation digest; optionally rewrite known ZA-03 legacy policy ids in
 * installation.json. Digest mismatch fails closed with RESET_REQUIRED —
 * never silent digest replacement (ZA-06).
 */
export const applyHostedReleaseAlign = (input: {
  readonly encodeInstallation: (
    value: HostedInstallationFile
  ) => Effect.Effect<string>;
  readonly fs: FileSystem;
  readonly installationPath: string;
  readonly reconcileWorlds: (
    step: Extract<ReleaseAlignStep, { readonly step: "reconcile-worlds" }>
  ) => Effect.Effect<void>;
  readonly releaseFile: string;
  readonly runtimeEnvPath: string;
}) =>
  Effect.gen(function* applyReleaseAlign() {
    const {
      encodeInstallation,
      fs,
      installationPath,
      reconcileWorlds,
      releaseFile,
      runtimeEnvPath,
    } = input;
    const plan = planReleaseAlign(
      yield* fs.readFileString(installationPath),
      yield* fs.readFile(releaseFile),
      yield* fs.readFileString(runtimeEnvPath)
    );
    if (plan.kind === "error") {
      return yield* new HostedReleaseAlignError({ code: plan.code });
    }
    let rewrittenFrom: string | null = null;
    for (const step of releaseAlignSteps(plan)) {
      if (step.step === "reconcile-worlds") {
        yield* reconcileWorlds(step);
        continue;
      }
      const { next, previousDigest } = step;
      const encoded = yield* encodeInstallation(next);
      const tmpPath = `${installationPath}.tmp`;
      if (yield* fs.exists(tmpPath)) {
        yield* fs.remove(tmpPath);
      }
      yield* fs.writeFileString(tmpPath, encoded, { flag: "wx", mode: 0o600 });
      yield* fs.rename(tmpPath, installationPath);
      rewrittenFrom = previousDigest;
    }
    if (rewrittenFrom === null) {
      return {
        event: "all-in-one.bootstrap.release-reconciled" as const,
        releaseDigest: plan.releaseDigest,
      };
    }
    return {
      event: "all-in-one.bootstrap.release-aligned" as const,
      from: rewrittenFrom,
      to: plan.releaseDigest,
    };
  });
