import type { Authorizer, Membership, Resource } from '../../../contracts/src/ports.js';
import type { OperationDescriptor, VerifiedContext } from '../../../contracts/src/semantic.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson, type JsonValue } from '../../../kernel/src/json.js';
import { OPERATIONS, FOUNDATION, operation } from './registry.js';

export const DISCOVERY_IMPL = 'authorized-discovery-v1';

/** Released field catalog with sensitivity — clinical notes are owner-only. */
export type DiscoveryFieldDef = Readonly<{
  id: string;
  valueType: 'decimal' | 'string' | 'boolean';
  units: readonly string[];
  sensitivity: 'shared' | 'owner-only';
  description: string;
}>;

export const DISCOVERY_FIELDS: readonly DiscoveryFieldDef[] = Object.freeze([
  ...FOUNDATION.predicates.map((p) =>
    Object.freeze({
      id: p.id,
      valueType: p.valueType as DiscoveryFieldDef['valueType'],
      units: Object.freeze([...p.units]) as readonly string[],
      sensitivity: 'shared' as const,
      description: `Released predicate ${p.id} (${p.valueType})`,
    }),
  ),
  Object.freeze({
    id: 'record.clinical_note',
    valueType: 'string' as const,
    units: Object.freeze([]) as readonly string[],
    sensitivity: 'owner-only' as const,
    description: 'Clinical note (owner-only; hidden from non-clinical roles)',
  }),
]);

export type EvidenceDeepLink = Readonly<{
  kind: 'evidence';
  opaqueRef: string;
  /** Present only when the caller is authorized for the underlying source. */
  evidenceId?: UUID;
}>;

export type FieldExplanation = Readonly<{
  fieldId: string;
  text: string;
  evidenceDeepLinks: readonly EvidenceDeepLink[];
}>;

export type AuthorizedDiscoveryManifest = Readonly<{
  worldRef: WorldRef;
  releaseDigest: string;
  securityRevision: string;
  rightsBasis: string;
  sourceAclFreshness: string;
  abi: string;
  operations: readonly JsonValue[];
  fields: readonly JsonValue[];
  explanations: readonly JsonValue[];
  /** Total hidden field count is never disclosed; only the authorized set is listed. */
  incomplete: boolean;
}>;

export type DiscoverInput = Readonly<{
  world: WorldRef;
  context: VerifiedContext;
  membership: Membership;
  purpose: string;
  releaseDigest: string;
  securityRevision: string;
  /** Source ACL watermark / freshness token from the live cut. */
  sourceAclFreshness: string;
  /** Evidence rows the principal may deep-link (already filtered by caller). */
  authorizedEvidence: readonly Readonly<{ evidenceId: UUID; sourceId: UUID }>[];
  authorizer: Authorizer;
  /** Optional hard cap on fields returned; overflow => incomplete (never silent truncate as complete). */
  fieldLimit?: number;
}>;

export type DiscoverOutcome =
  | Readonly<{ tag: 'Ok'; value: AuthorizedDiscoveryManifest }>
  | Readonly<{ tag: 'Denied'; reason: 'NOT_FOUND_OR_DENIED' | 'INVALID_INPUT' | 'UNSUPPORTED_LIMIT' }>;

export type ExplainOpaqueInput = Readonly<{
  world: WorldRef;
  context: VerifiedContext;
  membership: Membership;
  purpose: string;
  opaqueRef: string;
  /** Map of opaqueRef -> authorized evidence (omit denied/hidden). */
  authorizedByRef: ReadonlyMap<string, Readonly<{ evidenceId: UUID; fieldId: string; text: string }>>;
}>;

export type ExplainOpaqueOutcome =
  | Readonly<{ tag: 'Ok'; value: Readonly<{ fieldId: string; text: string; evidenceId: UUID }> }>
  | Readonly<{ tag: 'Denied'; reason: 'NOT_FOUND_OR_DENIED' | 'INVALID_INPUT' }>;

function opaqueEvidenceRef(worldId: string, evidenceId: string): string {
  return `zoen:disc:ev:${worldId}:${evidenceId}`;
}

function canSeeSensitivity(
  membership: Membership,
  sensitivity: 'shared' | 'owner-only',
): boolean {
  if (membership.state !== 'active') return false;
  if (sensitivity === 'shared') return true;
  // owner-only clinical fields: owner or editor (clinician); viewer (receptionist) denied
  return membership.role === 'owner' || membership.role === 'editor';
}

/**
 * Authorized discovery + explanation references (SPEC-007 / ZN-0044).
 * Filters operations and fields under current rights and source ACL freshness;
 * builds text descriptions and evidence deep links from the same released metadata;
 * keeps hidden-resource denial indistinguishable from absence.
 */
export class DiscoveryService {
  async discover(input: DiscoverInput): Promise<DiscoverOutcome> {
    if (!input.purpose || input.purpose.length > 64) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (!input.releaseDigest || input.releaseDigest.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (input.membership.state !== 'active') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    const fieldLimit = input.fieldLimit ?? 256;
    if (!Number.isInteger(fieldLimit) || fieldLimit < 1) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (fieldLimit > 512) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'UNSUPPORTED_LIMIT' as const });
    }

    const discoverOp = operation('Discover');
    if (!discoverOp) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    const worldResource: Resource = {
      world: input.world,
      sourceId: null,
      sensitivity: 'shared',
    };
    if (
      !(await input.authorizer.authorize(
        input.context,
        discoverOp,
        worldResource,
        input.membership,
        input.purpose,
      ))
    ) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }

    const operations: JsonValue[] = [];
    for (const candidate of OPERATIONS) {
      if (candidate.scope !== 'world') continue;
      const allowed = await input.authorizer.authorize(
        input.context,
        candidate,
        worldResource,
        input.membership,
        input.purpose,
      );
      if (allowed) {
        operations.push(
          Object.freeze({
            id: candidate.id,
            kind: candidate.kind,
            scope: candidate.scope,
            requiresBasis: candidate.requiresBasis,
            published: candidate.published,
            inputSchemaId: candidate.inputSchemaId,
            description: `Released operation ${candidate.id}`,
          }) as JsonValue,
        );
      }
    }

    const visibleFields = DISCOVERY_FIELDS.filter((f) =>
      canSeeSensitivity(input.membership, f.sensitivity),
    );
    const incomplete = visibleFields.length > fieldLimit;
    const fieldsSlice = visibleFields.slice(0, fieldLimit);

    const fields: JsonValue[] = fieldsSlice.map((f) =>
      Object.freeze({
        id: f.id,
        valueType: f.valueType,
        units: [...f.units],
        sensitivity: f.sensitivity,
        description: f.description,
        schema: {
          type: f.valueType,
          units: [...f.units],
        },
      }) as JsonValue,
    );

    // Evidence deep links only for authorized evidence; never enumerate hidden clinical evidence.
    const deepLinks: EvidenceDeepLink[] = input.authorizedEvidence.map((ev) =>
      Object.freeze({
        kind: 'evidence' as const,
        opaqueRef: opaqueEvidenceRef(input.world.worldId, ev.evidenceId),
        evidenceId: ev.evidenceId,
      }),
    );

    const explanations: JsonValue[] = fieldsSlice.map((f) => {
      const links =
        f.sensitivity === 'owner-only'
          ? deepLinks // clinician may see clinical evidence refs when authorized
          : deepLinks;
      return Object.freeze({
        fieldId: f.id,
        text: f.description,
        evidenceDeepLinks: links.map((l) =>
          Object.freeze({
            kind: l.kind,
            opaqueRef: l.opaqueRef,
            ...(l.evidenceId !== undefined ? { evidenceId: l.evidenceId } : {}),
          }),
        ),
      }) as JsonValue;
    });

    const rightsBasis = [
      DISCOVERY_IMPL,
      input.membership.role,
      input.securityRevision,
      input.sourceAclFreshness,
    ].join('|');

    const manifest: AuthorizedDiscoveryManifest = Object.freeze({
      worldRef: Object.freeze({ ...input.world }),
      releaseDigest: input.releaseDigest,
      securityRevision: input.securityRevision,
      rightsBasis,
      sourceAclFreshness: input.sourceAclFreshness,
      abi: FOUNDATION.abi,
      operations: Object.freeze(operations),
      fields: Object.freeze(fields),
      explanations: Object.freeze(explanations),
      incomplete,
    });

    return Object.freeze({ tag: 'Ok' as const, value: manifest });
  }

  /**
   * Resolve an opaque discovery/explanation ref. Missing and unauthorized are
   * identical NotFoundOrDenied — no existence, count, or URL leakage.
   */
  async explainOpaqueRef(input: ExplainOpaqueInput): Promise<ExplainOpaqueOutcome> {
    if (!input.opaqueRef || input.opaqueRef.length > 200) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (input.membership.state !== 'active') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    // Prefix check only — do not reveal whether the suffix maps to a real row.
    if (!input.opaqueRef.startsWith('zoen:disc:')) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    const hit = input.authorizedByRef.get(input.opaqueRef);
    if (!hit) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    // Defense in depth: clinical field explanations require owner/editor.
    const field = DISCOVERY_FIELDS.find((f) => f.id === hit.fieldId);
    if (field && !canSeeSensitivity(input.membership, field.sensitivity)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'NOT_FOUND_OR_DENIED' as const });
    }
    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({
        fieldId: hit.fieldId,
        text: hit.text,
        evidenceId: hit.evidenceId,
      }),
    });
  }
}

/** Pure helper: redact a discovery payload for leak scans (tests / audit). */
export function discoveryLeakScan(
  payload: unknown,
  hiddenFieldIds: readonly string[],
  hiddenEvidenceIds: readonly string[],
): readonly string[] {
  const blob = canonicalJson(payload as never).toLowerCase();
  const leaks: string[] = [];
  for (const id of hiddenFieldIds) {
    if (blob.includes(id.toLowerCase())) leaks.push(`field:${id}`);
  }
  for (const id of hiddenEvidenceIds) {
    if (blob.includes(id.toLowerCase())) leaks.push(`evidence:${id}`);
  }
  // Existence / count / URL shaped leakage markers
  for (const marker of ['row_count', 'rowcount', 'exists:', 'http://', 'https://', 's3://', 'presign']) {
    if (blob.includes(marker)) leaks.push(`marker:${marker}`);
  }
  return Object.freeze(leaks);
}

export function buildOpaqueEvidenceRef(worldId: UUID | string, evidenceId: UUID | string): string {
  return opaqueEvidenceRef(String(worldId), String(evidenceId));
}

export function asMembership(
  principalId: string,
  role: Membership['role'],
  state: Membership['state'] = 'active',
): Membership {
  return Object.freeze({
    principalId: uuid(principalId),
    role,
    state,
  });
}
