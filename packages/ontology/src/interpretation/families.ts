import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';

export const FAMILIES_IMPL = 'source-families-v1';

export type EvidenceLinkKind = 'original' | 'copy' | 'derived';

export type EvidenceLink = Readonly<{
  evidenceId: string;
  /** Provenance parent; null for original roots. */
  parentEvidenceId: string | null;
  kind: EvidenceLinkKind;
}>;

export type FamilySupportInput = Readonly<{
  statementId: string;
  evidence: readonly EvidenceLink[];
}>;

export type IndependentFamily = Readonly<{
  familyId: string;
  rootEvidenceId: string;
  memberEvidenceIds: readonly string[];
  /** Copies/derived in this family contribute 1 independent vote total. */
  independentSupport: 1;
}>;

export type FamilySupportOk = Readonly<{
  tag: 'Ok';
  statementId: string;
  families: readonly IndependentFamily[];
  independentSupportCount: number;
  attributableEvidenceIds: readonly string[];
  resultDigest: string;
}>;

export type FamilySupportError = Readonly<{
  tag: 'InvalidInput';
  code:
    | 'EMPTY_EVIDENCE'
    | 'INVALID_EVIDENCE_ID'
    | 'INVALID_KIND'
    | 'UNKNOWN_PARENT'
    | 'DERIVATION_CYCLE'
    | 'SELF_PARENT'
    | 'DUPLICATE_EVIDENCE'
    | 'EVIDENCE_LIMIT';
  detail?: string;
}>;

export type FamilySupportResult = FamilySupportOk | FamilySupportError;

const MAX_EVIDENCE = 10_000;
const ID_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fail(code: FamilySupportError['code'], detail?: string): FamilySupportError {
  return Object.freeze(detail ? { tag: 'InvalidInput' as const, code, detail } : { tag: 'InvalidInput' as const, code });
}

/** Walk parent links to the original root; detect cycles. */
export function resolveRoot(
  evidenceId: string,
  byId: ReadonlyMap<string, EvidenceLink>,
): { tag: 'Ok'; rootId: string; path: string[] } | { tag: 'Cycle'; path: string[] } | { tag: 'UnknownParent'; id: string } {
  const seen = new Set<string>();
  const path: string[] = [];
  let current: string | null = evidenceId;
  while (current) {
    if (seen.has(current)) return { tag: 'Cycle', path: [...path, current] };
    seen.add(current);
    path.push(current);
    const node = byId.get(current);
    if (!node) return { tag: 'UnknownParent', id: current };
    if (node.kind === 'original' || node.parentEvidenceId === null) {
      return { tag: 'Ok', rootId: current, path };
    }
    if (node.parentEvidenceId === current) return { tag: 'Cycle', path: [...path, current] };
    current = node.parentEvidenceId;
  }
  return { tag: 'Ok', rootId: path[path.length - 1]!, path };
}

/**
 * Collapse dependent source families without deleting provenance (SPEC-005 / ZN-0032).
 * Copied/derived evidence under one ancestry root → one independent support vote;
 * every evidence link remains attributable.
 */
export function computeFamilySupport(input: FamilySupportInput): FamilySupportResult {
  requireThat(typeof input.statementId === 'string' && ID_RE.test(input.statementId), 'STATEMENT_ID');

  if (!Array.isArray(input.evidence)) return fail('INVALID_KIND', 'EVIDENCE_NOT_ARRAY');
  if (input.evidence.length === 0) return fail('EMPTY_EVIDENCE');
  if (input.evidence.length > MAX_EVIDENCE) return fail('EVIDENCE_LIMIT');

  const byId = new Map<string, EvidenceLink>();
  for (const link of input.evidence) {
    if (!link || typeof link !== 'object') return fail('INVALID_KIND');
    if (typeof link.evidenceId !== 'string' || !ID_RE.test(link.evidenceId)) return fail('INVALID_EVIDENCE_ID');
    if (link.kind !== 'original' && link.kind !== 'copy' && link.kind !== 'derived') return fail('INVALID_KIND');
    if (link.parentEvidenceId !== null && (typeof link.parentEvidenceId !== 'string' || !ID_RE.test(link.parentEvidenceId))) {
      return fail('INVALID_EVIDENCE_ID', 'PARENT');
    }
    if (link.parentEvidenceId === link.evidenceId) return fail('SELF_PARENT');
    if (byId.has(link.evidenceId)) return fail('DUPLICATE_EVIDENCE', link.evidenceId);
    byId.set(link.evidenceId, Object.freeze({ ...link }));
  }

  for (const link of byId.values()) {
    if (link.parentEvidenceId !== null && !byId.has(link.parentEvidenceId)) {
      return fail('UNKNOWN_PARENT', link.parentEvidenceId);
    }
    if (link.kind === 'original' && link.parentEvidenceId !== null) {
      return fail('INVALID_KIND', 'ORIGINAL_WITH_PARENT');
    }
    if ((link.kind === 'copy' || link.kind === 'derived') && link.parentEvidenceId === null) {
      return fail('INVALID_KIND', 'DEPENDENT_WITHOUT_PARENT');
    }
  }

  const membersByRoot = new Map<string, string[]>();
  for (const id of [...byId.keys()].sort()) {
    const resolved = resolveRoot(id, byId);
    if (resolved.tag === 'Cycle') return fail('DERIVATION_CYCLE', resolved.path.join('>'));
    if (resolved.tag === 'UnknownParent') return fail('UNKNOWN_PARENT', resolved.id);
    const bucket = membersByRoot.get(resolved.rootId) ?? [];
    bucket.push(id);
    membersByRoot.set(resolved.rootId, bucket);
  }

  const families: IndependentFamily[] = [];
  for (const rootId of [...membersByRoot.keys()].sort()) {
    const members = Object.freeze([...(membersByRoot.get(rootId) ?? [])].sort());
    families.push(
      Object.freeze({
        familyId: sha256Text(canonicalJson({ root: rootId, members } as never)),
        rootEvidenceId: rootId,
        memberEvidenceIds: members,
        independentSupport: 1 as const,
      }),
    );
  }

  const attributable = Object.freeze([...byId.keys()].sort());
  const independentSupportCount = families.length;
  const resultDigest = sha256Text(
    canonicalJson({
      statementId: input.statementId,
      families: families.map((f) => ({
        root: f.rootEvidenceId,
        members: [...f.memberEvidenceIds],
        support: f.independentSupport,
      })),
      independentSupportCount,
      attributable,
      impl: FAMILIES_IMPL,
    } as never),
  );

  return Object.freeze({
    tag: 'Ok' as const,
    statementId: input.statementId,
    families: Object.freeze(families),
    independentSupportCount,
    attributableEvidenceIds: attributable,
    resultDigest,
  });
}

/** Reorder-invariant digest of an evidence set identity. */
export function evidenceSetDigest(evidence: readonly EvidenceLink[]): string {
  const normalized = [...evidence]
    .map((e) => ({
      evidenceId: e.evidenceId,
      parentEvidenceId: e.parentEvidenceId,
      kind: e.kind,
    }))
    .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  return sha256Text(canonicalJson(normalized as never));
}
