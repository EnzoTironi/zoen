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

  it("rewrites releaseDigest and preserves cell/generation", () => {
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

  it("plans ready with rewrite null when volume digest matches", () => {
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
      rewriteInstallation: null,
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

  it("plans ready with rewrite when release.json digest changes", () => {
    const releaseBytes = new TextEncoder().encode('{"format":"next"}\n');
    const releaseDigest = digestReleaseBytes(releaseBytes);
    const plan = planReleaseAlign(
      `${JSON.stringify(sampleInstallation)}\n`,
      releaseBytes,
      authorityEnv
    );
    expect(plan).toStrictEqual({
      authorityUrl: "postgresql://auth@127.0.0.1/zoen",
      cellId: "11111111-1111-4111-8111-111111111111",
      generationId: "22222222-2222-4222-8222-222222222222",
      kind: "ready",
      releaseDigest,
      rewriteInstallation: {
        next: {
          installation: {
            cellEpoch: "1",
            cellId: "11111111-1111-4111-8111-111111111111",
            generationId: "22222222-2222-4222-8222-222222222222",
            releaseDigest,
          },
          policy: { profileId: "d04-hosted-retained-v1" },
        },
        previousDigest: "a".repeat(64),
      },
    });
    if (plan.kind !== "ready") {
      return;
    }
    expect(releaseAlignSteps(plan).map((step) => step.step)).toStrictEqual([
      "reconcile-worlds",
      "rewrite-installation",
    ]);
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
    expect(
      planReleaseAlign(
        `${JSON.stringify(sampleInstallation)}\n`,
        new TextEncoder().encode("x"),
        'ZOEN_S3_BUCKET="zoen"\n'
      )
    ).toStrictEqual({ code: "RUNTIME_ENV_MISSING_AUTHORITY", kind: "error" });
  });

  it("rollback after tip UPDATE still reconciles worlds to restored digest", () => {
    const tipBytes = new TextEncoder().encode('{"format":"tip"}\n');
    const tipDigest = digestReleaseBytes(tipBytes);
    const rollbackBytes = new TextEncoder().encode('{"format":"v12"}\n');
    const rollbackDigest = digestReleaseBytes(rollbackBytes);
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: rollbackDigest,
      },
    };
    const plan = planReleaseAlign(
      `${JSON.stringify(installed)}\n`,
      rollbackBytes,
      authorityEnv
    );
    expect(plan.kind).toBe("ready");
    if (plan.kind !== "ready") {
      return;
    }
    expect(plan.rewriteInstallation).toBeNull();
    expect(plan.releaseDigest).toBe(rollbackDigest);
    expect(plan.releaseDigest).not.toBe(tipDigest);
    expect(releaseAlignSteps(plan).map((step) => step.step)).toStrictEqual([
      "reconcile-worlds",
    ]);
  });

  it("matching digest plans reconcile-worlds only", () => {
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
    expect(plan.rewriteInstallation).toBeNull();
    expect(releaseAlignSteps(plan).map((step) => step.step)).toStrictEqual([
      "reconcile-worlds",
    ]);
  });

  it("digest change plans reconcile then rewrite", () => {
    const firstBytes = new TextEncoder().encode('{"format":"one"}\n');
    const firstDigest = digestReleaseBytes(firstBytes);
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: firstDigest,
      },
    };
    const secondBytes = new TextEncoder().encode('{"format":"two"}\n');
    const plan = planReleaseAlign(
      `${JSON.stringify(installed)}\n`,
      secondBytes,
      authorityEnv
    );
    expect(plan.kind).toBe("ready");
    if (plan.kind !== "ready" || plan.rewriteInstallation === null) {
      return;
    }
    expect(releaseAlignSteps(plan).map((step) => step.step)).toStrictEqual([
      "reconcile-worlds",
      "rewrite-installation",
    ]);
    const after = planReleaseAlign(
      `${JSON.stringify(plan.rewriteInstallation.next)}\n`,
      secondBytes,
      authorityEnv
    );
    expect(after.kind).toBe("ready");
    if (after.kind !== "ready") {
      return;
    }
    expect(after.rewriteInstallation).toBeNull();
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
