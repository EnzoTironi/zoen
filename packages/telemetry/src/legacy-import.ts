/// <reference types="node" />
import { randomUUID } from 'node:crypto';
import type { LegacyManifestStore } from './ports.js';
import type {
  LegacyImportManifest,
  LegacyImportOutcome,
  LegacySubject,
} from './types.js';

export const LEGACY_IMPORT_IMPL = 'telemetry-legacy-import-v1';
export const MANIFEST_VERSION = 'legacy-import-manifest-v1';

const SECRET_RE =
  /(password\s*=|secret\s*=|Bearer\s+[A-Za-z0-9._\-]+|AKIA[0-9A-Z]{16}|-----BEGIN)/i;

const BROAD_ADMIN_ROLES = new Set(['administrator', 'admin', 'superuser', 'root']);

export type LegacyExportInput = Readonly<{
  legacySourceCommit: string;
  subjects: readonly LegacySubject[];
  knownSubjects: readonly string[];
  /** Must be evaluation for rehearsal. */
  realm: 'evaluation' | 'live';
  productionMarker: string;
  profileSubjectLimit?: number;
}>;

/**
 * Non-destructive legacy import qualification (SPEC-008 / ZN-0050).
 * Versioned manifests; evaluation-only rehearsal through normal admission;
 * never auto-grant administrator; never mutate OS production.
 */
export class LegacyImportService {
  constructor(private readonly store: LegacyManifestStore | null) {}

  async rehearse(input: LegacyExportInput): Promise<LegacyImportOutcome> {
    if (!input.legacySourceCommit || input.legacySourceCommit.length < 7) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (SECRET_RE.test(input.legacySourceCommit) || input.subjects.some((s) => SECRET_RE.test(s.email) || SECRET_RE.test(s.legacyId))) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'FORBIDDEN_PAYLOAD' as const });
    }
    if (input.realm === 'live') {
      return Object.freeze({ tag: 'Denied' as const, reason: 'LIVE_REALM_FORBIDDEN' as const });
    }
    const limit = input.profileSubjectLimit ?? 10_000;
    if (input.subjects.length > limit) {
      return Object.freeze({
        tag: 'Unsupported' as const,
        reason: 'PROFILE_LIMIT' as const,
        observed: input.subjects.length,
        limit,
      });
    }
    if (!this.store) {
      return Object.freeze({ tag: 'Blocked' as const, reason: 'MISSING_STORE' as const });
    }

    await this.store.ensureProductionMarker(input.productionMarker);
    const before = await this.store.getProductionMarker(input.productionMarker);
    if (!before || before.mutated) {
      return Object.freeze({ tag: 'Blocked' as const, reason: 'PRODUCTION_MUTATION_FORBIDDEN' as const });
    }

    const known = new Set(input.knownSubjects);
    const rightsMapping: Array<{
      legacyId: string;
      mappedRole: string | null;
      admitted: boolean;
      reason: string;
    }> = [];
    const unmatched: string[] = [];
    const diffs: string[] = [];
    let admitted = 0;
    let rolesDenied = 0;

    // Stable order for deterministic diffs; duplicate/reordered inputs yield same oracle
    const ordered = [...input.subjects].sort((a, b) => a.legacyId.localeCompare(b.legacyId));

    for (const subject of ordered) {
      const isAdmin = BROAD_ADMIN_ROLES.has(subject.role.toLowerCase());
      const isKnown = known.has(subject.legacyId);

      if (!isKnown) {
        unmatched.push(subject.legacyId);
        rightsMapping.push(
          Object.freeze({
            legacyId: subject.legacyId,
            mappedRole: null,
            admitted: false,
            reason: 'UNMATCHED_SUBJECT',
          }),
        );
        diffs.push(`unmatched:${subject.legacyId}`);
        continue;
      }

      if (isAdmin) {
        // Never auto-grant broad administrator — report discrepancy, require owner approval
        rolesDenied += 1;
        rightsMapping.push(
          Object.freeze({
            legacyId: subject.legacyId,
            mappedRole: null,
            admitted: false,
            reason: 'ADMINISTRATOR_NOT_AUTO_GRANTED',
          }),
        );
        diffs.push(`admin-denied:${subject.legacyId}`);
        continue;
      }

      // Normal admission path: map member → evaluation member (not copied blindly from legacy)
      admitted += 1;
      rightsMapping.push(
        Object.freeze({
          legacyId: subject.legacyId,
          mappedRole: 'evaluation.member',
          admitted: true,
          reason: 'ADMITTED_VIA_NORMAL_PATH',
        }),
      );
    }

    const after = await this.store.getProductionMarker(input.productionMarker);
    if (!after || after.mutated) {
      return Object.freeze({ tag: 'Blocked' as const, reason: 'PRODUCTION_MUTATION_FORBIDDEN' as const });
    }

    const manifest: LegacyImportManifest = Object.freeze({
      manifestId: randomUUID(),
      version: MANIFEST_VERSION,
      legacySourceCommit: input.legacySourceCommit,
      realm: 'evaluation',
      rowCounts: Object.freeze({
        subjects: input.subjects.length,
        admitted,
        unmatched: unmatched.length,
        rolesDenied,
      }),
      rightsMapping: Object.freeze(rightsMapping),
      unmatchedRecords: Object.freeze(unmatched),
      semanticDiffs: Object.freeze(diffs),
      cutoverApproved: false,
      administratorAutoGranted: false,
    });

    await this.store.save(manifest);
    return Object.freeze({ tag: 'Ok' as const, value: manifest });
  }
}
