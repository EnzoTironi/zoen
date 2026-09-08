import { Effect, Schema } from "effect";
import type { FileSystem } from "effect/FileSystem";

import {
  hostedReleaseRestartOrder,
  planReleaseAlign,
  releaseAlignSteps,
} from "./all-in-one-release-align.ts";
import type {
  HostedInstallationFile,
  PlanReleaseAlignOptions,
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
 * Marker-present restart: reconcile worlds to the image release digest;
 * optionally rewrite ZA-03 legacy policy ids and/or an explicitly admitted tip
 * releaseDigest upgrade. Digest mismatch without admission fails closed with
 * RESET_REQUIRED (ZA-06 — never silent).
 */
export const applyHostedReleaseAlign = (input: {
  readonly admitHostedReleaseUpgrade?: boolean;
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
  readonly volumeGate?: PlanReleaseAlignOptions["volumeGate"];
}) =>
  Effect.gen(function* applyReleaseAlign() {
    const {
      admitHostedReleaseUpgrade,
      encodeInstallation,
      fs,
      installationPath,
      reconcileWorlds,
      releaseFile,
      runtimeEnvPath,
      volumeGate,
    } = input;
    const planOptions: PlanReleaseAlignOptions = {
      ...(admitHostedReleaseUpgrade === true
        ? { admitHostedReleaseUpgrade: true }
        : {}),
      ...(volumeGate === undefined ? {} : { volumeGate }),
    };
    const plan = planReleaseAlign(
      yield* fs.readFileString(installationPath),
      yield* fs.readFile(releaseFile),
      yield* fs.readFileString(runtimeEnvPath),
      planOptions
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

/**
 * Testable ZA-08 / tip-upgrade orchestration: migrate-then-align for admitted
 * upgrades, align-then-migrate for same-release restarts. Bootstrap must call
 * this (or preserve the same order) so ordering regressions fail unit tests.
 */
export const runHostedReleaseRestartSeams = <EA, EM, EB, EC, R>(input: {
  readonly align: () => Effect.Effect<void, EA, R>;
  readonly beginUpgrade?: () => Effect.Effect<void, EB, R>;
  readonly completeUpgrade?: () => Effect.Effect<void, EC, R>;
  readonly migrate: () => Effect.Effect<void, EM, R>;
  readonly releaseUpgrade: boolean;
}): Effect.Effect<void, EA | EM | EB | EC, R> =>
  Effect.gen(function* hostedReleaseRestartSeams() {
    for (const step of hostedReleaseRestartOrder(input.releaseUpgrade)) {
      if (step === "migrate-schema") {
        if (input.releaseUpgrade && input.beginUpgrade !== undefined) {
          yield* input.beginUpgrade();
        }
        yield* input.migrate();
        continue;
      }
      yield* input.align();
      if (input.releaseUpgrade && input.completeUpgrade !== undefined) {
        yield* input.completeUpgrade();
      }
    }
  });
