import { describe, expect, it } from "@effect/vitest";

import {
  alignInstallationRelease,
  digestReleaseBytes,
  parseHostedInstallationFile,
  parseQuotedEnvFile,
  planReleaseAlign,
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

  it("narrows installation.json shape", () => {
    expect(parseHostedInstallationFile(sampleInstallation)).toStrictEqual(
      sampleInstallation
    );
    expect(parseHostedInstallationFile({ installation: {} })).toBeNull();
    expect(parseHostedInstallationFile(null)).toBeNull();
  });

  it("plans skip when volume digest already matches release.json", () => {
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
        authorityEnv
      )
    ).toStrictEqual({ kind: "skip" });
  });

  it("plans align with authority URL when release.json digest changes", () => {
    const releaseBytes = new TextEncoder().encode('{"format":"next"}\n');
    const releaseDigest = digestReleaseBytes(releaseBytes);
    expect(
      planReleaseAlign(
        `${JSON.stringify(sampleInstallation)}\n`,
        releaseBytes,
        authorityEnv
      )
    ).toStrictEqual({
      authorityUrl: "postgresql://auth@127.0.0.1/zoen",
      kind: "align",
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
      releaseDigest,
    });
  });

  it("plans INVALID_INSTALLATION_FILE for bad JSON", () => {
    expect(
      planReleaseAlign("{", new TextEncoder().encode("x"), authorityEnv)
    ).toStrictEqual({ code: "INVALID_INSTALLATION_FILE", kind: "error" });
  });

  it("plans RUNTIME_ENV_MALFORMED for unquoted env", () => {
    expect(
      planReleaseAlign(
        `${JSON.stringify(sampleInstallation)}\n`,
        new TextEncoder().encode("x"),
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

  it("scripted repro: install once → new release digest → align → skip", () => {
    const firstBytes = new TextEncoder().encode(
      `{"format":"zoen-local-build-v1","lock_sha256":"${"c".repeat(64)}","files":[]}\n`
    );
    const firstDigest = digestReleaseBytes(firstBytes);
    const installed = {
      ...sampleInstallation,
      installation: {
        ...sampleInstallation.installation,
        releaseDigest: firstDigest,
      },
    };
    const installationText = `${JSON.stringify(installed)}\n`;
    expect(
      planReleaseAlign(installationText, firstBytes, authorityEnv)
    ).toStrictEqual({ kind: "skip" });

    const secondBytes = new TextEncoder().encode(
      `{"format":"zoen-local-build-v1","lock_sha256":"${"d".repeat(64)}","files":[]}\n`
    );
    const plan = planReleaseAlign(installationText, secondBytes, authorityEnv);
    expect(plan).toMatchObject({
      kind: "align",
      previousDigest: firstDigest,
      releaseDigest: digestReleaseBytes(secondBytes),
    });
    if (plan.kind !== "align") {
      return;
    }
    expect(
      planReleaseAlign(
        `${JSON.stringify(plan.next)}\n`,
        secondBytes,
        authorityEnv
      )
    ).toStrictEqual({ kind: "skip" });
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
