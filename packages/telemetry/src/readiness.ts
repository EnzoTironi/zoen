/// <reference types="node" />
import { randomUUID } from 'node:crypto';
import type { RecoveryFenceStore, ReadinessClock } from './ports.js';
import type {
  AdmittedDependencies,
  CapabilityReport,
  CapabilityState,
  DrainResult,
  Liveness,
  ReadinessOutcome,
  ReadinessProbe,
} from './types.js';

export const READINESS_IMPL = 'telemetry-readiness-v1';

const SECRET_RE =
  /(password\s*=|secret\s*=|Bearer\s+[A-Za-z0-9._\-]+|AKIA[0-9A-Z]{16}|-----BEGIN)/i;

const FORBIDDEN_ATTR_RE = /(password|secret|token|credential|api[_-]?key|authorization)/i;

/** Core S0 file path stays usable without effect providers. */
export const CORE_CAPABILITIES = Object.freeze(['file-path', 'postgres'] as const);
export const EFFECT_CAPABILITY = 'effect-provider';

export type ReadinessServiceOptions = Readonly<{
  store: RecoveryFenceStore | null;
  clock?: ReadinessClock;
  profileCapabilityLimit?: number;
}>;

/**
 * Readiness, admission flags and graceful drain (SPEC-008 / ZN-0048).
 * Distinguishes liveness from readiness; unadmitted providers are explicit
 * disabled states — never fake-healthy. Drain releases fenced jobs once per epoch.
 */
export class ReadinessService {
  private draining = false;
  private inFlight = 0;
  private readonly completedSemantic = new Set<string>();
  private readonly releasedJobs = new Set<string>();
  private readonly clock: ReadinessClock;
  private readonly store: RecoveryFenceStore | null;
  private readonly profileCapabilityLimit: number;

  constructor(opts: ReadinessServiceOptions) {
    this.store = opts.store;
    this.clock = opts.clock ?? { nowIso: () => new Date().toISOString() };
    this.profileCapabilityLimit = opts.profileCapabilityLimit ?? 64;
  }

  /** Process liveness — independent of dependency readiness. */
  health(): Liveness {
    return Object.freeze({ alive: true as const, checkedAt: this.clock.nowIso() });
  }

  /**
   * Probe admitted dependencies. Unadmitted capabilities are `disabled`,
   * never reported healthy. Incompatible migrations/locks/roles fail readiness.
   */
  readiness(probe: ReadinessProbe): ReadinessOutcome {
    const secretHit = this.scanProbeForSecrets(probe);
    if (secretHit) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'FORBIDDEN_PAYLOAD' as const });
    }

    const totalCaps =
      (probe.admittedCapabilities?.length ?? 0) + (probe.unadmittedCapabilities?.length ?? 0);
    if (totalCaps > this.profileCapabilityLimit) {
      return Object.freeze({
        tag: 'Unsupported' as const,
        reason: 'PROFILE_LIMIT' as const,
        observed: totalCaps,
        limit: this.profileCapabilityLimit,
      });
    }

    const required = probe.requiredMigrations ?? [];
    const present = new Set(probe.migrationsPresent ?? []);
    const migrationsCompatible = required.every((m) => present.has(m));
    const locksCompatible = probe.locksCompatible !== false;
    const rolesCompatible = probe.rolesCompatible !== false;

    const capabilities: CapabilityReport[] = [];
    for (const id of probe.admittedCapabilities ?? []) {
      let state: CapabilityState = 'admitted';
      let reason: string | null = null;
      if (!migrationsCompatible || !locksCompatible || !rolesCompatible) {
        state = 'incompatible';
        reason = !migrationsCompatible
          ? 'MIGRATIONS_INCOMPATIBLE'
          : !locksCompatible
            ? 'LOCKS_INCOMPATIBLE'
            : 'ROLES_INCOMPATIBLE';
      } else if (this.draining) {
        state = 'draining';
        reason = 'GRACEFUL_DRAIN';
      }
      capabilities.push(Object.freeze({ id, state, reason }));
    }
    for (const id of probe.unadmittedCapabilities ?? []) {
      // Explicit disabled — never fake healthy for unadmitted providers
      capabilities.push(
        Object.freeze({
          id,
          state: 'disabled' as const,
          reason: 'UNADMITTED_PROVIDER',
        }),
      );
    }

    const filePath = capabilities.find((c) => c.id === 'file-path');
    const coreUsable =
      migrationsCompatible &&
      locksCompatible &&
      rolesCompatible &&
      filePath !== undefined &&
      (filePath.state === 'admitted' || filePath.state === 'draining');

    const effects = capabilities.find((c) => c.id === EFFECT_CAPABILITY);
    const effectsUnavailable =
      effects === undefined || effects.state === 'disabled' || effects.state === 'unavailable';

    const ready =
      coreUsable &&
      !this.draining &&
      migrationsCompatible &&
      locksCompatible &&
      rolesCompatible;

    const value: AdmittedDependencies = Object.freeze({
      ready,
      coreUsable,
      effectsUnavailable,
      migrationsCompatible,
      locksCompatible,
      rolesCompatible,
      capabilities: Object.freeze(capabilities),
      draining: this.draining,
      inFlight: this.inFlight,
      checkedAt: this.clock.nowIso(),
      impl: READINESS_IMPL,
    });
    return Object.freeze({ tag: 'Ok' as const, value });
  }

  discoverCapabilities(probe: ReadinessProbe): ReadinessOutcome {
    return this.readiness(probe);
  }

  /** Admit a request while not draining; returns semantic id for exactly-once completion. */
  admitRequest(semanticId: string): ReadinessOutcome {
    if (!semanticId || semanticId.length > 128) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (SECRET_RE.test(semanticId) || FORBIDDEN_ATTR_RE.test(semanticId)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'FORBIDDEN_PAYLOAD' as const });
    }
    if (this.completedSemantic.has(semanticId)) {
      // Replay of completed semantic — no duplicate side effect (even while draining)
      return Object.freeze({
        tag: 'Ok' as const,
        value: Object.freeze({
          semanticId,
          status: 'already-completed' as const,
          duplicate: false,
        }),
      });
    }
    if (this.draining) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'DRAINING' as const });
    }
    this.inFlight += 1;
    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({ semanticId, status: 'admitted' as const, duplicate: false }),
    });
  }

  completeRequest(semanticId: string): ReadinessOutcome {
    if (!this.completedSemantic.has(semanticId)) {
      if (this.inFlight > 0) this.inFlight -= 1;
      this.completedSemantic.add(semanticId);
    }
    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({
        semanticId,
        status: 'completed' as const,
        duplicate: this.completedSemantic.has(semanticId),
      }),
    });
  }

  beginDrain(): DrainResult {
    this.draining = true;
    return Object.freeze({
      tag: 'Ok' as const,
      draining: true,
      inFlight: this.inFlight,
      releasedJobIds: Object.freeze([] as string[]),
    });
  }

  /**
   * Release/reassign fenced jobs on shutdown. Each (cellId,epoch) release
   * happens once — graceful shutdown creates no duplicate semantic result.
   */
  async releaseFencedJobs(cellId: string): Promise<DrainResult> {
    if (!cellId) {
      return Object.freeze({
        tag: 'Denied' as const,
        reason: 'INVALID_INPUT' as const,
        draining: this.draining,
        inFlight: this.inFlight,
        releasedJobIds: Object.freeze([] as string[]),
      });
    }
    if (!this.store) {
      return Object.freeze({
        tag: 'Blocked' as const,
        reason: 'MISSING_FENCE_STORE' as const,
        draining: this.draining,
        inFlight: this.inFlight,
        releasedJobIds: Object.freeze([] as string[]),
      });
    }
    this.draining = true;
    const fence = await this.store.getFence(cellId);
    if (!fence) {
      // create dispatch-disabled fence
      const created = await this.store.upsertFence({
        cellId,
        epoch: 1,
        dispatchEnabled: false,
        deletionLedgerCut: null,
      });
      const key = `${created.cellId}:${created.epoch}`;
      if (this.releasedJobs.has(key)) {
        return Object.freeze({
          tag: 'Ok' as const,
          draining: true,
          inFlight: this.inFlight,
          releasedJobIds: Object.freeze([] as string[]),
          duplicateSuppressed: true,
        });
      }
      this.releasedJobs.add(key);
      return Object.freeze({
        tag: 'Ok' as const,
        draining: true,
        inFlight: this.inFlight,
        releasedJobIds: Object.freeze([created.cellId]),
        epoch: created.epoch,
        dispatchEnabled: false,
      });
    }
    const key = `${fence.cellId}:${fence.epoch}`;
    if (this.releasedJobs.has(key) || fence.dispatchEnabled === false) {
      // Already released this epoch — no duplicate semantic result
      return Object.freeze({
        tag: 'Ok' as const,
        draining: true,
        inFlight: this.inFlight,
        releasedJobIds: Object.freeze([] as string[]),
        duplicateSuppressed: true,
        epoch: fence.epoch,
        dispatchEnabled: false,
      });
    }
    const next = await this.store.upsertFence({
      cellId: fence.cellId,
      epoch: fence.epoch + 1,
      dispatchEnabled: false,
      deletionLedgerCut: fence.deletionLedgerCut,
    });
    const nextKey = `${next.cellId}:${next.epoch}`;
    this.releasedJobs.add(key);
    this.releasedJobs.add(nextKey);
    return Object.freeze({
      tag: 'Ok' as const,
      draining: true,
      inFlight: this.inFlight,
      releasedJobIds: Object.freeze([next.cellId]),
      epoch: next.epoch,
      dispatchEnabled: false,
    });
  }

  async completeDrain(cellId: string): Promise<DrainResult> {
    if (this.inFlight > 0) {
      return Object.freeze({
        tag: 'Blocked' as const,
        reason: 'IN_FLIGHT_REMAINING' as const,
        draining: true,
        inFlight: this.inFlight,
        releasedJobIds: Object.freeze([] as string[]),
      });
    }
    return this.releaseFencedJobs(cellId);
  }

  /** Restore admission requires deletion ledger + effect ledger; otherwise Blocked. */
  restoreAdmission(input: {
    backupRef: string;
    deletionCut: string | null;
    effectLedger: string | null;
  }): ReadinessOutcome {
    if (!input.backupRef) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'INVALID_INPUT' as const });
    }
    if (SECRET_RE.test(input.backupRef)) {
      return Object.freeze({ tag: 'Denied' as const, reason: 'FORBIDDEN_PAYLOAD' as const });
    }
    if (!input.deletionCut || !input.effectLedger) {
      return Object.freeze({
        tag: 'Blocked' as const,
        reason: 'MISSING_LEDGER_OR_DEPENDENCY' as const,
      });
    }
    return Object.freeze({
      tag: 'Ok' as const,
      value: Object.freeze({
        status: 'ReadOnlyReady' as const,
        dispatchEnabled: false,
        backupRef: input.backupRef,
        deletionCut: input.deletionCut,
      }),
    });
  }

  private scanProbeForSecrets(probe: ReadinessProbe): boolean {
    const blobs = [
      ...(probe.admittedCapabilities ?? []),
      ...(probe.unadmittedCapabilities ?? []),
      ...(probe.requiredMigrations ?? []),
      ...(probe.migrationsPresent ?? []),
      probe.notes ?? '',
    ];
    for (const b of blobs) {
      if (SECRET_RE.test(b) || FORBIDDEN_ATTR_RE.test(b)) return true;
    }
    return false;
  }
}

export function isEffectsExplicitlyUnavailable(deps: AdmittedDependencies): boolean {
  return deps.effectsUnavailable === true;
}
