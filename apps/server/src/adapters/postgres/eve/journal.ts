/* oxlint-disable effecttsgo/unnecessary-effect-gen, effecttsgo/prefer-schema-over-json -- ZA-18 journal adapter */
import {
  AttemptId,
  ConversationId,
  EveEvidenceLink,
  EveProfileId,
  EveProviderAdmission,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
  UncertaintyKind,
} from "@zoen/contracts/eve/values";
import type {
  EveJournalSnapshot,
  EveTurn,
  EveVisibleMessage,
} from "@zoen/contracts/eve/values";
import {
  Blocked,
  Conflict,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import { Digest, Purpose, WorldId } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import {
  EveJournal,
  isAdmittedProvider,
  isLiveProviderBlocked,
} from "@zoen/ontology/ports/eve/journal";
import type {
  AcceptTurnInput,
  CancelTurnInput,
  RecoverJournalInput,
  SettleMessageInput,
} from "@zoen/ontology/ports/eve/journal";
import { PrincipalId } from "@zoen/ontology/ports/worlds/context";
import { Effect, Layer, Schema } from "effect";
import type { Redacted as RedactedType } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { eveIngressIntentDigest } from "../../../eve/intent.ts";
import { makeWorldsPostgresLayer } from "../worlds/postgres.ts";
import { checkEveJournalRuntimeRole } from "./role.ts";

const blockedProfile = new Blocked({ code: "PROFILE_BLOCKED" });
const notFound = new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
const conflict = new Conflict({ code: "CONFLICT" });
const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });

export interface EveJournalPostgresConfig {
  readonly applicationName: string;
  readonly maxConnections: number;
  readonly url: RedactedType.Redacted;
}

const ConversationRow = Schema.Struct({
  conversation_id: ConversationId,
  owner_principal_id: PrincipalId,
  profile_id: EveProfileId,
  provider_admission: EveProviderAdmission,
  purpose: Purpose,
  relationship_id: RelationshipId,
  revision: Schema.String,
  schema_version: Schema.Literal("eve.v1"),
  world_id: Schema.NullOr(WorldId),
  world_realm: Schema.NullOr(Schema.Literals(["live", "evaluation"])),
});

const TurnRow = Schema.Struct({
  conversation_id: ConversationId,
  ingress_id: IngressId,
  intent_digest: Digest,
  lease_epoch: Schema.String,
  lease_owner: Schema.NullOr(AttemptId),
  phase: Schema.Literals(["Accepted", "Settled", "Cancelled", "Interrupted"]),
  turn_id: TurnId,
  version: Schema.String,
});

const MessageRow = Schema.Struct({
  evidence_links: Schema.Unknown,
  message_id: MessageId,
  state: Schema.Literals(["Provisional", "Visible", "Superseded"]),
  turn_id: TurnId,
  uncertainty: UncertaintyKind,
  visible_text: Schema.String,
});

const AttemptRow = Schema.Struct({
  attempt_id: AttemptId,
  state: Schema.Literals(["unresolved", "settled", "cancelled"]),
  turn_id: TurnId,
});

const profileMatchesAdmission = (
  profileId: EveProfileId,
  admission: EveProviderAdmission
): boolean => {
  if (admission === "opencode-zen") {
    return profileId === "eve-opencode-zen-v1";
  }
  if (admission === "web-speech") {
    return profileId === "eve-web-speech-v1";
  }
  if (admission === "stub-local") {
    return profileId === "eve-local-stub-v1";
  }
  return false;
};

const worldColumns = (worldRef: WorldRef | null) =>
  worldRef === null
    ? { worldId: null as string | null, worldRealm: null as string | null }
    : { worldId: worldRef.worldId, worldRealm: worldRef.realm };

const toWorldRef = (
  worldId: typeof WorldId.Type | null,
  worldRealm: "live" | "evaluation" | null
): WorldRef | null => {
  if (worldId === null || worldRealm === null) {
    return null;
  }
  return { realm: worldRealm, worldId };
};

const decodeLinks = (value: unknown): EveEvidenceLink[] => [
  ...Schema.decodeUnknownSync(Schema.Array(EveEvidenceLink))(value),
];

const mapSql = <A, E>(effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.mapError(() => unavailable()));

/**
 * Durable actor-bound journal. Compare-and-swap turn lease/epoch fences a
 * single visible settlement; retained rows are operational, not domain evidence.
 */
export const makeDurableEveJournal = Effect.gen(function* durableJournal() {
  const sql = yield* SqlClient.SqlClient;

  const loadOwnedConversation = (input: {
    readonly conversationId: ConversationId;
    readonly ownerPrincipalId: typeof PrincipalId.Type;
    readonly purpose: typeof Purpose.Type;
    readonly worldRef: WorldRef | null;
  }) =>
    Effect.gen(function* load() {
      const world = worldColumns(input.worldRef);
      const rows = yield* mapSql(
        sql`
          SELECT conversation_id, owner_principal_id, relationship_id, purpose,
                 world_id, world_realm, profile_id, provider_admission,
                 revision::text AS revision, schema_version
          FROM eve.conversations
          WHERE conversation_id = ${input.conversationId}
            AND owner_principal_id = ${input.ownerPrincipalId}
            AND purpose = ${input.purpose}
            AND world_id IS NOT DISTINCT FROM ${world.worldId}
            AND world_realm IS NOT DISTINCT FROM ${world.worldRealm}
        `
      );
      if (rows.length !== 1) {
        return yield* notFound;
      }
      return yield* Schema.decodeUnknownEffect(ConversationRow)(rows[0]).pipe(
        Effect.mapError(() => unavailable())
      );
    });

  const loadSnapshot = (conversationId: ConversationId) =>
    Effect.gen(function* snap() {
      const conversationRows = yield* mapSql(
        sql`
          SELECT conversation_id, owner_principal_id, relationship_id, purpose,
                 world_id, world_realm, profile_id, provider_admission,
                 revision::text AS revision, schema_version
          FROM eve.conversations
          WHERE conversation_id = ${conversationId}
        `
      );
      if (conversationRows.length !== 1) {
        return yield* notFound;
      }
      const conversation = yield* Schema.decodeUnknownEffect(ConversationRow)(
        conversationRows[0]
      ).pipe(Effect.mapError(() => unavailable()));
      const turnRows = yield* mapSql(
        sql`
          SELECT conversation_id, turn_id, ingress_id, intent_digest, phase,
                 version::text AS version, lease_owner, lease_epoch::text AS lease_epoch
          FROM eve.turns
          WHERE conversation_id = ${conversationId}
          ORDER BY version ASC, turn_id ASC
        `
      );
      const messageRows = yield* mapSql(
        sql`
          SELECT turn_id, message_id, visible_text, uncertainty, state, evidence_links
          FROM eve.messages
          WHERE conversation_id = ${conversationId}
          ORDER BY turn_id ASC
        `
      );
      const attemptRows = yield* mapSql(
        sql`
          SELECT turn_id, attempt_id, state
          FROM eve.provider_attempts
          WHERE conversation_id = ${conversationId}
            AND state = 'unresolved'
          ORDER BY created_at ASC, attempt_id ASC
        `
      );
      const turns: EveTurn[] = [];
      for (const row of turnRows) {
        const decoded = yield* Schema.decodeUnknownEffect(TurnRow)(row).pipe(
          Effect.mapError(() => unavailable())
        );
        turns.push({
          conversationId: decoded.conversation_id,
          ingressId: decoded.ingress_id,
          phase: decoded.phase,
          turnId: decoded.turn_id,
          version: decoded.version,
        });
      }
      const messages: EveVisibleMessage[] = [];
      for (const row of messageRows) {
        const decoded = yield* Schema.decodeUnknownEffect(MessageRow)(row).pipe(
          Effect.mapError(() => unavailable())
        );
        messages.push({
          evidenceLinks: decodeLinks(decoded.evidence_links),
          messageId: decoded.message_id,
          state: decoded.state,
          turnId: decoded.turn_id,
          uncertainty: decoded.uncertainty,
          visibleText: decoded.visible_text,
        });
      }
      const unresolvedAttempts: {
        attemptId: AttemptId;
        state: "unresolved" | "settled" | "cancelled";
        turnId: TurnId;
      }[] = [];
      for (const row of attemptRows) {
        const decoded = yield* Schema.decodeUnknownEffect(AttemptRow)(row).pipe(
          Effect.mapError(() => unavailable())
        );
        unresolvedAttempts.push({
          attemptId: decoded.attempt_id,
          state: decoded.state,
          turnId: decoded.turn_id,
        });
      }
      const snapshot: EveJournalSnapshot = {
        authorityCredentialPresent: false,
        conversation: {
          conversationId: conversation.conversation_id,
          profileId: conversation.profile_id,
          relationshipId: conversation.relationship_id,
          revision: conversation.revision,
          schemaVersion: conversation.schema_version,
          worldRef: toWorldRef(conversation.world_id, conversation.world_realm),
        },
        messages,
        providerAdmission: conversation.provider_admission,
        turns,
        unresolvedAttempts,
      };
      return snapshot;
    });

  return EveJournal.of({
    acceptTurn: (input: AcceptTurnInput) =>
      Effect.gen(function* accept() {
        if (isLiveProviderBlocked(input.providerAdmission)) {
          return yield* blockedProfile;
        }
        if (!isAdmittedProvider(input.providerAdmission)) {
          return yield* blockedProfile;
        }
        if (
          !profileMatchesAdmission(input.profileId, input.providerAdmission)
        ) {
          return yield* blockedProfile;
        }
        const intentDigest = eveIngressIntentDigest({
          conversationId: input.conversationId,
          ingressId: input.ingressId,
          profileId: input.profileId,
          providerAdmission: input.providerAdmission,
          purpose: input.purpose,
          relationshipId: input.relationshipId,
          turnId: input.turnId,
          userText: input.userText,
          worldRef: input.worldRef,
        });
        const world = worldColumns(input.worldRef);

        return yield* sql
          .withTransaction(
            Effect.gen(function* tx() {
              const existing = yield* mapSql(
                sql`
                SELECT conversation_id, owner_principal_id, relationship_id, purpose,
                       world_id, world_realm, profile_id, provider_admission,
                       revision::text AS revision, schema_version
                FROM eve.conversations
                WHERE conversation_id = ${input.conversationId}
                FOR UPDATE
              `
              );
              if (existing.length === 1) {
                const conversation = yield* Schema.decodeUnknownEffect(
                  ConversationRow
                )(existing[0]).pipe(Effect.mapError(() => unavailable()));
                const worldOk =
                  (conversation.world_id === null && world.worldId === null) ||
                  (conversation.world_id !== null &&
                    world.worldId !== null &&
                    conversation.world_id === world.worldId &&
                    conversation.world_realm === world.worldRealm);
                if (
                  conversation.owner_principal_id !== input.ownerPrincipalId ||
                  conversation.purpose !== input.purpose ||
                  conversation.relationship_id !== input.relationshipId ||
                  !worldOk
                ) {
                  return yield* notFound;
                }
                const ingress = yield* mapSql(
                  sql`
                  SELECT conversation_id, turn_id, ingress_id, intent_digest, phase,
                         version::text AS version, lease_owner, lease_epoch::text AS lease_epoch
                  FROM eve.turns
                  WHERE conversation_id = ${input.conversationId}
                    AND ingress_id = ${input.ingressId}
                  FOR UPDATE
                `
                );
                if (ingress.length === 1) {
                  const prior = yield* Schema.decodeUnknownEffect(TurnRow)(
                    ingress[0]
                  ).pipe(Effect.mapError(() => unavailable()));
                  if (prior.intent_digest !== intentDigest) {
                    return yield* conflict;
                  }
                  return {
                    conversationId: prior.conversation_id,
                    ingressId: prior.ingress_id,
                    phase: prior.phase,
                    turnId: prior.turn_id,
                    version: prior.version,
                  } satisfies EveTurn;
                }
                yield* mapSql(
                  sql`
                  INSERT INTO eve.turns (
                    conversation_id, turn_id, ingress_id, intent_digest, phase,
                    version, lease_owner, lease_epoch, lease_until
                  ) VALUES (
                    ${input.conversationId}, ${input.turnId}, ${input.ingressId},
                    ${intentDigest}, 'Accepted', 1, ${input.attemptId}, 1, NULL
                  )
                `
                );
                yield* mapSql(
                  sql`
                  INSERT INTO eve.provider_attempts (
                    conversation_id, turn_id, attempt_id, lease_epoch, state
                  ) VALUES (
                    ${input.conversationId}, ${input.turnId}, ${input.attemptId},
                    1, 'unresolved'
                  )
                `
                );
                yield* mapSql(
                  sql`
                  UPDATE eve.conversations
                  SET revision = revision + 1
                  WHERE conversation_id = ${input.conversationId}
                `
                );
                return {
                  conversationId: input.conversationId,
                  ingressId: input.ingressId,
                  phase: "Accepted" as const,
                  turnId: input.turnId,
                  version: "1",
                } satisfies EveTurn;
              }

              yield* mapSql(
                sql`
                INSERT INTO eve.conversations (
                  conversation_id, owner_principal_id, relationship_id, purpose,
                  world_id, world_realm, profile_id, provider_admission,
                  revision, schema_version
                ) VALUES (
                  ${input.conversationId}, ${input.ownerPrincipalId},
                  ${input.relationshipId}, ${input.purpose},
                  ${world.worldId}, ${world.worldRealm},
                  ${input.profileId}, ${input.providerAdmission},
                  1, 'eve.v1'
                )
              `
              );
              yield* mapSql(
                sql`
                INSERT INTO eve.turns (
                  conversation_id, turn_id, ingress_id, intent_digest, phase,
                  version, lease_owner, lease_epoch, lease_until
                ) VALUES (
                  ${input.conversationId}, ${input.turnId}, ${input.ingressId},
                  ${intentDigest}, 'Accepted', 1, ${input.attemptId}, 1, NULL
                )
              `
              );
              yield* mapSql(
                sql`
                INSERT INTO eve.provider_attempts (
                  conversation_id, turn_id, attempt_id, lease_epoch, state
                ) VALUES (
                  ${input.conversationId}, ${input.turnId}, ${input.attemptId},
                  1, 'unresolved'
                )
              `
              );
              return {
                conversationId: input.conversationId,
                ingressId: input.ingressId,
                phase: "Accepted" as const,
                turnId: input.turnId,
                version: "1",
              } satisfies EveTurn;
            })
          )
          .pipe(Effect.mapError(() => unavailable()));
      }),

    cancelTurn: (input: CancelTurnInput) =>
      Effect.gen(function* cancel() {
        return yield* sql
          .withTransaction(
            Effect.gen(function* tx() {
              yield* loadOwnedConversation(input);
              const rows = yield* mapSql(
                sql`
                SELECT conversation_id, turn_id, ingress_id, intent_digest, phase,
                       version::text AS version, lease_owner, lease_epoch::text AS lease_epoch
                FROM eve.turns
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                FOR UPDATE
              `
              );
              if (rows.length !== 1) {
                return yield* notFound;
              }
              const turn = yield* Schema.decodeUnknownEffect(TurnRow)(
                rows[0]
              ).pipe(Effect.mapError(() => unavailable()));
              if (turn.phase === "Settled") {
                return yield* conflict;
              }
              if (turn.phase === "Cancelled") {
                return {
                  conversationId: turn.conversation_id,
                  ingressId: turn.ingress_id,
                  phase: "Cancelled" as const,
                  turnId: turn.turn_id,
                  version: turn.version,
                } satisfies EveTurn;
              }
              yield* mapSql(
                sql`
                UPDATE eve.turns
                SET phase = 'Cancelled', lease_owner = NULL, lease_until = NULL
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                  AND phase = 'Accepted'
              `
              );
              yield* mapSql(
                sql`
                UPDATE eve.provider_attempts
                SET state = 'cancelled', resolved_at = clock_timestamp()
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                  AND state = 'unresolved'
              `
              );
              return {
                conversationId: turn.conversation_id,
                ingressId: turn.ingress_id,
                phase: "Cancelled" as const,
                turnId: turn.turn_id,
                version: turn.version,
              } satisfies EveTurn;
            })
          )
          .pipe(Effect.mapError(() => unavailable()));
      }),

    recover: (input: RecoverJournalInput) =>
      Effect.gen(function* recover() {
        yield* loadOwnedConversation(input);
        return yield* loadSnapshot(input.conversationId);
      }),

    settleMessage: (input: SettleMessageInput) =>
      Effect.gen(function* settle() {
        return yield* sql
          .withTransaction(
            Effect.gen(function* tx() {
              const conversation = yield* loadOwnedConversation({
                conversationId: input.conversationId,
                ownerPrincipalId: input.ownerPrincipalId,
                purpose: input.purpose,
                worldRef: input.worldRef,
              });
              if (!isAdmittedProvider(conversation.provider_admission)) {
                return yield* blockedProfile;
              }
              const turnRows = yield* mapSql(
                sql`
                SELECT conversation_id, turn_id, ingress_id, intent_digest, phase,
                       version::text AS version, lease_owner, lease_epoch::text AS lease_epoch
                FROM eve.turns
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                FOR UPDATE
              `
              );
              if (turnRows.length !== 1) {
                return yield* notFound;
              }
              const turn = yield* Schema.decodeUnknownEffect(TurnRow)(
                turnRows[0]
              ).pipe(Effect.mapError(() => unavailable()));
              if (turn.phase === "Cancelled") {
                return yield* conflict;
              }
              if (turn.phase === "Settled") {
                const messageRows = yield* mapSql(
                  sql`
                  SELECT turn_id, message_id, visible_text, uncertainty, state, evidence_links
                  FROM eve.messages
                  WHERE conversation_id = ${input.conversationId}
                    AND turn_id = ${input.turnId}
                `
                );
                if (messageRows.length !== 1) {
                  return yield* conflict;
                }
                const decoded = yield* Schema.decodeUnknownEffect(MessageRow)(
                  messageRows[0]
                ).pipe(Effect.mapError(() => unavailable()));
                return {
                  evidenceLinks: decodeLinks(decoded.evidence_links),
                  messageId: decoded.message_id,
                  state: decoded.state,
                  turnId: decoded.turn_id,
                  uncertainty: decoded.uncertainty,
                  visibleText: decoded.visible_text,
                } satisfies EveVisibleMessage;
              }
              // CAS: only the lease owner/epoch may settle visible output.
              const updated = yield* mapSql(
                sql`
                UPDATE eve.turns
                SET phase = 'Settled', lease_owner = NULL, lease_until = NULL
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                  AND phase = 'Accepted'
                  AND lease_owner = ${input.attemptId}
                  AND lease_epoch >= 1
                RETURNING turn_id
              `
              );
              if (updated.length !== 1) {
                return yield* conflict;
              }
              const attemptUpdate = yield* mapSql(
                sql`
                UPDATE eve.provider_attempts
                SET state = 'settled', resolved_at = clock_timestamp()
                WHERE conversation_id = ${input.conversationId}
                  AND turn_id = ${input.turnId}
                  AND attempt_id = ${input.attemptId}
                  AND state = 'unresolved'
                RETURNING attempt_id
              `
              );
              if (attemptUpdate.length !== 1) {
                return yield* conflict;
              }
              yield* mapSql(
                sql`
                INSERT INTO eve.messages (
                  conversation_id, turn_id, message_id, visible_text,
                  uncertainty, state, evidence_links
                ) VALUES (
                  ${input.conversationId}, ${input.turnId}, ${input.messageId},
                  ${input.visibleText}, ${input.uncertainty}, 'Visible',
                  ${JSON.stringify(input.evidenceLinks)}::jsonb
                )
              `
              );
              return {
                evidenceLinks: [...input.evidenceLinks],
                messageId: input.messageId,
                state: "Visible" as const,
                turnId: input.turnId,
                uncertainty: input.uncertainty,
                visibleText: input.visibleText,
              } satisfies EveVisibleMessage;
            })
          )
          .pipe(Effect.mapError(() => unavailable()));
      }),
  });
});

export const makeDurableEveJournalLayer = (config: EveJournalPostgresConfig) =>
  Layer.effect(EveJournal, makeDurableEveJournal).pipe(
    Layer.provide(
      Layer.effectDiscard(checkEveJournalRuntimeRole).pipe(
        Layer.provideMerge(
          makeWorldsPostgresLayer({
            applicationName: config.applicationName,
            maxConnections: config.maxConnections,
            url: config.url,
          })
        )
      )
    )
  );

/** Convenience: same URL wiring used by composition when journal identity exists. */
export const durableEveJournalLayerFromUrl = (
  url: RedactedType.Redacted,
  applicationName = "zoen-eve-journal"
) =>
  makeDurableEveJournalLayer({
    applicationName,
    maxConnections: 4,
    url,
  });
