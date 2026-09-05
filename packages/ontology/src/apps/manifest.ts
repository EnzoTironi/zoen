import { digest, semanticId } from '../../../kernel/src/ids.js';
import { exactKeys, list, object, text, type JsonObject, type JsonValue, canonicalJson } from '../../../kernel/src/json.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import type { OperationDescriptor } from '../../../contracts/src/semantic.js';
export type Component = Readonly<{ id: string; kind: 'table' | 'evidence-list' | 'metric'; operation: string; input: JsonObject; fields: readonly string[]; label: string }>;
export type MiniAppManifest = Readonly<{ schemaVersion: 1; appId: string; label: string; renderer: 'trusted-declarative'; expectedRelease: string; components: readonly Component[] }>;
/** Deliberately closed declarative subset. Executable artifacts are NOT admitted by this parser. */
export function parseMiniApp(value: JsonValue, publishedOperations: readonly OperationDescriptor[]): MiniAppManifest {
  const raw = object(value); exactKeys(raw, ['schemaVersion', 'appId', 'label', 'renderer', 'expectedRelease', 'components']);
  requireThat(raw['schemaVersion'] === 1, 'APP_SCHEMA_VERSION');
  if (raw['renderer'] !== 'trusted-declarative') throw new KernelError('Blocked', 'EXECUTABLE_HOST_NOT_ADMITTED');
  const available = new Map(publishedOperations.filter(op => op.published).map(op => [op.id, op]));
  const components = list(raw['components']!, 30).map(entry => {
    const c = object(entry); exactKeys(c, ['id', 'kind', 'operation', 'input', 'fields', 'label']);
    const kind = c['kind']; requireThat(kind === 'table' || kind === 'evidence-list' || kind === 'metric', 'APP_COMPONENT_KIND');
    const operation = text(c['operation'], 80); const descriptor = available.get(operation);
    requireThat(descriptor !== undefined && descriptor.kind === 'read' && descriptor.scope === 'world', 'APP_UNPUBLISHED_READ');
    const fields = list(c['fields']!, 40).map(field => semanticId(text(field))); requireThat(new Set(fields).size === fields.length, 'APP_DUPLICATE_FIELD');
    const input = object(c['input']!); requireThat(canonicalJson(input).length <= 8192, 'APP_INPUT_LIMIT');
    return Object.freeze({ id: semanticId(text(c['id'])), kind, operation, input, fields: Object.freeze(fields), label: text(c['label'], 120) });
  });
  requireThat(components.length > 0 && new Set(components.map(c => c.id)).size === components.length, 'APP_COMPONENT_IDS');
  return Object.freeze({ schemaVersion: 1, appId: semanticId(text(raw['appId'])), label: text(raw['label'], 120), renderer: 'trusted-declarative', expectedRelease: digest(text(raw['expectedRelease'])), components: Object.freeze(components) });
}
/** Produces ordinary semantic calls. The caller's verified context is supplied only by the host. */
export function miniAppReads(manifest: MiniAppManifest): readonly Readonly<{ componentId: string; operation: string; input: JsonObject }>[] {
  return Object.freeze(manifest.components.map(c => Object.freeze({ componentId: c.id, operation: c.operation, input: c.input })));
}
