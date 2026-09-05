import { Authority } from '../authority/transaction.js';
import type { EvidenceStore, StoredArtifact } from '../../../contracts/src/ports.js';
import { parseEnvelope, type SemanticEnvelope, type SemanticResult, type VerifiedContext, type OperationDescriptor, type Head } from '../../../contracts/src/semantic.js';
import { uuid, nextCounter, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson, exactKeys, list, object, parseJsonText, text, type JsonValue } from '../../../kernel/src/json.js';
import { KernelError, requireThat, ok, toPublicFailure } from '../../../kernel/src/result.js';
import { createHash } from 'node:crypto';
import { OPERATIONS, FOUNDATION, operation } from './registry.js';
import { DiscoveryService, buildOpaqueEvidenceRef } from './discovery.js';
import { FrameDisclosureService } from './frame-disclosure.js';
import { comparableGroups, parseClaim, parseValidTime } from '../interpretation/claims.js';
import { interpretVisible } from '../interpretation/reconcile.js';
import { operationScope } from '../authority/guards.js';

export const DISPATCH_IMPL = 'semantic-dispatch-v1';
export const CONTRACT_DIGEST_IMPL = 'semantic-contract-v1';

const SQL_OR_TABLE_RE = /\b(select|insert|update|delete|drop|alter|truncate|union|pg_|information_schema|ontology\.|jobs\.)\b/i;
const FORBIDDEN_INVOKE = new Set([
  'query', 'sql', 'executeSql', 'rawQuery', 'table', 'from', 'invokeSql', 'runSql',
]);

export function contractDigestFor(operationId: string, releaseDigest: string): string {
  const desc = operation(operationId);
  return createHash('sha256')
    .update(`${CONTRACT_DIGEST_IMPL}|${operationId}|${releaseDigest}|${desc?.inputSchemaId ?? ''}`, 'utf8')
    .digest('hex');
}

export type TransportInvoke = Readonly<{
  transport: 'web' | 'cli';
  envelopeBytes: Uint8Array;
  /** Optional pin to released contract; mismatch => ContractChanged (no silent version fallback). */
  expectedContractDigest?: string;
  /** Forbidden escape hatch — any non-empty value is rejected. */
  invokeMethod?: string;
  rawSql?: string;
}>;

/**
 * Shared web/CLI/agent entry: only known released operations, disclosure-safe errors,
 * and no direct SQL/table invoke path. Transports must not implement authorization.
 */
export class SemanticDispatcher {
  constructor(
    private readonly executor: SemanticExecutor,
    private readonly releaseDigest: string,
  ) {}

  async invoke(request: TransportInvoke, context: VerifiedContext): Promise<SemanticResult> {
    try {
      if (request.rawSql !== undefined && String(request.rawSql).length > 0) {
        throw new KernelError('Denied', 'RAW_SQL_FORBIDDEN');
      }
      if (request.invokeMethod !== undefined && String(request.invokeMethod).length > 0) {
        const method = String(request.invokeMethod);
        if (FORBIDDEN_INVOKE.has(method) || SQL_OR_TABLE_RE.test(method)) {
          throw new KernelError('Denied', 'UNREGISTERED_INVOKE');
        }
        throw new KernelError('Unsupported', 'INVOKE_METHOD_NOT_RELEASED');
      }
      // Peek operation name for contract pin before executor side effects.
      let peekedOp = '';
      try {
        const preview = parseEnvelope(request.envelopeBytes);
        peekedOp = preview.operation;
        if (SQL_OR_TABLE_RE.test(preview.operation) || SQL_OR_TABLE_RE.test(canonicalJson(preview.input))) {
          throw new KernelError('Denied', 'SQL_OR_TABLE_FORBIDDEN');
        }
        const desc = operation(preview.operation);
        if (!desc) throw new KernelError('Unsupported', 'OPERATION_NOT_RELEASED');
        if (request.expectedContractDigest !== undefined) {
          if (!/^[a-f0-9]{64}$/.test(request.expectedContractDigest)) {
            throw new KernelError('InvalidInput', 'CONTRACT_DIGEST');
          }
          const actual = contractDigestFor(preview.operation, this.releaseDigest);
          if (request.expectedContractDigest !== actual) {
            throw new KernelError('ContractChanged', 'CONTRACT_DIGEST_MISMATCH');
          }
        }
      } catch (error) {
        if (error instanceof KernelError) throw error;
        throw error;
      }
      void peekedOp;
      const ctx = Object.freeze({ ...context, transport: request.transport });
      return await this.executor.execute(request.envelopeBytes, ctx);
    } catch (error) {
      return toPublicFailure(error);
    }
  }
}
const asJson = (value: unknown): JsonValue => parseJsonText(canonicalJson(value as JsonValue));
const deny = (): never => { throw new KernelError('NotFoundOrDenied', 'NOT_FOUND_OR_DENIED'); };
/** The single executor. The edge, SDK, CLI and trusted declarative host call this path. */
export class SemanticExecutor {
  constructor(private readonly authority: Authority, private readonly store: EvidenceStore, readonly releaseDigest: string) {}
  async execute(bytes: Uint8Array, context: VerifiedContext): Promise<SemanticResult> {
    try {
      const request = parseEnvelope(bytes);
      if (SQL_OR_TABLE_RE.test(request.operation) || SQL_OR_TABLE_RE.test(canonicalJson(request.input))) {
        throw new KernelError('Denied', 'SQL_OR_TABLE_FORBIDDEN');
      }
      const descriptor = operation(request.operation);
      if (!descriptor) throw new KernelError('Unsupported', 'OPERATION_NOT_RELEASED');
      if (request.operation === 'CreatePersonalWorld') return ok(await this.createWorld(request, context));
      requireThat(request.worldRef !== null, 'WORLD_REQUIRED');
      switch (request.operation) {
        case 'Discover': return ok(await this.discover(request, context, descriptor));
        case 'RegisterSource': return ok(await this.registerSource(request, context, descriptor));
        case 'CreateSubject': return ok(await this.createSubject(request, context, descriptor));
        case 'StageEvidence': return ok(await this.stageEvidence(request, context, descriptor));
        case 'AdmitClaim': case 'CorrectClaim': return ok(await this.admitClaim(request, context, descriptor));
        case 'Inspect': return ok(await this.inspect(request, context, descriptor));
        case 'OpenFrame': return ok(await this.openFrame(request, context, descriptor));
        case 'OpenEvidence': return ok(await this.openEvidence(request, context, descriptor));
        default: throw new KernelError('Unsupported', 'OPERATION_NOT_RELEASED');
      }
    } catch (error) { return toPublicFailure(error); }
  }
  private async createWorld(request: SemanticEnvelope, context: VerifiedContext): Promise<JsonValue> {
    requireThat(request.worldRef === null && request.expectedBasis === null && context.appSessionId === null && request.purpose === 'operations', 'GENESIS_SCOPE');
    exactKeys(request.input, ['name']); const name = text(request.input['name'], 120);
    const world: WorldRef = { worldId: this.authority.crypto.randomId(), realm: 'live' };
    const ids = { receiptId: this.authority.crypto.randomId(), commitId: this.authority.crypto.randomId(), outboxId: this.authority.crypto.randomId() };
    const head: Head = { releaseDigest: this.releaseDigest, generationId: this.authority.crypto.randomId(), cellEpoch: '1', securityRevision: '0' };
    const intentDigest = await this.authority.crypto.digest(asJson(request));
    return this.authority.transaction(context, world, false, async sql => {
      await sql.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operationScope('bootstrap', 'live', context.principalId, request.operation, request.operationId)]);
      const previous = await sql.query<{ intent_digest: string; world_id: string; realm: string; result_ref: string }>('SELECT intent_digest,world_id,realm,result_ref FROM ontology.bootstrap_operations WHERE principal_id=$1 AND semantic_op=$2 AND operation_id=$3', [context.principalId, request.operation, request.operationId]);
      const prior = previous[0];
      if (prior) {
        if (prior.intent_digest !== intentDigest) throw new KernelError('Conflict', 'OPERATION_ID_REUSED');
        requireThat(prior.realm === 'live', 'GENESIS_REALM'); const existing = { worldId: uuid(prior.world_id), realm: 'live' as const };
        await sql.query("SELECT set_config('zoen.world_id',$1,true),set_config('zoen.realm',$2,true)", [existing.worldId, existing.realm]);
        await this.authority.enter(sql, context, existing, operation('Discover')!, request.purpose, true);
        const receipt = (await sql.query<{ payload: string }>('SELECT payload::text FROM ontology.receipts WHERE world_id=$1 AND realm=$2 AND receipt_id=$3', [existing.worldId, existing.realm, prior.result_ref]))[0];
        if (!receipt) return deny(); return parseJsonText(receipt.payload);
      }
      await sql.query('INSERT INTO ontology.worlds(world_id,realm,owner_id,name,release_digest,generation_id,cell_epoch,security_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [world.worldId, world.realm, context.principalId, name, head.releaseDigest, head.generationId, head.cellEpoch, head.securityRevision]);
      await sql.query("INSERT INTO ontology.memberships(world_id,realm,principal_id,role,state) VALUES($1,$2,$3,'owner','active')", [world.worldId, world.realm, context.principalId]);
      for (const domain of ['sources', 'subjects']) await sql.query('INSERT INTO ontology.domains(world_id,realm,domain_id,version) VALUES($1,$2,$3,0)', [world.worldId, world.realm, domain]);
      const data = { worldRef: { ...world }, head: { ...head }, receiptId: ids.receiptId };
      await this.authority.persistCommit(sql, world, request.operation, ids, head, {}, data);
      await sql.query('INSERT INTO ontology.bootstrap_operations(principal_id,semantic_op,operation_id,intent_digest,world_id,realm,result_ref) VALUES($1,$2,$3,$4,$5,$6,$7)', [context.principalId, request.operation, request.operationId, intentDigest, world.worldId, world.realm, ids.receiptId]);
      return data;
    });
  }
  private async discover(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, [], ['explainOpaqueRef']); const world = request.worldRef!;
    const explainRef = request.input['explainOpaqueRef'] === undefined ? null : text(request.input['explainOpaqueRef'], 200);
    const result = await this.authority.transaction(context, world, true, async sql => {
      const tx = await this.authority.enter(sql, context, world, descriptor, request.purpose, false);
      const discovery = new DiscoveryService();
      if (explainRef !== null) {
        // Opaque explanation reopen — authorized map only; missing/denied identical.
        const evidenceRows = await sql.query<{ evidence_id: string; source_id: string }>(
          'SELECT evidence_id,source_id FROM ontology.evidence WHERE world_id=$1 AND realm=$2 ORDER BY evidence_id LIMIT 501',
          [world.worldId, world.realm],
        );
        const authorizedByRef = new Map<string, { evidenceId: ReturnType<typeof uuid>; fieldId: string; text: string }>();
        for (const row of evidenceRows) {
          const sourceId = uuid(row.source_id);
          if (!(await this.authority.sourceAllowed(tx, context, descriptor, sourceId, request.purpose))) continue;
          const evidenceId = uuid(row.evidence_id);
          const ref = buildOpaqueEvidenceRef(world.worldId, evidenceId);
          authorizedByRef.set(ref, {
            evidenceId,
            fieldId: 'record.label',
            text: 'Authorized evidence explanation reference',
          });
        }
        const explained = await discovery.explainOpaqueRef({
          world,
          context,
          membership: tx.membership,
          purpose: request.purpose,
          opaqueRef: explainRef,
          authorizedByRef,
        });
        if (explained.tag !== 'Ok') deny();
        const explainedOk = explained as Extract<typeof explained, { tag: 'Ok' }>;
        return {
          value: { explanation: asJson(explainedOk.value) },
          securityRevision: tx.head.securityRevision,
          sources: [] as ReturnType<typeof uuid>[],
        };
      }
      const sources = await sql.query<{ source_id: string }>('SELECT source_id FROM ontology.sources WHERE world_id=$1 AND realm=$2 ORDER BY source_id', [world.worldId, world.realm]);
      const authorizedEvidence: { evidenceId: ReturnType<typeof uuid>; sourceId: ReturnType<typeof uuid> }[] = [];
      const evidenceRows = await sql.query<{ evidence_id: string; source_id: string }>(
        'SELECT evidence_id,source_id FROM ontology.evidence WHERE world_id=$1 AND realm=$2 ORDER BY evidence_id LIMIT 501',
        [world.worldId, world.realm],
      );
      if (evidenceRows.length > 500) throw new KernelError('QuotaExceeded', 'DISCOVERY_EVIDENCE_LIMIT');
      for (const row of evidenceRows) {
        const sourceId = uuid(row.source_id);
        if (!(await this.authority.sourceAllowed(tx, context, descriptor, sourceId, request.purpose))) continue;
        authorizedEvidence.push({ evidenceId: uuid(row.evidence_id), sourceId });
      }
      void sources;
      const outcome = await discovery.discover({
        world,
        context,
        membership: tx.membership,
        purpose: request.purpose,
        releaseDigest: tx.head.releaseDigest,
        securityRevision: tx.head.securityRevision,
        sourceAclFreshness: tx.head.securityRevision,
        authorizedEvidence,
        authorizer: this.authority.authorizer,
      });
      if (outcome.tag !== 'Ok') deny();
      const outcomeOk = outcome as Extract<typeof outcome, { tag: 'Ok' }>;
      return {
        value: asJson(outcomeOk.value),
        securityRevision: tx.head.securityRevision,
        sources: authorizedEvidence.map((e) => e.sourceId),
      };
    });
    await this.authority.reauthorize(context, world, descriptor, request.purpose, result.securityRevision, result.sources ?? []);
    return result.value;
  }
  private async registerSource(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['name', 'visibility']); const name = text(request.input['name'], 120); const visibility = request.input['visibility'];
    requireThat(visibility === 'shared' || visibility === 'owner-only', 'SOURCE_VISIBILITY');
    const sourceId = this.authority.crypto.randomId(); const familyId = this.authority.crypto.randomId();
    const committed = await this.authority.mutate(request, context, descriptor, ['sources'], async tx => {
      await tx.sql.query('INSERT INTO ontology.sources(world_id,realm,source_id,family_id,name,visibility,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)', [tx.world.worldId, tx.world.realm, sourceId, familyId, name, visibility, context.principalId]);
      return { sourceId, familyId };
    }); return asJson(committed);
  }
  private async createSubject(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['typeId', 'label']); requireThat(request.input['typeId'] === 'record', 'OBJECT_TYPE_NOT_RELEASED');
    const label = text(request.input['label'], 160); const subjectId = this.authority.crypto.randomId();
    const committed = await this.authority.mutate(request, context, descriptor, ['subjects'], async tx => {
      await tx.sql.query('INSERT INTO ontology.subjects(world_id,realm,subject_id,type_id,label) VALUES($1,$2,$3,$4,$5)', [tx.world.worldId, tx.world.realm, subjectId, 'record', label]);
      await tx.sql.query('INSERT INTO ontology.domains(world_id,realm,domain_id,version) VALUES($1,$2,$3,0)', [tx.world.worldId, tx.world.realm, `claims:${subjectId}`]);
      return { subjectId };
    }); return asJson(committed);
  }
  private async stageEvidence(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['sourceId', 'mediaType', 'content']); const sourceId = uuid(text(request.input['sourceId']));
    const mediaType = text(request.input['mediaType'], 80); requireThat(mediaType === 'text/plain' || mediaType === 'application/json', 'EVIDENCE_MEDIA_TYPE');
    const content = text(request.input['content'], 250_000); const bytes = new TextEncoder().encode(content);
    // Raw evidence is retained literally, not normalized as authority JSON.
    const world = request.worldRef!;
    await this.authority.transaction(context, world, true, async sql => { const tx = await this.authority.enter(sql, context, world, descriptor, request.purpose, false); if (!await this.authority.sourceAllowed(tx, context, descriptor, sourceId, request.purpose)) deny(); });
    // Immutable upload is deliberately outside the authority transaction. A denied
    // subsequent admission leaves a non-authoritative orphan for governed cleanup.
    const evidenceId = request.operationId;
    const stored: StoredArtifact = await this.store.putImmutable(world, evidenceId, bytes, mediaType);
    const committed = await this.authority.mutate(request, context, descriptor, ['sources'], async tx => {
      await tx.sql.query('INSERT INTO ontology.evidence(world_id,realm,evidence_id,source_id,object_key,content_digest,size_bytes,media_type,object_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [world.worldId, world.realm, evidenceId, sourceId, stored.key, stored.sha256, stored.size, stored.mediaType, stored.versionId]);
      return { evidenceId, sha256: stored.sha256, size: stored.size };
    }, [sourceId]); return asJson(committed);
  }
  private async admitClaim(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    const correction = request.operation === 'CorrectClaim';
    exactKeys(request.input, ['subjectId', 'sourceId', 'predicateId', 'value', 'unit', 'scope', 'validTime', 'evidenceRefs', ...(correction ? ['targetClaimId'] : [])]);
    const subjectId = uuid(text(request.input['subjectId'])); const sourceId = uuid(text(request.input['sourceId']));
    const predicateId = text(request.input['predicateId'], 128); const predicate = FOUNDATION.predicates.find(p => p.id === predicateId);
    requireThat(predicate !== undefined, 'PREDICATE_NOT_RELEASED');
    const unit = request.input['unit']; requireThat(unit === null || (typeof unit === 'string' && predicate.units.includes(unit)), 'UNIT_NOT_RELEASED');
    requireThat(predicate.valueType !== 'decimal' || unit !== null, 'QUANTITY_UNIT_REQUIRED');
    const scope = object(request.input['scope']!); const validTime = parseValidTime(request.input['validTime']!);
    const evidenceRefs = list(request.input['evidenceRefs']!, 100).map(ref => uuid(text(ref)));
    requireThat(evidenceRefs.length > 0 && new Set(evidenceRefs).size === evidenceRefs.length, 'EVIDENCE_REQUIRED');
    const targetClaimId = correction ? uuid(text(request.input['targetClaimId'])) : null;
    const claimId = this.authority.crypto.randomId(); const domainId = `claims:${subjectId}`;
    const committed = await this.authority.mutate(request, context, descriptor, ['sources', domainId], async tx => {
      if (!(await tx.sql.query('SELECT subject_id FROM ontology.subjects WHERE world_id=$1 AND realm=$2 AND subject_id=$3', [tx.world.worldId, tx.world.realm, subjectId]))[0]) return deny();
      const source = (await tx.sql.query<{ family_id: string }>('SELECT family_id FROM ontology.sources WHERE world_id=$1 AND realm=$2 AND source_id=$3', [tx.world.worldId, tx.world.realm, sourceId]))[0]; if (!source) return deny();
      const storedEvidence = await tx.sql.query<{ evidence_id: string }>('SELECT evidence_id FROM ontology.evidence WHERE world_id=$1 AND realm=$2 AND source_id=$3 AND evidence_id=ANY($4::uuid[])', [tx.world.worldId, tx.world.realm, sourceId, evidenceRefs]);
      if (storedEvidence.length !== evidenceRefs.length) return deny();
      const claim = parseClaim({ id: claimId, world: { ...tx.world }, subjectId, predicateId, definitionDigest: tx.head.releaseDigest, valueType: predicate.valueType, value: request.input['value']!, unit: unit!, scope, validTime: { ...validTime }, knowledgeVersion: nextCounter(tx.cut[domainId]!), sourceId, familyId: source.family_id, evidenceRefs, derivedFrom: targetClaimId === null ? [] : [targetClaimId], verification: correction ? 'attested' : 'unverified' });
      if (targetClaimId !== null) {
        const targetRow = (await tx.sql.query<{ payload: string; source_id: string }>('SELECT payload::text,source_id FROM ontology.claims WHERE world_id=$1 AND realm=$2 AND claim_id=$3 AND subject_id=$4', [tx.world.worldId, tx.world.realm, targetClaimId, subjectId]))[0]; if (!targetRow) return deny();
        if (!await this.authority.sourceAllowed(tx, context, descriptor, uuid(targetRow.source_id), request.purpose)) return deny();
        const target = parseClaim(parseJsonText(targetRow.payload));
        requireThat(target.predicateId === claim.predicateId && target.valueType === claim.valueType && target.unit === claim.unit && canonicalJson(target.scope) === canonicalJson(claim.scope) && canonicalJson(asJson(target.validTime)) === canonicalJson(asJson(claim.validTime)) && target.definitionDigest === claim.definitionDigest, 'CORRECTION_SCOPE_MISMATCH');
        // A source upload is evidence of the user's scoped correction, not verification
        // that the new statement is independently true. Original claims remain immutable.
      }
      await tx.sql.query('INSERT INTO ontology.claims(world_id,realm,claim_id,subject_id,predicate_id,source_id,payload,domain_id,knowledge_version,asserted_by) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)', [tx.world.worldId, tx.world.realm, claimId, subjectId, predicateId, sourceId, canonicalJson(asJson(claim)), domainId, claim.knowledgeVersion, context.principalId]);
      for (const ref of evidenceRefs) await tx.sql.query('INSERT INTO ontology.claim_evidence(world_id,realm,claim_id,evidence_id) VALUES($1,$2,$3,$4)', [tx.world.worldId, tx.world.realm, claimId, ref]);
      if (targetClaimId !== null) await tx.sql.query("INSERT INTO ontology.claim_edges(world_id,realm,parent_id,child_id,kind,domain_id,knowledge_version) VALUES($1,$2,$3,$4,'supersedes',$5,$6)", [tx.world.worldId, tx.world.realm, targetClaimId, claimId, domainId, claim.knowledgeVersion]);
      return { claimId, subjectId, knowledgeVersion: claim.knowledgeVersion };
    }, [sourceId], targetClaimId === null ? null : async tx => {
      // Recheck target disclosure BEFORE returning a stored idempotent result, too.
      const target = (await tx.sql.query<{ source_id: string }>('SELECT source_id FROM ontology.claims WHERE world_id=$1 AND realm=$2 AND claim_id=$3 AND subject_id=$4', [tx.world.worldId, tx.world.realm, targetClaimId, subjectId]))[0];
      if (!target || !await this.authority.sourceAllowed(tx, context, descriptor, uuid(target.source_id), request.purpose)) deny();
    }); return asJson(committed);
  }
  private async inspect(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['subjectId'], ['predicateId']); const subjectId = uuid(text(request.input['subjectId'])); const predicateId = request.input['predicateId'] === undefined ? null : text(request.input['predicateId'], 128);
    const world = request.worldRef!; const frameId = this.authority.crypto.randomId();
    const result = await this.authority.transaction(context, world, true, async sql => {
      const tx = await this.authority.enter(sql, context, world, descriptor, request.purpose, false);
      const subject = (await sql.query<{ subject_id: string; type_id: string; label: string }>('SELECT subject_id,type_id,label FROM ontology.subjects WHERE world_id=$1 AND realm=$2 AND subject_id=$3', [world.worldId, world.realm, subjectId]))[0]; if (!subject) return deny();
      const sources = await sql.query<{ source_id: string }>('SELECT source_id FROM ontology.sources WHERE world_id=$1 AND realm=$2 ORDER BY source_id', [world.worldId, world.realm]);
      const allowedSources: UUID[] = [];
      for (const source of sources) if (await this.authority.sourceAllowed(tx, context, descriptor, uuid(source.source_id), request.purpose)) allowedSources.push(uuid(source.source_id));
      // Filtering precedes selection/aggregation/interpretation. A hidden successor
      // cannot suppress a visible claim in the caller's authorized perspective.
      const rows = await sql.query<{ payload: string }>(`SELECT c.payload::text FROM ontology.claims c WHERE c.world_id=$1 AND c.realm=$2 AND c.subject_id=$3 AND ($4::text IS NULL OR c.predicate_id=$4)
        AND c.source_id=ANY($5::uuid[]) AND NOT EXISTS (
          SELECT 1 FROM ontology.claim_edges e JOIN ontology.claims successor ON successor.world_id=e.world_id AND successor.realm=e.realm AND successor.claim_id=e.child_id
          WHERE e.world_id=c.world_id AND e.realm=c.realm AND e.parent_id=c.claim_id AND e.kind='supersedes' AND successor.source_id=ANY($5::uuid[]))
        ORDER BY c.claim_id LIMIT 501`, [world.worldId, world.realm, subjectId, predicateId, allowedSources]);
      if (rows.length > 500) throw new KernelError('QuotaExceeded', 'INSPECT_RESULT_LIMIT');
      const claims = rows.map(row => parseClaim(parseJsonText(row.payload)));
      const groups = comparableGroups(claims, world).map(group => ({ interpretation: asJson(interpretVisible(group, { kind: 'manual-required' })), claims: group.map(claim => asJson(claim)) }));
      const basis = await this.authority.basis(tx.head, tx.cut, ['sources', `claims:${subjectId}`]);
      const payload = { frameId, worldRef: { ...world }, basis: asJson(basis), perspective: { principalId: context.principalId, purpose: request.purpose }, subject: { subjectId: subject.subject_id, typeId: subject.type_id, label: subject.label }, groups, gaps: claims.length === 0 ? ['NO_AUTHORIZED_EVIDENCE'] : claims.some(c => c.validTime.kind === 'unknown') ? ['UNKNOWN_VALID_TIME'] : [] };
      const sourceIds = [...new Set(claims.map(c => c.sourceId))]; const expiresAt = new Date(Date.parse(this.authority.clock.now()) + 24 * 60 * 60 * 1000).toISOString();
      await sql.query('INSERT INTO ontology.frames(world_id,realm,frame_id,principal_id,purpose,head_digest,basis,payload,source_ids,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::uuid[],$10)', [world.worldId, world.realm, frameId, context.principalId, request.purpose, await this.authority.crypto.digest({ ...tx.head }), canonicalJson(asJson(basis)), canonicalJson(payload), sourceIds, expiresAt]);
      return { payload, sourceIds, securityRevision: tx.head.securityRevision };
    });
    await this.authority.reauthorize(context, world, descriptor, request.purpose, result.securityRevision, result.sourceIds); return result.payload;
  }
  private async openFrame(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['frameId']); const frameId = uuid(text(request.input['frameId'])); const world = request.worldRef!;
    const disclosure = new FrameDisclosureService();
    const result = await this.authority.transaction(context, world, true, async sql => {
      const tx = await this.authority.enter(sql, context, world, descriptor, request.purpose, false);
      const row = await disclosure.loadFrame(sql, world, frameId, context.principalId, request.purpose);
      let sourcesStillAllowed = true;
      const sources: ReturnType<typeof uuid>[] = row ? row.source_ids.map(uuid) : [];
      for (const source of sources) {
        if (!await this.authority.sourceAllowed(tx, context, descriptor, source, request.purpose)) {
          sourcesStillAllowed = false;
          break;
        }
      }
      const currentHeadDigest = await this.authority.crypto.digest({ ...tx.head });
      const outcome = disclosure.reopen({
        world,
        frameId,
        principalId: context.principalId,
        purpose: request.purpose,
        currentSecurityRevision: tx.head.securityRevision,
        currentHeadDigest,
        sourcesStillAllowed,
        membershipActive: tx.membership.state === 'active',
      }, row);
      if (outcome.tag === 'Denied') return deny();
      if (outcome.tag === 'HistoricalContentUnavailable') {
        throw new KernelError('HistoricalContentUnavailable', outcome.reason);
      }
      return { outcome: asJson(outcome), securityRevision: tx.head.securityRevision, sources };
    });
    await this.authority.reauthorize(context, world, descriptor, request.purpose, result.securityRevision, result.sources);
    return result.outcome;
  }
  private async openEvidence(request: SemanticEnvelope, context: VerifiedContext, descriptor: OperationDescriptor): Promise<JsonValue> {
    exactKeys(request.input, ['evidenceId']); const evidenceId = uuid(text(request.input['evidenceId'])); const world = request.worldRef!;
    const disclosure = new FrameDisclosureService();
    const admitted = await this.authority.transaction(context, world, true, async sql => {
      const tx = await this.authority.enter(sql, context, world, descriptor, request.purpose, false);
      const row = (await sql.query<{ source_id: string; object_key: string; content_digest: string; size_bytes: string; media_type: string; object_version: string }>('SELECT source_id,object_key,content_digest,size_bytes::text,media_type,object_version FROM ontology.evidence WHERE world_id=$1 AND realm=$2 AND evidence_id=$3', [world.worldId, world.realm, evidenceId]))[0];
      if (!row) return deny();
      const sourceAllowed = await this.authority.sourceAllowed(tx, context, descriptor, uuid(row.source_id), request.purpose);
      // Erasure/retention state is enforced by FrameDisclosureService when supplied
      // (SPEC-004 EvidenceReader joins source_admissions). This surface rechecks
      // membership + source ACL immediately before delivery.
      const gate = disclosure.discloseEvidence({
        world,
        evidenceId,
        contentState: 'available',
        sourceAllowed,
        membershipActive: tx.membership.state === 'active',
      });
      if (gate.tag === 'Denied') return deny();
      if (gate.tag === 'HistoricalContentUnavailable') throw new KernelError('HistoricalContentUnavailable', gate.reason);
      return { artifact: { key: row.object_key, sha256: row.content_digest, size: row.size_bytes, mediaType: row.media_type, versionId: row.object_version }, sourceId: uuid(row.source_id), securityRevision: tx.head.securityRevision };
    });
    // Real object I/O occurs outside the transaction. No presigned bearer URL or
    // object-store credential reaches the client; it receives the normal semantic result.
    const bytes = await this.store.readImmutable(admitted.artifact);
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    await this.authority.reauthorize(context, world, descriptor, request.purpose, admitted.securityRevision, [admitted.sourceId]);
    return { evidenceId, sourceId: admitted.sourceId, sha256: admitted.artifact.sha256, mediaType: admitted.artifact.mediaType, content };
  }

}
