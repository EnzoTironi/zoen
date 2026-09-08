import { describe, expect, it } from "@effect/vitest";

import {
  alignInstallationRelease,
  digestReleaseBytes,
  parseHostedInstallationFile,
  parseQuotedEnvFile,
  planReleaseAlign,
  releaseAlignSteps,
} from "../src/all-in-one-release-align.ts";
import { ServerConfigurationError } from "../src/configuration.ts";

const sampleInstallation = {
  installation: {
    cellEpoch: "1",
    cellId: "11111111-1111-4111-8111-111111111111",
    generationId: "22222222-2222-4222-8222-222222222222",
    releaseDigest: "a".repeat(64),
  },
  policy: { profileId: "d04-hosted-retained-v1" },
};

const authorityEnv =
  'ZOEN_AUTHORITY_DATABASE_URL="postgresql://auth@127.0.0.1/zoen"\n';

describe("all-in-one release align", () => {
  it("digests release bytes as sha256 hex", () => {
    expect(digestReleaseBytes(new TextEncoder().encode("abc\n"))).toBe(
      "edeaaff3f1774ad2888673770c6d64097e391bc362d7d6fb34982ddf0efd18cb"
    );
  });

  it("no-ops when installation already matches the image", () => {
    expect(
      alignInstallationRelease(sampleInstallation, "a".repeat(64))
    ).toStrictEqual({
      changed: false,
      next: sampleInstallation,
    });
  });

  it("projects a new digest without implying automatic apply (ZA-06)", () => {
    const nextDigest = "b".repeat(64);
    expect(
      alignInstallationRelease(sampleInstallation, nextDigest)
    ).toStrictEqual({
      changed: true,
      next: {
        installation: {
          cellEpoch: "1",
          cellId: "11111111-1111-4111-8111-111111111111",
          generationId: "22222222-2222-4222-8222-222222222222",
          releaseDigest: nextDigest,
        },
        policy: { profileId: "d04-hosted-retained-v1" },
      },
    });
  });

  it('parses bootstrap runtime.env KEY="value" lines', () => {
    expect(
      parseQuotedEnvFile(
        'ZOEN_AUTHORITY_DATABASE_URL="postgresql://a:b@h/db"\n'
      )
    ).toStrictEqual({
      ZOEN_AUTHORITY_DATABASE_URL: "postgresql://a:b@h/db",
    });
  });

  it("rejects malformed runtime.env", () => {
    expect(parseQuotedEnvFile("NO_EQUALS\n")).toBeNull();
    expect(parseQuotedEnvFile("KEY=unquoted\n")).toBeNull();
    expect(parseQuotedEnvFile('KEY="has\\backslash"\n')).toBeNull();
  });

  it("skips blank lines and parses embedded separators in quoted values", () => {
    expect(
      parseQuotedEnvFile(
        '\n  \nZOEN_S3_ENDPOINT="http://127.0.0.1:9000"\nZOEN_NOTE="a=b=c"\n'
      )
    ).toStrictEqual({
      ZOEN_NOTE: "a=b=c",
      ZOEN_S3_ENDPOINT: "http://127.0.0.1:9000",
    });
  });

  it("rejects separator-less and empty-key assignments", () => {
    expect(parseQuotedEnvFile('="value"\n')).toBeNull();
    expect(parseQuotedEnvFile("ONLYKEY\n")).toBeNull();
  });

  it("narrows installation.json shape", () => {
    expect(parseHostedInstallationFile(sampleInstallation)).toStrictEqual(
      sampleInstallation
    );
    expect(parseHostedInstallationFile({ installation: {} })).toBeNull();
    expect(parseHostedInstallationFile(null)).toBeNull();
  });

  it("plans ready when volume digest matches (ZA-06-01)", () => {
    const digest = digestReleaseBytes(new TextEncoder().encode("same\n"));
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: digest,
      },
    };
    const plan = planReleaseAlign(
      `${JSON.stringify(installed)}\n`,
      new TextEncoder().encode("same\n"),
      authorityEnv
    );
    expect(plan).toStrictEqual({
      authorityUrl: "postgresql://auth@127.0.0.1/zoen",
      cellId: "11111111-1111-4111-8111-111111111111",
      generationId: "22222222-2222-4222-8222-222222222222",
      kind: "ready",
      releaseDigest: digest,
    });
    if (plan.kind !== "ready") {
      return;
    }
    expect(releaseAlignSteps(plan)).toStrictEqual([
      {
        authorityUrl: "postgresql://auth@127.0.0.1/zoen",
        cellId: "11111111-1111-4111-8111-111111111111",
        generationId: "22222222-2222-4222-8222-222222222222",
        releaseDigest: digest,
        step: "reconcile-worlds",
      },
    ]);
  });

  it("plans RESET_REQUIRED when release.json digest changes (ZA-06-02)", () => {
    const releaseBytes = new TextEncoder().encode('{"format":"next"}\n');
    const releaseDigest = digestReleaseBytes(releaseBytes);
    const plan = planReleaseAlign(
      `${JSON.stringify(sampleInstallation)}\n`,
      releaseBytes,
      authorityEnv
    );
    expect(plan).toStrictEqual({
      code: "RESET_REQUIRED",
      installedDigest: "a".repeat(64),
      kind: "error",
      releaseDigest,
    });
  });

  it("plans INVALID_INSTALLATION_FILE for bad JSON", () => {
    expect(
      planReleaseAlign("{", new TextEncoder().encode("x"), authorityEnv)
    ).toStrictEqual({ code: "INVALID_INSTALLATION_FILE", kind: "error" });
  });

  it("plans RUNTIME_ENV_MALFORMED when digests would match", () => {
    const digest = digestReleaseBytes(new TextEncoder().encode("same\n"));
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: digest,
      },
    };
    expect(
      planReleaseAlign(
        `${JSON.stringify(installed)}\n`,
        new TextEncoder().encode("same\n"),
        "KEY=unquoted\n"
      )
    ).toStrictEqual({ code: "RUNTIME_ENV_MALFORMED", kind: "error" });
  });

  it("plans RUNTIME_ENV_MISSING_AUTHORITY when authority URL absent", () => {
    const digest = digestReleaseBytes(new TextEncoder().encode("x"));
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: digest,
      },
    };
    expect(
      planReleaseAlign(
        `${JSON.stringify(installed)}\n`,
        new TextEncoder().encode("x"),
        'ZOEN_S3_BUCKET="zoen"\n'
      )
    ).toStrictEqual({ code: "RUNTIME_ENV_MISSING_AUTHORITY", kind: "error" });
  });

  it("same-digest restart reconciles worlds only", () => {
    const bytes = new TextEncoder().encode('{"format":"one"}\n');
    const digest = digestReleaseBytes(bytes);
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: digest,
      },
    };
    const plan = planReleaseAlign(
      `${JSON.stringify(installed)}\n`,
      bytes,
      authorityEnv
    );
    expect(plan.kind).toBe("ready");
    if (plan.kind !== "ready") {
      return;
    }
    expect(releaseAlignSteps(plan).map((step) => step.step)).toStrictEqual([
      "reconcile-worlds",
    ]);
  });
});

describe("ServerConfigurationError Cause message", () => {
  it("exposes RELEASE_MISMATCH as message for Fly Cause logs", () => {
    const error = new ServerConfigurationError({ code: "RELEASE_MISMATCH" });
    expect(error.message).toBe("RELEASE_MISMATCH");
    expect(String(error)).toContain("RELEASE_MISMATCH");
  });

  it("exposes INVALID_CONFIGURATION as message", () => {
    const error = new ServerConfigurationError({
      code: "INVALID_CONFIGURATION",
    });
    expect(error.message).toBe("INVALID_CONFIGURATION");
  });
});
