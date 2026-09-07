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
 * Hosted all-in-one: when a new image ships a new release.json, rewrite the
 * volume installation.releaseDigest (Pre-launch disposable). Callers must also
 * UPDATE authority.worlds.release_digest for the same cell/generation.
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
    if (line.length === 0) {
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
  | { readonly kind: "skip" }
  | {
      readonly authorityUrl: string;
      readonly kind: "align";
      readonly next: HostedInstallationFile;
      readonly previousDigest: string;
      readonly releaseDigest: string;
    }
  | {
      readonly code:
        | "INVALID_INSTALLATION_FILE"
        | "RUNTIME_ENV_MISSING_AUTHORITY"
        | "RUNTIME_ENV_MALFORMED";
      readonly kind: "error";
    };

/**
 * Decide whether a volume with `.bootstrap-complete` must rewrite digests for a
 * new image release.json. Pure — bootstrap applies FS/SQL side effects.
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
  const releaseDigest = digestReleaseBytes(releaseBytes);
  const aligned = alignInstallationRelease(hosted, releaseDigest);
  if (!aligned.changed) {
    return { kind: "skip" };
  }
  const runtimeEnv = parseQuotedEnvFile(runtimeEnvText);
  if (runtimeEnv === null) {
    return { code: "RUNTIME_ENV_MALFORMED", kind: "error" };
  }
  const authorityUrl = runtimeEnv.ZOEN_AUTHORITY_DATABASE_URL;
  if (authorityUrl === undefined || authorityUrl.length === 0) {
    return { code: "RUNTIME_ENV_MISSING_AUTHORITY", kind: "error" };
  }
  return {
    authorityUrl,
    kind: "align",
    next: aligned.next,
    previousDigest: hosted.installation.releaseDigest,
    releaseDigest,
  };
};
