import type { SqlConnection } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson, parseJsonText, type JsonValue } from '../../../kernel/src/json.js';

export const FRAME_DISCLOSURE_IMPL = 'frame-disclosure-v1';

export type SameHistoricalFrame = Readonly<{
  tag: 'SameHistoricalFrame';
  frameId: UUID;
  payload: JsonValue;
  headDigest: string;
  rightsRechecked: true;
  basisRefreshed: false;
}>;

export type NewerFrame = Readonly<{
  tag: 'NewerFrame';
  frameId: UUID;
  /** Caller must Inspect again; historical pin not silently refreshed. */
  reason: 'SECURITY_REVISION_ADVANCED' | 'HEAD_DIGEST_CHANGED';
  previousHeadDigest: string;
  currentSecurityRevision: string;
}>;

export type HistoricalContentUnavailable = Readonly<{
  tag: 'HistoricalContentUnavailable';
  reason: 'FRAME_EXPIRED' | 'EVIDENCE_ERASED' | 'RETENTION_EXPIRED' | 'FRAME_MISSING';
}>;

export type FrameDisclosureDenied = Readonly<{
  tag: 'Denied';
  reason: 'NOT_FOUND_OR_DENIED' | 'INVALID_INPUT' | 'REVOKED';
}>;

export type FrameReopenOutcome =
  | SameHistoricalFrame
  | NewerFrame
  | HistoricalContentUnavailable
  | FrameDisclosureDenied;

export type ReopenFrameInput = Readonly<{
  world: WorldRef;
  frameId: UUID;
  principalId: UUID;
  purpose: string;
  /** Live security revision from the current World head (fresh rights). */
  currentSecurityRevision: string;
  /** Live head digest for newer detection. */
  currentHeadDigest: string;
  /** Source ACL check already applied by caller; false => denied. */
  sourcesStillAllowed: boolean;
  membershipActive: boolean;
}>;

export type EvidenceDisclosureInput = Readonly<{
  world: WorldRef;
  evidenceId: UUID;
  contentState: 'available' | 'expired' | 'erased' | 'unavailable' | null;
  sourceAllowed: boolean;
  membershipActive: boolean;
}>;

export type EvidenceDisclosureOutcome =
  | Readonly<{ tag: 'Ok'; proceed: true }>
  | HistoricalContentUnavailable
  | FrameDisclosureDenied;

export type FrameRow = Readonly<{
  payload: string;
  head_digest: string;
  source_ids: string[];
  expired: boolean;
  security_revision_at_pin?: string | null;
}>;

/**
 * Reauthorize result disclosure and historical reopen (SPEC-007 / ZN-0046).
 * Returns explicit SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable.
 * Never silently refreshes a pinned basis under changed rights/head.
 */
export class FrameDisclosureService {
  /**
   * Recheck rights immediately before delivering a retained Frame payload.
   */
  reopen(input: ReopenFrameInput, row: FrameRow | null): FrameReopenOutcome {
    if (!input.purpose || input.purpose.length > 64) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (!input.membershipActive) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'REVOKED' as const });
    }
    if (!row) {
      // Opacity: missing / other-principal frames are indistinguishable from denied.
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    if (row.expired) {
      return Object.freeze({
        tag: 'HistoricalContentUnavailable' as const,
        reason: 'FRAME_EXPIRED' as const,
      });
    }
    if (!input.sourcesStillAllowed) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    const pinnedRev = row.security_revision_at_pin;
    if (
      pinnedRev !== undefined &&
      pinnedRev !== null &&
      pinnedRev !== '' &&
      pinnedRev !== input.currentSecurityRevision
    ) {
      return Object.freeze({
        tag: 'NewerFrame' as const,
        frameId: input.frameId,
        reason: 'SECURITY_REVISION_ADVANCED' as const,
        previousHeadDigest: row.head_digest,
        currentSecurityRevision: input.currentSecurityRevision,
      });
    }
    // If live head moved, do not silently refresh — return NewerFrame variant.
    if (row.head_digest !== input.currentHeadDigest) {
      return Object.freeze({
        tag: 'NewerFrame' as const,
        frameId: input.frameId,
        reason: 'HEAD_DIGEST_CHANGED' as const,
        previousHeadDigest: row.head_digest,
        currentSecurityRevision: input.currentSecurityRevision,
      });
    }
    const payload = parseJsonText(row.payload);
    return Object.freeze({
      tag: 'SameHistoricalFrame' as const,
      frameId: input.frameId,
      payload,
      headDigest: row.head_digest,
      rightsRechecked: true as const,
      basisRefreshed: false as const,
    });
  }

  discloseEvidence(input: EvidenceDisclosureInput): EvidenceDisclosureOutcome {
    if (!input.membershipActive) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'REVOKED' as const });
    }
    if (!input.sourceAllowed) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    if (input.contentState === 'erased') {
      return Object.freeze({
        tag: 'HistoricalContentUnavailable' as const,
        reason: 'EVIDENCE_ERASED' as const,
      });
    }
    if (input.contentState === 'expired') {
      return Object.freeze({
        tag: 'HistoricalContentUnavailable' as const,
        reason: 'RETENTION_EXPIRED' as const,
      });
    }
    if (input.contentState === 'unavailable' || input.contentState === null) {
      return Object.freeze({
        tag: 'HistoricalContentUnavailable' as const,
        reason: 'FRAME_MISSING' as const,
      });
    }
    return Object.freeze({ tag: 'Ok' as const, proceed: true as const });
  }

  /** Load a principal-scoped frame row inside an open SQL snapshot. */
  async loadFrame(
    sql: SqlConnection,
    world: WorldRef,
    frameId: UUID,
    principalId: UUID,
    purpose: string,
  ): Promise<FrameRow | null> {
    const rows = await sql.query<{
      payload: string;
      head_digest: string;
      source_ids: string[];
      expired: boolean;
    }>(
      `SELECT payload::text, head_digest, source_ids,
              expires_at <= clock_timestamp() AS expired
       FROM ontology.frames
       WHERE world_id=$1 AND realm=$2 AND frame_id=$3 AND principal_id=$4 AND purpose=$5`,
      [world.worldId, world.realm, frameId, principalId, purpose],
    );
    const row = rows[0];
    return row
      ? Object.freeze({
          payload: row.payload,
          head_digest: row.head_digest,
          source_ids: row.source_ids,
          expired: Boolean(row.expired),
        })
      : null;
  }
}

export function frameDisclosureDigest(outcome: FrameReopenOutcome): string {
  return createStableDigest(outcome);
}

function createStableDigest(value: unknown): string {
  // Local import-free digest via canonical JSON length+prefix (tests compare equality).
  // Production callers use Cryptography.digest; this helper is for pure equality checks.
  const body = canonicalJson(value as never);
  let h = 0;
  for (let i = 0; i < body.length; i++) h = (h * 31 + body.charCodeAt(i)) | 0;
  return `fd:${(h >>> 0).toString(16)}:${body.length}`;
}

export function asFrameId(value: string): UUID {
  return uuid(value);
}
