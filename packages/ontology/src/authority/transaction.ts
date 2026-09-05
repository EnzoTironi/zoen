import type { Clock, Cryptography, Database, SqlConnection, Authorizer, Membership, Resource } from '../../../contracts/src/ports.js';
import type { Basis, DomainCut, Head, OperationDescriptor, SemanticEnvelope, VerifiedContext } from '../../../contracts/src/semantic.js';
import { uuid, counter, type WorldRef, type UUID } from '../../../kernel/src/ids.js';
import { canonicalJson, type JsonValue } from '../../../kernel/src/json.js';
import { KernelError, requireThat } from '../../../kernel/src/result.js';
import { assertFresh, isRetryableSql, sortedDomains, assertLoadedRelease } from './guards.js';
import { lockAndLookupOperation, assertReplayDisclosure } from './idempotency.js';
export type WorldTransaction = Readonly<{ sql: SqlConnection; world: WorldRef; head: Head; cut: DomainCut; membership: Membership }>;
export type MutationOutput = Readonly<{ data: JsonValue; receiptId: UUID; commitId: UUID }>;
type WorldRow = { release_digest: string; generation_id: string; cell_epoch: string; security_revision: string; emergency_deny: boolean };
export class Authority {
  constructor(readonly db: Database, readonly crypto: Cryptography, readonly clock: Clock, readonly authorizer: Authorizer, readonly loadedReleaseDigest: string) {}
  /** No provider/model I/O is permitted in `work`; only SQL and in-process pure/crypto/policy operations. */
  async transaction<T>(context: VerifiedContext, world: WorldRef | null, readOnlySnapshot: boolean, work: (sql: SqlConnection) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const sql = await this.db.connect(); let committing = false;
      try {
        await sql.query(readOnlySnapshot ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN ISOLATION LEVEL SERIALIZABLE');
        await sql.query("SET LOCAL statement_timeout = '10s'"); await sql.query("SET LOCAL lock_timeout = '5s'"); await sql.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
        await sql.query("SELECT set_config('zoen.principal_id',$1,true), set_config('zoen.world_id',$2,true), set_config('zoen.realm',$3,true)", [context.principalId, world?.worldId ?? '', world?.realm ?? '']);
        const result = await work(sql); committing = true; await sql.query('COMMIT'); return result;
      } catch (error) {
        try { await sql.query('ROLLBACK'); } catch { /* connection may have died; no fabricated rollback result */ }
        if (isRetryableSql(error)) { if (attempt < 2) continue; throw new KernelError('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT'); }
        if (committing && !(error instanceof KernelError)) throw new KernelError('Unknown', 'COMMIT_OUTCOME_UNKNOWN');
        throw error;
      } finally { sql.release(); }
    }
    throw new KernelError('RetryableInfrastructureFailure', 'SERIALIZATION_RETRY_LIMIT');
  }
  async enter(sql: SqlConnection, context: VerifiedContext, world: WorldRef, descriptor: OperationDescriptor, purpose: string, lock: boolean): Promise<WorldTransaction> {
    // App sessions are not yet persisted/qualified in this candidate: deny rather than
    // letting an opaque browser handle become a self-issued app capability.
    if (context.appSessionId !== null) throw new KernelError('Blocked', 'APP_SESSION_STORAGE_NOT_QUALIFIED');
    const rows = await sql.query<WorldRow>(`SELECT release_digest,generation_id,cell_epoch::text,security_revision::text,emergency_deny FROM ontology.worlds WHERE world_id=$1 AND realm=$2${lock ? ' FOR SHARE' : ''}`, [world.worldId, world.realm]);
    const row = rows[0]; if (!row || row.emergency_deny) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
    const members = await sql.query<{ principal_id: string; role: string; state: string }>('SELECT principal_id,role,state FROM ontology.memberships WHERE world_id=$1 AND realm=$2 AND principal_id=$3', [world.worldId, world.realm, context.principalId]);
    const member = members[0]; if (!member || member.state !== 'active') throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
    requireThat(member.role === 'owner' || member.role === 'editor' || member.role === 'viewer', 'CORRUPT_MEMBERSHIP');
    const membership: Membership = Object.freeze({ principalId: uuid(member.principal_id), role: member.role, state: 'active' });
    const resource: Resource = { world, sourceId: null, sensitivity: 'shared' };
    if (!await this.authorizer.authorize(context, descriptor, resource, membership, purpose)) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
    assertLoadedRelease(row.release_digest, this.loadedReleaseDigest);
    const versions = await sql.query<{ domain_id: string; version: string }>('SELECT domain_id,version::text FROM ontology.domains WHERE world_id=$1 AND realm=$2 ORDER BY domain_id', [world.worldId, world.realm]);
    const cut: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const version of versions) cut[version.domain_id] = counter(version.version);
    return Object.freeze({ sql, world, head: Object.freeze({ releaseDigest: row.release_digest, generationId: uuid(row.generation_id), cellEpoch: counter(row.cell_epoch), securityRevision: counter(row.security_revision) }), membership, cut: Object.freeze(cut) });
  }
  async sourceAllowed(tx: WorldTransaction, context: VerifiedContext, descriptor: OperationDescriptor, sourceId: UUID, purpose: string): Promise<boolean> {
    const rows = await tx.sql.query<{ visibility: string; state: string }>('SELECT visibility,state FROM ontology.sources WHERE world_id=$1 AND realm=$2 AND source_id=$3', [tx.world.worldId, tx.world.realm, sourceId]);
    const source = rows[0]; if (!source || source.state !== 'active') return false;
    requireThat(source.visibility === 'shared' || source.visibility === 'owner-only', 'CORRUPT_SOURCE_VISIBILITY');
    return this.authorizer.authorize(context, descriptor, { world: tx.world, sourceId, sensitivity: source.visibility }, tx.membership, purpose);
  }
  async reauthorize(context: VerifiedContext, world: WorldRef, descriptor: OperationDescriptor, purpose: string, securityRevision: string, sources: readonly UUID[] = []): Promise<void> {
    await this.transaction(context, world, true, async sql => {
      const tx = await this.enter(sql, context, world, descriptor, purpose, false);
      if (tx.head.securityRevision !== securityRevision) throw new KernelError('Denied', 'DISCLOSURE_CHANGED');
      for (const source of sources) if (!await this.sourceAllowed(tx, context, descriptor, source, purpose)) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
    });
  }
  async mutate(envelope: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor, domains: readonly string[], work: (tx: WorldTransaction) => Promise<JsonValue>, disclosureSources: readonly UUID[] = [], guard: ((tx: WorldTransaction) => Promise<void>) | null = null): Promise<MutationOutput> {
    const world = envelope.worldRef; requireThat(world !== null, 'WORLD_REQUIRED');
    const intentDigest = await this.crypto.digest(envelope as unknown as JsonValue);
    const receiptId = this.crypto.randomId(); const commitId = this.crypto.randomId(); const outboxId = this.crypto.randomId();
    return this.transaction(context, world, false, async sql => {
      let tx = await this.enter(sql, context, world, descriptor, envelope.purpose, true);
      for (const source of disclosureSources) if (!await this.sourceAllowed(tx, context, descriptor, source, envelope.purpose)) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
      if (guard !== null) await guard(tx);
      const decision = await lockAndLookupOperation(
        sql,
        {
          world,
          principalId: context.principalId,
          semanticOp: envelope.operation,
          operationId: envelope.operationId,
        },
        intentDigest,
      );
      if (decision.tag === 'conflict') throw new KernelError('Conflict', 'OPERATION_ID_REUSED');
      if (decision.tag === 'replay') {
        await assertReplayDisclosure(sql, world, context.principalId, decision.stored.securityRevision);
        return Object.freeze({
          data: decision.stored.payload,
          receiptId: decision.stored.resultRef,
          commitId: decision.stored.commitId,
        });
      }
      // Lock order (normative): WorldHead FOR SHARE (enter) → advisory op scope → domains FOR UPDATE sorted by id.
      const lockDomains = sortedDomains(domains);
      const locked = await sql.query<{ domain_id: string; version: string }>('SELECT domain_id,version::text FROM ontology.domains WHERE world_id=$1 AND realm=$2 AND domain_id=ANY($3::text[]) ORDER BY domain_id FOR UPDATE', [world.worldId, world.realm, lockDomains]);
      requireThat(locked.length === lockDomains.length, 'MISSING_AUTHORITY_DOMAIN');
      const cut = { ...tx.cut }; for (const row of locked) cut[row.domain_id] = counter(row.version);
      tx = Object.freeze({ ...tx, cut: Object.freeze(cut) });
      if (descriptor.requiresBasis) requireThat(envelope.expectedBasis !== null, 'BASIS_REQUIRED');
      if (envelope.expectedBasis !== null) {
        assertFresh(envelope.expectedBasis, tx.head, tx.cut, lockDomains);
        const expectedDigest = await this.crypto.digest({ head: { ...envelope.expectedBasis.head }, cut: { ...envelope.expectedBasis.cut } });
        requireThat(expectedDigest === envelope.expectedBasis.readSetDigest, 'BASIS_DIGEST');
      }
      const data = await work(tx);
      const updated = await sql.query<{ domain_id: string; version: string }>('UPDATE ontology.domains SET version=version+1 WHERE world_id=$1 AND realm=$2 AND domain_id=ANY($3::text[]) RETURNING domain_id,version::text', [world.worldId, world.realm, lockDomains]);
      const touched: Record<string, string> = Object.create(null) as Record<string, string>; for (const row of updated) touched[row.domain_id] = row.version;
      await this.persistCommit(sql, world, envelope.operation, { receiptId, commitId, outboxId }, tx.head, touched, data);
      await sql.query('INSERT INTO ontology.operations(world_id,realm,principal_id,semantic_op,operation_id,intent_digest,result_ref,commit_id,security_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::bigint)', [world.worldId, world.realm, context.principalId, envelope.operation, envelope.operationId, intentDigest, receiptId, commitId, tx.head.securityRevision]);
      return Object.freeze({ data, receiptId, commitId });
    });
  }
  async persistCommit(sql: SqlConnection, world: WorldRef, kind: string, ids: Readonly<{ receiptId: UUID; commitId: UUID; outboxId: UUID }>, head: Head, touched: DomainCut, data: JsonValue): Promise<void> {
    const [headDigest, payloadDigest] = await Promise.all([this.crypto.digest({ ...head }), this.crypto.digest(data)]);
    await sql.query('INSERT INTO ontology.commits(world_id,realm,commit_id,head_digest,touched_domains) VALUES($1,$2,$3,$4,$5::jsonb)', [world.worldId, world.realm, ids.commitId, headDigest, canonicalJson({ ...touched })]);
    await sql.query('INSERT INTO ontology.receipts(world_id,realm,receipt_id,commit_id,kind,payload_digest,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)', [world.worldId, world.realm, ids.receiptId, ids.commitId, kind, payloadDigest, canonicalJson(data)]);
    await sql.query('INSERT INTO jobs.outbox(world_id,realm,outbox_id,owner,commit_id,event_ordinal,payload_ref) VALUES($1,$2,$3,$4,$5,0,$6)', [world.worldId, world.realm, ids.outboxId, 'authority', ids.commitId, ids.receiptId]);
  }
  async basis(head: Head, allCut: DomainCut, domains: readonly string[]): Promise<Basis> {
    const cut: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const domain of sortedDomains(domains)) { const value = allCut[domain]; requireThat(value !== undefined, 'MISSING_AUTHORITY_DOMAIN'); cut[domain] = value; }
    return Object.freeze({ head, cut: Object.freeze(cut), readSetDigest: await this.crypto.digest({ head: { ...head }, cut }) });
  }

  /**
   * Exclusive head activation (FOR UPDATE). Concurrent domain writers may hold
   * FOR SHARE; activation must not expose a mixed head mid-commit.
   * No externally visible sequence is allocated before COMMIT.
   */
  async activateHead(
    context: VerifiedContext,
    world: WorldRef,
    descriptor: OperationDescriptor,
    purpose: string,
    nextReleaseDigest: string,
  ): Promise<Head> {
    requireThat(/^[a-f0-9]{64}$/.test(nextReleaseDigest), 'RELEASE_DIGEST');
    return this.transaction(context, world, false, async sql => {
      const rows = await sql.query<WorldRow>(
        `SELECT release_digest,generation_id,cell_epoch::text,security_revision::text,emergency_deny
         FROM ontology.worlds WHERE world_id=$1 AND realm=$2 FOR UPDATE`,
        [world.worldId, world.realm],
      );
      const row = rows[0];
      if (!row || row.emergency_deny) throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
      const members = await sql.query<{ principal_id: string; role: string; state: string }>(
        'SELECT principal_id,role,state FROM ontology.memberships WHERE world_id=$1 AND realm=$2 AND principal_id=$3',
        [world.worldId, world.realm, context.principalId],
      );
      const member = members[0];
      if (!member || member.state !== 'active' || member.role !== 'owner') {
        throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
      }
      const resource: Resource = { world, sourceId: null, sensitivity: 'shared' };
      if (!await this.authorizer.authorize(context, descriptor, resource, Object.freeze({
        principalId: uuid(member.principal_id), role: 'owner', state: 'active',
      }), purpose)) {
        throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED');
      }
      const updated = await sql.query<WorldRow>(
        `UPDATE ontology.worlds
         SET release_digest=$3, generation_id=gen_random_uuid(), cell_epoch=cell_epoch+1
         WHERE world_id=$1 AND realm=$2
         RETURNING release_digest,generation_id,cell_epoch::text,security_revision::text,emergency_deny`,
        [world.worldId, world.realm, nextReleaseDigest],
      );
      const next = updated[0];
      requireThat(next !== undefined, 'HEAD_ACTIVATION_FAILED');
      return Object.freeze({
        releaseDigest: next.release_digest,
        generationId: uuid(next.generation_id),
        cellEpoch: counter(next.cell_epoch),
        securityRevision: counter(next.security_revision),
      });
    });
  }

}
