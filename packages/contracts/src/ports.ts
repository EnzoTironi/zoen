import type { JsonObject, JsonValue } from '../../kernel/src/json.js';
import type { UUID, WorldRef } from '../../kernel/src/ids.js';
import type { OperationDescriptor, VerifiedContext } from './semantic.js';
/** Structural SQL port, not an in-memory implementation. Only the real pg adapter implements it. */
export interface SqlConnection {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<readonly Row[]>;
  release(): void;
}
export interface Database { connect(): Promise<SqlConnection>; close(): Promise<void>; }
export interface Cryptography {
  randomId(): UUID;
  randomReference(): string;
  sha256(bytes: Uint8Array): Promise<string>;
  digest(value: JsonValue): Promise<string>;
}
export interface Clock { now(): string; }
export type Membership = Readonly<{ role: 'owner' | 'editor' | 'viewer'; state: 'active' | 'revoked'; principalId: UUID }>;
export type Resource = Readonly<{ world: WorldRef; sourceId: UUID | null; sensitivity: 'shared' | 'owner-only' }>;
/** A policy engine evaluates a *fresh* membership loaded inside the real transaction. */
export interface Authorizer {
  authorize(context: VerifiedContext, operation: OperationDescriptor, resource: Resource, membership: Membership, purpose: string): Promise<boolean>;
}
export type StoredArtifact = Readonly<{ key: string; sha256: string; size: string; mediaType: string; versionId: string }>;
export interface EvidenceStore {
  putImmutable(world: WorldRef, reference: UUID, bytes: Uint8Array, mediaType: string): Promise<StoredArtifact>;
  readImmutable(artifact: StoredArtifact): Promise<Uint8Array>;
}
export type AuditEvent = Readonly<{ event: string; correlationId: string; operation: string; result: string; metadata: JsonObject }>;
export interface AuditSink { record(event: AuditEvent): void; }
