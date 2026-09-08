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
 * ZA-06: automatic bootstrap must NOT apply this on mismatch — use
 * {@link planReleaseAlign} which returns RESET_REQUIRED instead. Kept for
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
       * Same-release policy rewrite only (ZA-03 legacy profile ids). Digest
       * mismatch never populates this — that path is RESET_REQUIRED (ZA-06).
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
 * Optional installation rewrite is policy-only on the same release digest
 * (ZA-03); digest mismatch never reaches ready (ZA-06).
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

/**
 * Decide whether a volume with `.bootstrap-complete` may continue on this
 * image. Different digest → RESET_REQUIRED (ZA-06; never silent digest
 * replacement). Same digest → ready, optionally rewriting known ZA-03 legacy
 * policy profile ids in installation.json.
 */
export const planReleaseAlign = (
  installationText: string,
  releaseBytes: Uint8Array,
  runtimeEnvText: string
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
  if (installedDigest !== releaseDigest) {
    return {
      code: "RESET_REQUIRED",
      installedDigest,
      kind: "error",
      releaseDigest,
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
