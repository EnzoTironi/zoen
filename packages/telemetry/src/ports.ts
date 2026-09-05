import type {
  ExportScope,
  RedactedOperationalEvent,
  RecoveryFence,
  LegacyImportManifest,
} from './types.js';

export interface TelemetrySink {
  append(event: RedactedOperationalEvent): Promise<void>;
}

export interface TelemetryExportPort {
  exportScope(scope: ExportScope, events: readonly RedactedOperationalEvent[]): readonly RedactedOperationalEvent[];
}

export interface ReadinessClock {
  nowIso(): string;
}

export interface RecoveryFenceStore {
  getFence(cellId: string): Promise<RecoveryFence | null>;
  upsertFence(fence: RecoveryFence): Promise<RecoveryFence>;
}

export interface LegacyManifestStore {
  save(manifest: LegacyImportManifest): Promise<void>;
  getProductionMarker(marker: string): Promise<{ marker: string; mutated: boolean } | null>;
  ensureProductionMarker(marker: string): Promise<void>;
}
