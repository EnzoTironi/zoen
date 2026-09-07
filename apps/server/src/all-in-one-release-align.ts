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
       * When non-null, atomically replace installation.json after worlds
       * reconcile. When null, installation already matches the image — still
       * reconcile worlds (crash/rollback recovery).
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
        | "RUNTIME_ENV_MALFORMED";
      readonly kind: "error";
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
 * Ordered side effects for a ready plan. Worlds reconcile always runs first so
 * a crash after DB update + image rollback still heals on the next boot of the
 * restored image (installation matches → rewrite null → worlds forced back).
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
 * Decide how a volume with `.bootstrap-complete` aligns to the image
 * release.json. Pure — bootstrap applies FS/SQL from {@link releaseAlignSteps}.
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
  const aligned = alignInstallationRelease(hosted, releaseDigest);
  const { cellId, generationId } = hosted.installation;
  if (!aligned.changed) {
    return {
      authorityUrl,
      cellId,
      generationId,
      kind: "ready",
      releaseDigest,
      rewriteInstallation: null,
    };
  }
  return {
    authorityUrl,
    cellId,
    generationId,
    kind: "ready",
    releaseDigest,
    rewriteInstallation: {
      next: aligned.next,
      previousDigest: hosted.installation.releaseDigest,
    },
  };
};
