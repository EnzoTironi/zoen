import { createHash } from "node:crypto";

/** SHA-256 of release.json bytes — same digest verifyRelease / bootstrap mint. */
export const digestReleaseBytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

export interface HostedInstallationFile {
  readonly installation: {
    readonly cellEpoch: string;
    readonly cellId: string;
    readonly generationId: string;
    readonly releaseDigest: string;
  };
  readonly policy: unknown;
}

/** Admitted install policy profile ids after ZA-03 (no dual-read). */
const CURRENT_POLICY_PROFILE_IDS = new Set([
  "worlds-local-retained-v1",
  "worlds-local-erasable-v1",
  "worlds-hosted-retained-v1",
]);

/**
 * One-shot pre-launch delivery→descriptive rewrite for known persisted
 * installation.json policy literals. Unknown ids fail closed — no shim.
 */
const LEGACY_POLICY_PROFILE_IDS: Readonly<Record<string, string>> = {
  "d03-local-erasable-v1": "worlds-local-erasable-v1",
  "d04-hosted-retained-v1": "worlds-hosted-retained-v1",
};

export type HostedPolicyAlignResult =
  | { readonly kind: "unchanged"; readonly policy: unknown }
  | {
      readonly from: string;
      readonly kind: "rewritten";
      readonly policy: unknown;
      readonly to: string;
    }
  | {
      readonly code: "UNSUPPORTED_INSTALLATION_POLICY";
      readonly kind: "error";
    };

/**
 * Rewrite known ZA-03 legacy profileId literals on installation.json policy.
 * Current ids pass through; unknown ids fail closed (no product dual-read).
 */
export const alignHostedInstallationPolicy = (
  policy: unknown
): HostedPolicyAlignResult => {
  if (
    typeof policy !== "object" ||
    policy === null ||
    !("profileId" in policy)
  ) {
    return { code: "UNSUPPORTED_INSTALLATION_POLICY", kind: "error" };
  }
  const profileId: unknown = Reflect.get(policy, "profileId");
  if (typeof profileId !== "string") {
    return { code: "UNSUPPORTED_INSTALLATION_POLICY", kind: "error" };
  }
  if (CURRENT_POLICY_PROFILE_IDS.has(profileId)) {
    return { kind: "unchanged", policy };
  }
  const nextId = LEGACY_POLICY_PROFILE_IDS[profileId];
  if (nextId === undefined) {
    return { code: "UNSUPPORTED_INSTALLATION_POLICY", kind: "error" };
  }
  return {
    from: profileId,
    kind: "rewritten",
    policy: { ...policy, profileId: nextId },
    to: nextId,
  };
};

/**
 * Pure projection of an installation onto a target release digest.
 * ZA-06: automatic bootstrap must NOT apply this on mismatch unless
 * {@link planReleaseAlign} was called with admitHostedReleaseUpgrade.
 * Without admission, planReleaseAlign returns RESET_REQUIRED. Kept for
 * explicit admitted tooling / tests that assert cell/generation preservation.
 */
export const alignInstallationRelease = (
  installed: HostedInstallationFile,
  releaseDigest: string
): { readonly changed: boolean; readonly next: HostedInstallationFile } => {
  if (installed.installation.releaseDigest === releaseDigest) {
    return { changed: false, next: installed };
  }
  return {
    changed: true,
    next: {
      installation: {
        cellEpoch: installed.installation.cellEpoch,
        cellId: installed.installation.cellId,
        generationId: installed.installation.generationId,
        releaseDigest,
      },
      policy: installed.policy,
    },
  };
};

/** Parse KEY="value" lines written by all-in-one bootstrap (no escapes). */
export const parseQuotedEnvFile = (
  text: string
): Record<string, string> | null => {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      return null;
    }
    const key = line.slice(0, eq);
    const raw = line.slice(eq + 1);
    if (
      raw.length < 2 ||
      raw.at(0) !== '"' ||
      raw.at(-1) !== '"' ||
      /[\r\n\\]/u.test(raw.slice(1, -1))
    ) {
      return null;
    }
    out[key] = raw.slice(1, -1);
  }
  return out;
};

const readStringField = (record: object, key: string): string | undefined => {
  if (!(key in record)) {
    return undefined;
  }
  const value: unknown = Reflect.get(record, key);
  return typeof value === "string" ? value : undefined;
};

/** Narrow volume installation.json without Schema (bootstrap strip-types path). */
export const parseHostedInstallationFile = (
  value: unknown
): HostedInstallationFile | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if (!("installation" in value) || !("policy" in value)) {
    return null;
  }
  const { installation, policy } = value;
  if (typeof installation !== "object" || installation === null) {
    return null;
  }
  const cellEpoch = readStringField(installation, "cellEpoch");
  const cellId = readStringField(installation, "cellId");
  const generationId = readStringField(installation, "generationId");
  const releaseDigest = readStringField(installation, "releaseDigest");
  if (
    cellEpoch === undefined ||
    cellId === undefined ||
    generationId === undefined ||
    releaseDigest === undefined
  ) {
    return null;
  }
  return {
    installation: { cellEpoch, cellId, generationId, releaseDigest },
    policy,
  };
};

export type ReleaseAlignPlan =
  | {
      readonly authorityUrl: string;
      readonly cellId: string;
      readonly generationId: string;
      readonly kind: "ready";
      readonly releaseDigest: string;
      /**
       * When set, this plan upgrades installation.releaseDigest to the image
       * digest (Pre-launch tip continuous-deploy admission). Bootstrap must
       * run ZA-08 schema migrate BEFORE applying this rewrite.
       */
      readonly releaseUpgrade?: true;
      /**
       * Installation rewrite: same-release ZA-03 policy ids, and/or an
       * admitted tip releaseDigest upgrade. Digest mismatch without admission
       * never reaches ready (ZA-06 RESET_REQUIRED).
       */
      readonly rewriteInstallation: {
        readonly next: HostedInstallationFile;
        readonly previousDigest: string;
      } | null;
    }
  | {
      readonly code:
        | "INVALID_INSTALLATION_FILE"
        | "RUNTIME_ENV_MISSING_AUTHORITY"
        | "RUNTIME_ENV_MALFORMED"
        | "RESET_REQUIRED"
        | "UNSUPPORTED_INSTALLATION_POLICY";
      readonly kind: "error";
      /** Present when code is RESET_REQUIRED — installed vs image digests. */
      readonly installedDigest?: string;
      readonly releaseDigest?: string;
    };

export type ReleaseAlignStep =
  | {
      readonly authorityUrl: string;
      readonly cellId: string;
      readonly generationId: string;
      readonly releaseDigest: string;
      readonly step: "reconcile-worlds";
    }
  | {
      readonly next: HostedInstallationFile;
      readonly previousDigest: string;
      readonly step: "rewrite-installation";
    };

/**
 * Ordered side effects for a ready plan. Worlds reconcile always runs first.
 * Optional installation rewrite may be ZA-03 policy-only or an admitted tip
 * releaseDigest upgrade. Digest mismatch without admission never reaches ready.
 */
export const releaseAlignSteps = (
  plan: Extract<ReleaseAlignPlan, { readonly kind: "ready" }>
): readonly ReleaseAlignStep[] => {
  const steps: ReleaseAlignStep[] = [
    {
      authorityUrl: plan.authorityUrl,
      cellId: plan.cellId,
      generationId: plan.generationId,
      releaseDigest: plan.releaseDigest,
      step: "reconcile-worlds",
    },
  ];
  if (plan.rewriteInstallation !== null) {
    steps.push({
      next: plan.rewriteInstallation.next,
      previousDigest: plan.rewriteInstallation.previousDigest,
      step: "rewrite-installation",
    });
  }
  return steps;
};

/** Durable volume gate for tip release upgrades (fail-closed). */
export interface HostedReleaseUpgradeInProgress {
  readonly fromDigest: string;
  readonly toDigest: string;
}

export interface HostedReleaseVolumeGate {
  /** Digests that successfully owned this volume (blocks rollback admission). */
  readonly completedDigests: readonly string[];
  /** Set before migrate; cleared only after installation rewrite succeeds. */
  readonly inProgress: HostedReleaseUpgradeInProgress | null;
}

export const emptyHostedReleaseUpgradeGate = (): HostedReleaseVolumeGate => ({
  completedDigests: [],
  inProgress: null,
});

export const parseHostedReleaseUpgradeGate = (
  text: string
): HostedReleaseVolumeGate | null => {
  let unknown: unknown;
  try {
    unknown = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof unknown !== "object" || unknown === null) {
    return null;
  }
  if (!("completedDigests" in unknown) || !("inProgress" in unknown)) {
    return null;
  }
  const completedRaw: unknown = Reflect.get(unknown, "completedDigests");
  if (!Array.isArray(completedRaw)) {
    return null;
  }
  const completedDigests: string[] = [];
  for (const entry of completedRaw) {
    if (typeof entry !== "string" || entry.length === 0) {
      return null;
    }
    completedDigests.push(entry);
  }
  const inProgressRaw: unknown = Reflect.get(unknown, "inProgress");
  if (inProgressRaw === null) {
    return { completedDigests, inProgress: null };
  }
  if (typeof inProgressRaw !== "object" || inProgressRaw === null) {
    return null;
  }
  const fromDigest = readStringField(inProgressRaw, "fromDigest");
  const toDigest = readStringField(inProgressRaw, "toDigest");
  if (fromDigest === undefined || toDigest === undefined) {
    return null;
  }
  return {
    completedDigests,
    inProgress: { fromDigest, toDigest },
  };
};

export const encodeHostedReleaseUpgradeGate = (
  gate: HostedReleaseVolumeGate
): string => `${JSON.stringify(gate)}\n`;

export const beginHostedReleaseUpgrade = (
  gate: HostedReleaseVolumeGate,
  fromDigest: string,
  toDigest: string
): HostedReleaseVolumeGate => ({
  completedDigests: gate.completedDigests.includes(fromDigest)
    ? gate.completedDigests
    : [...gate.completedDigests, fromDigest],
  inProgress: { fromDigest, toDigest },
});

export const completeHostedReleaseUpgrade = (
  gate: HostedReleaseVolumeGate,
  toDigest: string
): HostedReleaseVolumeGate => ({
  completedDigests: gate.completedDigests.includes(toDigest)
    ? gate.completedDigests
    : [...gate.completedDigests, toDigest],
  inProgress: null,
});

export const noteHostedReleaseDigest = (
  gate: HostedReleaseVolumeGate,
  digest: string
): HostedReleaseVolumeGate =>
  gate.completedDigests.includes(digest)
    ? gate
    : {
        completedDigests: [...gate.completedDigests, digest],
        inProgress: gate.inProgress,
      };

/**
 * Fixed ZA-08 / ZA-06 seam order. Admitted tip upgrades migrate before align;
 * same-release restarts align (digest admission) then migrate.
 */
export const hostedReleaseRestartOrder = (
  releaseUpgrade: boolean
): readonly ("migrate-schema" | "align-release")[] =>
  releaseUpgrade
    ? ["migrate-schema", "align-release"]
    : ["align-release", "migrate-schema"];

export interface PlanReleaseAlignOptions {
  /**
   * Pre-launch tip continuous-deploy admission (AGENTS.md Evolution). When
   * true, a different image releaseDigest plans a controlled upgrade instead
   * of RESET_REQUIRED. Default false — ZA-06 fail-closed.
   */
  readonly admitHostedReleaseUpgrade?: boolean;
  /**
   * Volume-local upgrade gate. Refuses rollbacks onto digests that already
   * completed ownership, and refuses any image other than an in-progress
   * target after migrate has started.
   */
  readonly volumeGate?: HostedReleaseVolumeGate;
}

/**
 * Decide whether a volume with `.bootstrap-complete` may continue on this
 * image. Different digest → RESET_REQUIRED unless
 * {@link PlanReleaseAlignOptions.admitHostedReleaseUpgrade} is set (explicit
 * tip-deploy admission; never silent) AND the volume gate permits a forward
 * transition (not a rollback onto a previously completed digest, not a
 * non-target image while upgrade-in-progress). Same digest → ready,
 * optionally rewriting known ZA-03 legacy policy profile ids in
 * installation.json.
 */
export const planReleaseAlign = (
  installationText: string,
  releaseBytes: Uint8Array,
  runtimeEnvText: string,
  options?: PlanReleaseAlignOptions
): ReleaseAlignPlan => {
  let installedUnknown: unknown;
  try {
    installedUnknown = JSON.parse(installationText);
  } catch {
    return { code: "INVALID_INSTALLATION_FILE", kind: "error" };
  }
  const hosted = parseHostedInstallationFile(installedUnknown);
  if (hosted === null) {
    return { code: "INVALID_INSTALLATION_FILE", kind: "error" };
  }
  const policyAlign = alignHostedInstallationPolicy(hosted.policy);
  if (policyAlign.kind === "error") {
    return { code: policyAlign.code, kind: "error" };
  }
  const withPolicy: HostedInstallationFile =
    policyAlign.kind === "rewritten"
      ? { installation: hosted.installation, policy: policyAlign.policy }
      : hosted;
  const runtimeEnv = parseQuotedEnvFile(runtimeEnvText);
  if (runtimeEnv === null) {
    return { code: "RUNTIME_ENV_MALFORMED", kind: "error" };
  }
  const authorityUrl = runtimeEnv.ZOEN_AUTHORITY_DATABASE_URL;
  if (authorityUrl === undefined || authorityUrl.length === 0) {
    return { code: "RUNTIME_ENV_MISSING_AUTHORITY", kind: "error" };
  }
  const releaseDigest = digestReleaseBytes(releaseBytes);
  const {
    cellId,
    generationId,
    releaseDigest: installedDigest,
  } = hosted.installation;
  const { volumeGate: gateOption } = options ?? {};
  const gate = gateOption ?? emptyHostedReleaseUpgradeGate();
  const { inProgress } = gate;
  // After migrate starts, only the target image may boot — even if installation
  // still advertises the old digest (failed-upgrade non-admission).
  if (inProgress !== null && inProgress.toDigest !== releaseDigest) {
    return {
      code: "RESET_REQUIRED",
      installedDigest,
      kind: "error",
      releaseDigest,
    };
  }
  if (installedDigest !== releaseDigest) {
    if (inProgress !== null) {
      if (options?.admitHostedReleaseUpgrade !== true) {
        return {
          code: "RESET_REQUIRED",
          installedDigest,
          kind: "error",
          releaseDigest,
        };
      }
    } else if (options?.admitHostedReleaseUpgrade !== true) {
      return {
        code: "RESET_REQUIRED",
        installedDigest,
        kind: "error",
        releaseDigest,
      };
    } else if (gate.completedDigests.includes(releaseDigest)) {
      // Directional admission: a digest that already owned this volume cannot
      // be re-admitted as an "upgrade" (blocks older-image rollback onto a
      // newer schema after a successful tip rollout).
      return {
        code: "RESET_REQUIRED",
        installedDigest,
        kind: "error",
        releaseDigest,
      };
    }
    const upgraded = alignInstallationRelease(withPolicy, releaseDigest).next;
    return {
      authorityUrl,
      cellId,
      generationId,
      kind: "ready",
      releaseDigest,
      releaseUpgrade: true,
      rewriteInstallation: {
        next: upgraded,
        previousDigest: installedDigest,
      },
    };
  }
  return {
    authorityUrl,
    cellId,
    generationId,
    kind: "ready",
    releaseDigest,
    rewriteInstallation:
      policyAlign.kind === "rewritten"
        ? {
            next: withPolicy,
            previousDigest: installedDigest,
          }
        : null,
  };
};
