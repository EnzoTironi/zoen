import { Effect, Schema } from "effect";
import type { FileSystem } from "effect/FileSystem";

import {
  planReleaseAlign,
  releaseAlignSteps,
} from "./all-in-one-release-align.ts";
import type { ReleaseAlignStep } from "./all-in-one-release-align.ts";

export class HostedReleaseAlignError extends Schema.TaggedError<HostedReleaseAlignError>()(
  "HostedReleaseAlignError",
  {
    code: Schema.Literals([
      "INVALID_INSTALLATION_FILE",
      "RUNTIME_ENV_MISSING_AUTHORITY",
      "RUNTIME_ENV_MALFORMED",
      "RESET_REQUIRED",
    ]),
  }
) {
  override get message(): string {
    return this.code;
  }
}

export interface HostedReleaseAlignResult {
  readonly event: "all-in-one.bootstrap.release-reconciled";
  readonly releaseDigest: string;
}

/**
 * Marker-present same-release restart: reconcile worlds to the pinned
 * installation digest. Digest mismatch fails closed with RESET_REQUIRED —
 * never rewrite installation.json (ZA-06).
 */
export const applyHostedReleaseAlign = (input: {
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
    for (const step of releaseAlignSteps(plan)) {
      yield* reconcileWorlds(step);
    }
    return {
      event: "all-in-one.bootstrap.release-reconciled" as const,
      releaseDigest: plan.releaseDigest,
    };
  });
