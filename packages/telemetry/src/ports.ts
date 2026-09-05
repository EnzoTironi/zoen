import type { ExportScope, RedactedOperationalEvent } from './types.js';

export interface TelemetrySink {
  append(event: RedactedOperationalEvent): Promise<void>;
}

export interface TelemetryExportPort {
  exportScope(scope: ExportScope, events: readonly RedactedOperationalEvent[]): readonly RedactedOperationalEvent[];
}
