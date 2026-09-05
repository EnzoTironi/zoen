import { randomBytes, randomUUID } from "node:crypto";

import { expect, request, test } from "@playwright/test";
import {
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import {
  WorldAccessInspected,
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import { Config, Effect, Schema } from "effect";

import { BrowserSession } from "../../../src/features/d01/client.ts";
import {
  cli,
  makeSessionDirectory,
  removeSessionDirectory,
} from "../d02/real-cli.ts";

const baseURL = Effect.runSync(Config.string("ZOEN_TEST_SHARING_WEB_URL"));
const success = <A>(
  schema: Schema.Codec<A, unknown>,
  output: Awaited<ReturnType<typeof cli>>
): A => {
  expect({ exitCode: output.exitCode, stderr: output.stderr }).toStrictEqual({
    exitCode: 0,
    stderr: "",
  });
  return Schema.decodeSync(Schema.fromJsonString(schema))(output.stdout);
};
const denial = (output: Awaited<ReturnType<typeof cli>>) => {
  expect(output).toStrictEqual({
    exitCode: 1,
    stderr: '{"_tag":"NotFoundOrDenied","code":"NOT_FOUND_OR_DENIED"}\n',
    stdout: "",
  });
};
const account = async (directory: string) => {
  const email = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const authenticated = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  });
  try {
    const signup = await authenticated.post("/api/auth/sign-up/email", {
      data: { email, name: "CLI sharing proof", password },
    });
    expect(signup.status()).toBe(200);
    const session = await authenticated.get("/api/auth/get-session");
    expect(session.status()).toBe(200);
    const actual = Schema.decodeUnknownSync(BrowserSession)(
      await session.json()
    );
    const signedIn = await cli(
      baseURL,
      directory,
      ["sign-in", "--email", email],
      password
    );
    expect(signedIn).toStrictEqual({
      exitCode: 0,
      stderr: "",
      stdout: '{"_tag":"SignedIn"}\n',
    });
    return actual.user.id;
  } finally {
    await authenticated.dispose();
  }
};

test.setTimeout(90_000);

test("EX23 real CLI sharing preserves historical receipts and reauthorizes viewer evidence across revoke and regrant", async () => {
  const owner = await makeSessionDirectory();
  const viewer = await makeSessionDirectory();
  const third = await makeSessionDirectory();
  try {
    const ownerId = await account(owner);
    const viewerId = await account(viewer);
    await account(third);
    const created = success(
      WorldCreated,
      await cli(baseURL, owner, [
        "create-world",
        "--operation-id",
        randomUUID(),
      ])
    );
    const worldFlags = ["--world-id", created.worldRef.worldId];
    const targetFlags = [...worldFlags, "--principal-ref", viewerId];
    const own = success(
      WorldAccessInspected,
      await cli(baseURL, owner, ["inspect-access", ...worldFlags])
    );
    expect(own.membership).toMatchObject({
      principalRef: ownerId,
      revision: "0",
      role: "owner",
      state: "active",
    });
    const absent = success(
      WorldAccessInspected,
      await cli(baseURL, owner, ["inspect-access", ...targetFlags])
    );
    expect(absent.membership).toBeNull();
    const subject = `cli-sharing-${randomUUID()}`;
    const document = JSON.stringify({
      records: [
        {
          externalId: "r1",
          predicate: "obligation.amount",
          subjectKey: subject,
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: { _tag: "Known", amount: "123.45", currency: "BRL" },
        },
      ],
      schemaVersion: "d01.v1",
      source: {
        externalId: randomUUID(),
        label: `CLI exact evidence ${randomUUID()}`,
        namespace: "sharing-cli",
        revision: "1",
      },
    });
    success(
      EvidenceImported,
      await cli(
        baseURL,
        owner,
        ["import", ...worldFlags, "--operation-id", randomUUID()],
        document
      )
    );
    const inspectFlags = ["inspect", ...worldFlags, "--subject-key", subject];
    const ownerFrame = success(
      FrameInspected,
      await cli(baseURL, owner, inspectFlags)
    ).frame;
    denial(await cli(baseURL, third, inspectFlags));
    denial(await cli(baseURL, viewer, ["inspect-access", ...worldFlags]));
    const grantId = randomUUID();
    const grantFlags = [
      "grant-read-access",
      ...targetFlags,
      "--operation-id",
      grantId,
      "--expected-revision",
      "null",
    ];
    const grantOutput = await cli(baseURL, owner, grantFlags);
    const granted = success(WorldReadAccessGranted, grantOutput);
    expect(granted.membershipAtCommit).toStrictEqual({
      principalRef: viewerId,
      revision: "0",
      role: "viewer",
      state: "active",
    });
    const current = success(
      WorldAccessInspected,
      await cli(baseURL, viewer, ["inspect-access", ...worldFlags])
    );
    expect(current.membership).toStrictEqual(granted.membershipAtCommit);
    const viewerFrame = success(
      FrameInspected,
      await cli(baseURL, viewer, inspectFlags)
    ).frame;
    expect(viewerFrame.claims).toStrictEqual(ownerFrame.claims);
    expect(viewerFrame.scopedCorrections).toStrictEqual([]);
    const [claim] = viewerFrame.claims;
    if (claim === undefined) {
      throw new Error("Admitted evidence must produce a visible claim");
    }
    const openFlags = [
      "open",
      ...worldFlags,
      "--evidence-ref",
      claim.evidenceRef,
    ];
    const opened = success(
      EvidenceOpened,
      await cli(baseURL, viewer, openFlags)
    );
    expect(Buffer.from(opened.document)).toStrictEqual(Buffer.from(document));
    const historicalFlags = [
      ...inspectFlags,
      "--at-frame",
      viewerFrame.frameRef,
    ];
    const retained = success(
      FrameInspected,
      await cli(baseURL, viewer, historicalFlags)
    );
    expect(retained.frame).toStrictEqual(viewerFrame);
    denial(
      await cli(baseURL, viewer, [
        ...inspectFlags,
        "--at-frame",
        ownerFrame.frameRef,
      ])
    );
    denial(
      await cli(baseURL, viewer, [
        "inspect-access",
        ...worldFlags,
        "--principal-ref",
        ownerId,
      ])
    );
    denial(
      await cli(
        baseURL,
        viewer,
        ["import", ...worldFlags, "--operation-id", randomUUID()],
        document
      )
    );
    denial(await cli(baseURL, third, openFlags));
    const revokeFlags = [
      "revoke-read-access",
      ...targetFlags,
      "--operation-id",
      randomUUID(),
      "--expected-revision",
      "0",
    ];
    const revokeOutput = await cli(baseURL, owner, revokeFlags);
    const revoked = success(WorldReadAccessRevoked, revokeOutput);
    expect(revoked.membershipAtCommit).toStrictEqual({
      principalRef: viewerId,
      revision: "1",
      role: "viewer",
      state: "revoked",
    });
    const replay = await cli(baseURL, owner, grantFlags);
    expect(replay).toStrictEqual(grantOutput);
    const afterReplay = success(
      WorldAccessInspected,
      await cli(baseURL, owner, ["inspect-access", ...targetFlags])
    );
    expect(afterReplay.membership).toStrictEqual(revoked.membershipAtCommit);
    denial(await cli(baseURL, viewer, inspectFlags));
    denial(await cli(baseURL, viewer, historicalFlags));
    denial(await cli(baseURL, viewer, openFlags));
    const stale = await cli(baseURL, owner, [
      "grant-read-access",
      ...targetFlags,
      "--operation-id",
      randomUUID(),
      "--expected-revision",
      "null",
    ]);
    expect(stale).toStrictEqual({
      exitCode: 1,
      stderr: '{"_tag":"Stale","code":"STALE"}\n',
      stdout: "",
    });
    const regrant = success(
      WorldReadAccessGranted,
      await cli(baseURL, owner, [
        "grant-read-access",
        ...targetFlags,
        "--operation-id",
        randomUUID(),
        "--expected-revision",
        "1",
      ])
    );
    expect(regrant.membershipAtCommit).toStrictEqual({
      principalRef: viewerId,
      revision: "2",
      role: "viewer",
      state: "active",
    });
    const reread = success(
      FrameInspected,
      await cli(baseURL, viewer, historicalFlags)
    );
    expect(reread.frame).toStrictEqual(viewerFrame);
    const reopened = success(
      EvidenceOpened,
      await cli(baseURL, viewer, openFlags)
    );
    expect(reopened).toStrictEqual(opened);
    const signedOut = await cli(baseURL, viewer, ["sign-out"]);
    expect(signedOut).toStrictEqual({
      exitCode: 0,
      stderr: "",
      stdout: '{"_tag":"SignedOut"}\n',
    });
    const afterLogout = await cli(baseURL, viewer, openFlags);
    expect(afterLogout).toStrictEqual({
      exitCode: 1,
      stderr: '{"_tag":"CliFailure","code":"CLI_SESSION"}\n',
      stdout: "",
    });
  } finally {
    await removeSessionDirectory(owner);
    await removeSessionDirectory(viewer);
    await removeSessionDirectory(third);
  }
});
