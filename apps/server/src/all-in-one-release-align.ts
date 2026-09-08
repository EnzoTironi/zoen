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
    }
  | {
      readonly code:
        | "INVALID_INSTALLATION_FILE"
        | "RUNTIME_ENV_MISSING_AUTHORITY"
        | "RUNTIME_ENV_MALFORMED"
        | "RESET_REQUIRED";
      readonly kind: "error";
      /** Present when code is RESET_REQUIRED — installed vs image digests. */
      readonly installedDigest?: string;
      readonly releaseDigest?: string;
    };

export interface ReleaseAlignStep {
  readonly authorityUrl: string;
  readonly cellId: string;
  readonly generationId: string;
  readonly releaseDigest: string;
  readonly step: "reconcile-worlds";
}

/**
 * Same-release restart only: reconcile worlds to the pinned installation
 * digest. Digest mismatch is never a rewrite step (ZA-06 fail-closed).
 */
export const releaseAlignSteps = (
  plan: Extract<ReleaseAlignPlan, { readonly kind: "ready" }>
): readonly ReleaseAlignStep[] => [
  {
    authorityUrl: plan.authorityUrl,
    cellId: plan.cellId,
    generationId: plan.generationId,
    releaseDigest: plan.releaseDigest,
    step: "reconcile-worlds",
  },
];

/**
 * Decide whether a volume with `.bootstrap-complete` may continue on this
 * image. Same digest → ready (reconcile worlds). Different digest →
 * RESET_REQUIRED (explicit named local reset or admitted migration; never
 * silent digest replacement).
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
  };
};
