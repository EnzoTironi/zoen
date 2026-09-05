import { counter, digest, semanticId, uuid, worldRef, type WorldRef, type UUID } from '../../kernel/src/ids.js';
import { exactKeys, list, object, parseJson, text, type JsonObject, type JsonValue } from '../../kernel/src/json.js';
import { requireThat, type Result } from '../../kernel/src/result.js';
export type Head = Readonly<{ releaseDigest: string; generationId: UUID; cellEpoch: string; securityRevision: string }>;
export type DomainCut = Readonly<Record<string, string>>;
export type Basis = Readonly<{ head: Head; cut: DomainCut; readSetDigest: string }>;
export type SemanticEnvelope = Readonly<{
  schemaVersion: 1; operation: string; operationId: UUID; worldRef: WorldRef | null;
  purpose: string; expectedBasis: Basis | null; input: JsonObject;
}>;
export type VerifiedContext = Readonly<{
  principalId: UUID; sessionId: string; authenticatedAt: string; assurance: 'authenticated' | 'step-up';
  actorId: UUID; appSessionId: UUID | null; transport: 'web' | 'cli' | 'agent' | 'mini-app' | 'mcp';
}>;
export type OperationDescriptor = Readonly<{
  id: string; kind: 'read' | 'mutation'; scope: 'bootstrap' | 'world';
  inputSchemaId: string; requiresBasis: boolean; published: boolean;
}>;
export type SemanticResult = Result<JsonValue>;
export function parseHead(value: JsonValue): Head {
  const v = object(value); exactKeys(v, ['releaseDigest', 'generationId', 'cellEpoch', 'securityRevision']);
  return Object.freeze({ releaseDigest: digest(text(v['releaseDigest'])), generationId: uuid(text(v['generationId'])), cellEpoch: counter(text(v['cellEpoch'])), securityRevision: counter(text(v['securityRevision'])) });
}
export function parseCut(value: JsonValue): DomainCut {
  const v = object(value); requireThat(Object.keys(v).length <= 256, 'DOMAIN_CUT_LIMIT');
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const key of Object.keys(v).sort()) { requireThat(/^[a-z][a-z0-9_.:-]{0,127}$/.test(key), 'DOMAIN_ID'); out[key] = counter(text(v[key])); }
  return Object.freeze(out);
}
export function parseBasis(value: JsonValue): Basis {
  const v = object(value); exactKeys(v, ['head', 'cut', 'readSetDigest']);
  return Object.freeze({ head: parseHead(v['head']!), cut: parseCut(v['cut']!), readSetDigest: digest(text(v['readSetDigest'])) });
}
export function parseEnvelope(bytes: Uint8Array): SemanticEnvelope {
  const v = object(parseJson(bytes)); exactKeys(v, ['schemaVersion', 'operation', 'operationId', 'worldRef', 'purpose', 'expectedBasis', 'input']);
  requireThat(v['schemaVersion'] === 1, 'SCHEMA_VERSION');
  const operation = text(v['operation'], 80); requireThat(/^[A-Z][a-zA-Z0-9]{0,79}$/.test(operation), 'OPERATION_NAME');
  return Object.freeze({ schemaVersion: 1, operation, operationId: uuid(text(v['operationId'])), worldRef: v['worldRef'] === null ? null : worldRef(v['worldRef']!), purpose: semanticId(text(v['purpose'], 80)), expectedBasis: v['expectedBasis'] === null ? null : parseBasis(v['expectedBasis']!), input: object(v['input']!) });
}
export function uuidList(value: JsonValue, max = 100): readonly UUID[] {
  const ids = list(value, max).map(v => uuid(text(v))); requireThat(new Set(ids).size === ids.length, 'DUPLICATE_ID'); return Object.freeze(ids);
}
