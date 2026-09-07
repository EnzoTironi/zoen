import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import type {
  OperationId,
  Realm,
  WorldId,
} from "@zoen/contracts/worlds/values";
import type { Effect } from "effect";
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
  schemaVersion: "eve.v1",
} as const;

const conversationId = Flag.string("conversation-id").pipe(
  Flag.withSchema(ConversationId),
  Flag.withDescription("Stable conversation UUID")
);
const relationshipId = Flag.string("relationship-id").pipe(
  Flag.withSchema(RelationshipId),
  Flag.withDescription("Relationship UUID for this conversation")
);
const ingressId = Flag.string("ingress-id").pipe(
  Flag.withSchema(IngressId),
  Flag.withDescription("Idempotent ingress UUID; reuse on Unavailable retry")
);
const turnId = Flag.string("turn-id").pipe(
  Flag.withSchema(TurnId),
  Flag.withDescription("Turn UUID for this ingress")
);
const messageId = Flag.string("message-id").pipe(
  Flag.withSchema(MessageId),
  Flag.withDescription("Message UUID settled for this turn")
);
const userText = Flag.string("text").pipe(
  Flag.withDescription("User text for the Eve turn (OpenCode Zen product path)")
);

/** Public request assembly only; authorization and model calls stay on the server. */
export const makeEveCommands = <E, R>(
  shared: SharedFlags,
  send: (request: unknown) => Effect.Effect<void, E, R>,
  report: Reporter
) =>
  [
    Command.make(
      "eve-turn",
      {
        conversationId,
        ingressId,
        messageId,
        realm: shared.realm,
        relationshipId,
        text: userText,
        turnId,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              conversationId: flags.conversationId,
              ingressId: flags.ingressId,
              messageId: flags.messageId,
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              relationshipId: flags.relationshipId,
              turnId: flags.turnId,
              userText: flags.text,
            },
            operation: "AcceptConversationTurn",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: run one Eve turn on the OpenCode Zen candidate path (accept → model → settle). Fail-closed Blocked until durable journal/grounding/key qualify (ZA-17); key alone does not admit. Voice remains blocked. Reuse --ingress-id on Unavailable retry."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 eve-turn --world-id <uuid> --conversation-id <uuid> --relationship-id <uuid> --ingress-id <uuid> --turn-id <uuid> --message-id <uuid> --text 'quanto gastei?'",
          description:
            "Expect Blocked until Eve journal/grounding/profile qualify (ZA-17); Worlds CLI stays usable",
        },
      ])
    ),
    Command.make(
      "eve-cancel",
      {
        conversationId,
        realm: shared.realm,
        turnId,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              conversationId: flags.conversationId,
              turnId: flags.turnId,
            },
            operation: "CancelConversationTurn",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: cancel an accepted Eve turn before settlement. Does not invent Visible text."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 eve-cancel --world-id <uuid> --conversation-id <uuid> --turn-id <uuid>",
          description: "Cancel a turn that has not settled",
        },
      ])
    ),
    Command.make(
      "eve-recover",
      {
        conversationId,
        realm: shared.realm,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: { conversationId: flags.conversationId },
            operation: "RecoverConversationJournal",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: recover the Eve conversation journal without calling a live model. Fail-closed when product Eve is unadmitted (ZA-17). Snapshots never contain API keys (INV-01)."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 eve-recover --world-id <uuid> --conversation-id <uuid>",
          description: "Print the recoverable journal snapshot as JSON",
        },
      ])
    ),
  ] as const;
