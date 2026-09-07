import { describe, expect, it } from "@effect/vitest";

import {
  alignInstallationRelease,
  digestReleaseBytes,
  parseHostedInstallationFile,
  parseQuotedEnvFile,
} from "../src/all-in-one-release-align.ts";

describe("all-in-one release align", () => {
  it("digests release bytes as sha256 hex", () => {
    expect(digestReleaseBytes(new TextEncoder().encode("abc\n"))).toBe(
      "edeaaff3f1774ad2888673770c6d64097e391bc362d7d6fb34982ddf0efd18cb"
    );
  });

  it("no-ops when installation already matches the image", () => {
    const installed = {
      installation: {
        cellEpoch: "1",
        cellId: "11111111-1111-4111-8111-111111111111",
        generationId: "22222222-2222-4222-8222-222222222222",
        releaseDigest: "a".repeat(64),
      },
      policy: { profileId: "d04-hosted-retained-v1" },
    };
    expect(alignInstallationRelease(installed, "a".repeat(64))).toStrictEqual({
      changed: false,
      next: installed,
    });
  });

  it("rewrites releaseDigest and preserves cell/generation", () => {
    const installed = {
      installation: {
        cellEpoch: "1",
        cellId: "11111111-1111-4111-8111-111111111111",
        generationId: "22222222-2222-4222-8222-222222222222",
        releaseDigest: "a".repeat(64),
      },
      policy: { profileId: "d04-hosted-retained-v1" },
    };
    const nextDigest = "b".repeat(64);
    expect(alignInstallationRelease(installed, nextDigest)).toStrictEqual({
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
  });

  it("narrows installation.json shape", () => {
    expect(
      parseHostedInstallationFile({
        installation: {
          cellEpoch: "1",
          cellId: "c",
          generationId: "g",
          releaseDigest: "d",
        },
        policy: { profileId: "x" },
      })
    ).toStrictEqual({
      installation: {
        cellEpoch: "1",
        cellId: "c",
        generationId: "g",
        releaseDigest: "d",
      },
      policy: { profileId: "x" },
    });
    expect(parseHostedInstallationFile({ installation: {} })).toBeNull();
  });
});
