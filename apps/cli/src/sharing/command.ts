import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import { Revision } from "@zoen/contracts/worlds/values";
import type {
  OperationId,
  Realm,
  WorldId,
} from "@zoen/contracts/worlds/values";
import type { Effect } from "effect";
import { Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

interface SharedFlags {
  readonly operationId: Flag.Flag<typeof OperationId.Type>;
  readonly realm: Flag.Flag<typeof Realm.Type>;
  readonly worldId: Flag.Flag<typeof WorldId.Type>;
}
type Reporter = <E, R>(
  self: Effect.Effect<void, E, R>
) => Effect.Effect<void, never, R>;

const envelope = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
} as const;
const principalRef = Flag.string("principal-ref").pipe(
  Flag.withSchema(PrincipalRef),
  Flag.withDescription(
    "Exact local account UUID supplied by the recipient; not an email or session ID"
  )
);
const expectedGrantRevision = Flag.string("expected-revision").pipe(
  Flag.withSchema(Schema.Union([Revision, Schema.Literal("null")])),
  Flag.map((value) => (value === "null" ? null : value)),
  Flag.withDescription(
    "Revision from inspect-access; explicit null means no membership exists, not revision 0"
  )
);
const expectedRevokeRevision = Flag.string("expected-revision").pipe(
  Flag.withSchema(Revision),
  Flag.withDescription(
    "Exact decimal revision from inspect-access; null is not valid for revocation"
  )
);

/** Only public intentions are assembled here; the executor authorizes each one. */
export const makeSharingCommands = <E, R>(
  shared: SharedFlags,
  send: (request: unknown) => Effect.Effect<void, E, R>,
  report: Reporter
) =>
  [
    Command.make(
      "inspect-access",
      {
        principalRef: principalRef.pipe(Flag.optional),
        realm: shared.realm,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: { principalRef: Option.getOrNull(flags.principalRef) },
            operation: "InspectWorldAccess",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Read current membership. Omit principal-ref for your own access; only an owner may inspect an exact recipient. No member listing."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-access --world-id <uuid>",
          description:
            "Read your current role, state and revision in the World",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-access --world-id <uuid> --principal-ref <recipient-uuid>",
          description:
            "Owner: read the recipient's current membership before confirming a change; null means absent",
        },
      ])
    ),
    Command.make(
      "grant-read-access",
      {
        ...shared,
        expectedRevision: expectedGrantRevision,
        principalRef,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              expectedRevision: flags.expectedRevision,
              principalRef: flags.principalRef,
            },
            operation: "GrantWorldReadAccess",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: grant viewer access to ALL existing and future evidence and claims in this World. Private corrections, Questions and Frames are excluded. Output membershipAtCommit is historical; inspect-access reads current state."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 grant-read-access --world-id <uuid> --principal-ref <recipient-uuid> --expected-revision null --operation-id <uuid>",
          description:
            "Grant full-World reading after inspect-access reports no membership. Keep every argument unchanged on retry",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 grant-read-access --world-id <uuid> --principal-ref <recipient-uuid> --expected-revision 1 --operation-id <new-uuid>",
          description:
            "Explicitly regrant after reading revision 1. Stale requires a new inspection and newly confirmed intent; replay of an old grant does not restore access",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-access --world-id <uuid> --principal-ref <recipient-uuid>",
          description:
            "Read current access separately from the historical grant receipt",
        },
      ])
    ),
    Command.make(
      "revoke-read-access",
      {
        ...shared,
        expectedRevision: expectedRevokeRevision,
        principalRef,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              expectedRevision: flags.expectedRevision,
              principalRef: flags.principalRef,
            },
            operation: "RevokeWorldReadAccess",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: revoke a viewer's reading access using its exact current revision. Evidence, history and copies already received are retained. Output membershipAtCommit is historical; inspect-access reads current state."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 revoke-read-access --world-id <uuid> --principal-ref <recipient-uuid> --expected-revision 0 --operation-id <uuid>",
          description:
            "Revoke after inspecting revision 0. Reuse the same operation UUID, target and revision on retry",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-access --world-id <uuid> --principal-ref <recipient-uuid>",
          description:
            "Read current access after a receipt, or reread after Stale before confirming a new operation",
        },
      ])
    ),
  ] as const;
