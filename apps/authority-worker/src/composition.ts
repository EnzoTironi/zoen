// @zoen-plan apps/authority-worker/src/composition.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/authority-worker/src/composition.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/authority-worker/src/composition.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-003](../../../docs/specs/spec-003.md), [SPEC-004](../../../docs/specs/spec-004.md), [SPEC-005](../../../docs/specs/spec-005.md), [SPEC-006](../../../docs/specs/spec-006.md), [SPEC-007](../../../docs/specs/spec-007.md), [SPEC-013](../../../docs/specs/spec-013.md), [SPEC-014](../../../docs/specs/spec-014.md), [SPEC-015](../../../docs/specs/spec-015.md), [SPEC-017](../../../docs/specs/spec-017.md), [SPEC-018](../../../docs/specs/spec-018.md), [SPEC-019](../../../docs/specs/spec-019.md), [SPEC-020](../../../docs/specs/spec-020.md), [SPEC-022](../../../docs/specs/spec-022.md), [SPEC-023](../../../docs/specs/spec-023.md), [SPEC-024](../../../docs/specs/spec-024.md), [SPEC-025](../../../docs/specs/spec-025.md), [SPEC-029](../../../docs/specs/spec-029.md), [SPEC-031](../../../docs/specs/spec-031.md), [SPEC-032](../../../docs/specs/spec-032.md), [SPEC-033](../../../docs/specs/spec-033.md), [SPEC-034](../../../docs/specs/spec-034.md), [SPEC-036](../../../docs/specs/spec-036.md), [SPEC-037](../../../docs/specs/spec-037.md), [SPEC-040](../../../docs/specs/spec-040.md), [SPEC-042](../../../docs/specs/spec-042.md), [SPEC-043](../../../docs/specs/spec-043.md), [SPEC-044](../../../docs/specs/spec-044.md), [SPEC-050](../../../docs/specs/spec-050.md), [SPEC-051](../../../docs/specs/spec-051.md), [SPEC-052](../../../docs/specs/spec-052.md).
// Tickets: [ZN-0019](../../../docs/tickets/zn-0019.md), [ZN-0020](../../../docs/tickets/zn-0020.md), [ZN-0021](../../../docs/tickets/zn-0021.md), [ZN-0022](../../../docs/tickets/zn-0022.md), [ZN-0023](../../../docs/tickets/zn-0023.md), [ZN-0025](../../../docs/tickets/zn-0025.md), [ZN-0026](../../../docs/tickets/zn-0026.md), [ZN-0027](../../../docs/tickets/zn-0027.md), [ZN-0028](../../../docs/tickets/zn-0028.md), [ZN-0029](../../../docs/tickets/zn-0029.md), [ZN-0031](../../../docs/tickets/zn-0031.md), [ZN-0032](../../../docs/tickets/zn-0032.md), [ZN-0033](../../../docs/tickets/zn-0033.md), [ZN-0034](../../../docs/tickets/zn-0034.md), [ZN-0035](../../../docs/tickets/zn-0035.md), [ZN-0036](../../../docs/tickets/zn-0036.md), [ZN-0037](../../../docs/tickets/zn-0037.md), [ZN-0038](../../../docs/tickets/zn-0038.md), [ZN-0039](../../../docs/tickets/zn-0039.md), [ZN-0040](../../../docs/tickets/zn-0040.md), [ZN-0041](../../../docs/tickets/zn-0041.md), [ZN-0042](../../../docs/tickets/zn-0042.md), [ZN-0043](../../../docs/tickets/zn-0043.md), [ZN-0044](../../../docs/tickets/zn-0044.md), [ZN-0046](../../../docs/tickets/zn-0046.md), [ZN-0075](../../../docs/tickets/zn-0075.md), [ZN-0076](../../../docs/tickets/zn-0076.md), [ZN-0077](../../../docs/tickets/zn-0077.md), [ZN-0078](../../../docs/tickets/zn-0078.md), [ZN-0079](../../../docs/tickets/zn-0079.md), [ZN-0080](../../../docs/tickets/zn-0080.md), [ZN-0081](../../../docs/tickets/zn-0081.md), [ZN-0082](../../../docs/tickets/zn-0082.md), [ZN-0083](../../../docs/tickets/zn-0083.md), [ZN-0084](../../../docs/tickets/zn-0084.md), [ZN-0085](../../../docs/tickets/zn-0085.md), [ZN-0086](../../../docs/tickets/zn-0086.md), [ZN-0087](../../../docs/tickets/zn-0087.md), [ZN-0089](../../../docs/tickets/zn-0089.md), [ZN-0090](../../../docs/tickets/zn-0090.md), [ZN-0091](../../../docs/tickets/zn-0091.md), [ZN-0092](../../../docs/tickets/zn-0092.md), [ZN-0093](../../../docs/tickets/zn-0093.md), [ZN-0094](../../../docs/tickets/zn-0094.md), [ZN-0101](../../../docs/tickets/zn-0101.md), [ZN-0102](../../../docs/tickets/zn-0102.md), [ZN-0103](../../../docs/tickets/zn-0103.md), [ZN-0104](../../../docs/tickets/zn-0104.md), [ZN-0106](../../../docs/tickets/zn-0106.md), [ZN-0107](../../../docs/tickets/zn-0107.md), [ZN-0108](../../../docs/tickets/zn-0108.md), [ZN-0109](../../../docs/tickets/zn-0109.md), [ZN-0110](../../../docs/tickets/zn-0110.md), [ZN-0112](../../../docs/tickets/zn-0112.md), [ZN-0113](../../../docs/tickets/zn-0113.md), [ZN-0114](../../../docs/tickets/zn-0114.md), [ZN-0115](../../../docs/tickets/zn-0115.md), [ZN-0118](../../../docs/tickets/zn-0118.md), [ZN-0119](../../../docs/tickets/zn-0119.md), [ZN-0120](../../../docs/tickets/zn-0120.md), [ZN-0121](../../../docs/tickets/zn-0121.md), [ZN-0122](../../../docs/tickets/zn-0122.md), [ZN-0129](../../../docs/tickets/zn-0129.md), [ZN-0130](../../../docs/tickets/zn-0130.md), [ZN-0131](../../../docs/tickets/zn-0131.md), [ZN-0132](../../../docs/tickets/zn-0132.md), [ZN-0135](../../../docs/tickets/zn-0135.md), [ZN-0136](../../../docs/tickets/zn-0136.md), [ZN-0137](../../../docs/tickets/zn-0137.md), [ZN-0138](../../../docs/tickets/zn-0138.md), [ZN-0139](../../../docs/tickets/zn-0139.md), [ZN-0141](../../../docs/tickets/zn-0141.md), [ZN-0142](../../../docs/tickets/zn-0142.md), [ZN-0143](../../../docs/tickets/zn-0143.md), [ZN-0144](../../../docs/tickets/zn-0144.md), [ZN-0147](../../../docs/tickets/zn-0147.md), [ZN-0148](../../../docs/tickets/zn-0148.md), [ZN-0149](../../../docs/tickets/zn-0149.md), [ZN-0150](../../../docs/tickets/zn-0150.md), [ZN-0151](../../../docs/tickets/zn-0151.md), [ZN-0169](../../../docs/tickets/zn-0169.md), [ZN-0170](../../../docs/tickets/zn-0170.md), [ZN-0171](../../../docs/tickets/zn-0171.md), [ZN-0172](../../../docs/tickets/zn-0172.md), [ZN-0180](../../../docs/tickets/zn-0180.md), [ZN-0181](../../../docs/tickets/zn-0181.md), [ZN-0182](../../../docs/tickets/zn-0182.md), [ZN-0183](../../../docs/tickets/zn-0183.md), [ZN-0184](../../../docs/tickets/zn-0184.md), [ZN-0186](../../../docs/tickets/zn-0186.md), [ZN-0187](../../../docs/tickets/zn-0187.md), [ZN-0188](../../../docs/tickets/zn-0188.md), [ZN-0189](../../../docs/tickets/zn-0189.md), [ZN-0190](../../../docs/tickets/zn-0190.md), [ZN-0192](../../../docs/tickets/zn-0192.md), [ZN-0193](../../../docs/tickets/zn-0193.md), [ZN-0194](../../../docs/tickets/zn-0194.md), [ZN-0195](../../../docs/tickets/zn-0195.md), [ZN-0197](../../../docs/tickets/zn-0197.md), [ZN-0198](../../../docs/tickets/zn-0198.md), [ZN-0199](../../../docs/tickets/zn-0199.md), [ZN-0200](../../../docs/tickets/zn-0200.md), [ZN-0207](../../../docs/tickets/zn-0207.md), [ZN-0208](../../../docs/tickets/zn-0208.md), [ZN-0209](../../../docs/tickets/zn-0209.md), [ZN-0210](../../../docs/tickets/zn-0210.md), [ZN-0211](../../../docs/tickets/zn-0211.md), [ZN-0213](../../../docs/tickets/zn-0213.md), [ZN-0214](../../../docs/tickets/zn-0214.md), [ZN-0215](../../../docs/tickets/zn-0215.md), [ZN-0216](../../../docs/tickets/zn-0216.md), [ZN-0231](../../../docs/tickets/zn-0231.md), [ZN-0232](../../../docs/tickets/zn-0232.md), [ZN-0233](../../../docs/tickets/zn-0233.md), [ZN-0234](../../../docs/tickets/zn-0234.md), [ZN-0245](../../../docs/tickets/zn-0245.md), [ZN-0246](../../../docs/tickets/zn-0246.md), [ZN-0247](../../../docs/tickets/zn-0247.md), [ZN-0248](../../../docs/tickets/zn-0248.md), [ZN-0250](../../../docs/tickets/zn-0250.md), [ZN-0251](../../../docs/tickets/zn-0251.md), [ZN-0252](../../../docs/tickets/zn-0252.md), [ZN-0253](../../../docs/tickets/zn-0253.md), [ZN-0255](../../../docs/tickets/zn-0255.md), [ZN-0256](../../../docs/tickets/zn-0256.md), [ZN-0257](../../../docs/tickets/zn-0257.md), [ZN-0258](../../../docs/tickets/zn-0258.md), [ZN-0259](../../../docs/tickets/zn-0259.md), [ZN-0291](../../../docs/tickets/zn-0291.md), [ZN-0293](../../../docs/tickets/zn-0293.md), [ZN-0294](../../../docs/tickets/zn-0294.md), [ZN-0295](../../../docs/tickets/zn-0295.md), [ZN-0296](../../../docs/tickets/zn-0296.md), [ZN-0299](../../../docs/tickets/zn-0299.md), [ZN-0302](../../../docs/tickets/zn-0302.md), [ZN-0303](../../../docs/tickets/zn-0303.md), [ZN-0304](../../../docs/tickets/zn-0304.md), [ZN-0307](../../../docs/tickets/zn-0307.md).
//
// ## Responsibility and reuse
//
// ```text
// COMPOSITION/REGISTRATION PLAN.
// IMPORT only reviewed implemented ports and adapters under the existing dependency direction.
// BIND the existing semantic executor once; register this module's released operation descriptors.
// DO NOT add business rules, source credentials, alternate policy evaluators or a second dispatcher here.
// GATE unavailable capabilities explicitly; an unwired implementation does not satisfy a ticket.
// KEEP shared composition edits under the named exclusive lock.
// ```
//
// ## Owning state / operation contracts
//
// ### SPEC-003
// AuthorityCommit(context, expectedHead, guards, operationKey, typedPlan) -> Receipt | Stale | Conflict; ProgressCommit(leaseToken,progress) -> Progress | LostLease; ClaimOutbox(owner,limit) -> FencedBatch.
//
// ontology.domains(world_id,domain_id PK,version bigint>=0); ontology.operations(world_id,principal_id,semantic_op,operation_id PK,intent_digest,result_ref,commit_id); ontology.commits(commit_id PK,world_id,head_digest,touched_domains jsonb,recorded_at); ontology.receipts(receipt_id PK,world_id,commit_id,kind,payload_digest,payload_json); jobs.outbox(outbox_id PK,owner,world_id,commit_id,event_ordinal,payload_ref,status,lease_owner,fence,lease_until,UNIQUE(owner,commit_id,event_ordinal)). All world references include realm and ownership checks.
//
// [algorithm SPEC-003](../../../docs/algorithms/spec-003.md)
//
// ### SPEC-004
// StageCapture(binding,stream,declaredMetadata) -> CaptureRef | Quarantined; AdmitCapture(captureRef,mappingDigest,operationId) -> AdmissionReceipt; ReadEvidence(evidenceRef,grant) -> AuthorizedStream | HistoricalContentUnavailable.
//
// ontology.source_bindings(binding_id PK,world_id,definition_id,state,credential_ref,acl_revision); ontology.captures(capture_id PK,world_id,binding_id,source_namespace,external_id,revision,blob_ref,digest,acquired_at,state,UNIQUE(world_id,binding_id,external_id,revision,digest)); ontology.evidence(evidence_id PK,world_id,capture_id,rights_ref,validity_json,retention_ref,admission_commit); ontology.source_admissions(binding_id,capture_id,mapping_digest PK,receipt_id). Object keys are opaque World/realm-scoped; object digests are internal.
//
// [algorithm SPEC-004](../../../docs/algorithms/spec-004.md)
//
// ### SPEC-005
// CompareClaims(claims,meaningProfile) -> ComparableGroups; Interpret(query,basis,perspective) -> Interpretation; ApplyScopedReply(caseId,questionDigest,answer,operationId) -> CorrectionReceipt | Stale; Explain(interpretationId,grant) -> ExplanationFrame.
//
// ontology.claims(claim_id PK,world_id,subject_id,predicate_id,value_json,unit,scope_json,valid_from,valid_until,source_family,evidence_refs,asserted_by,domain_id,knowledge_version); ontology.claim_edges(world_id,parent_id,child_id,kind PK); ontology.interpretations(interpretation_id PK,world_id,query_digest,release_digest,cut_digest,perspective,status,verification,contested,selected_refs,rival_refs,dependency_refs); ontology.corrections(correction_id PK,world_id,target_claim,successor_claim,actor,case_ref,receipt_ref). Values are immutable except governed erasure.
//
// [algorithm SPEC-005](../../../docs/algorithms/spec-005.md)
//
// ### SPEC-006
// ProposeIdentityResolution(candidates,basis) -> ResolutionCase; ResolveIdentity(caseId,choice,operationId) -> IdentityReceipt; ExplainIdentity(subject,cut) -> AuthorizedIdentityFrame.
//
// ontology.subjects(subject_id PK,world_id,created_commit); ontology.aliases(world_id,binding_id,namespace,external_id,valid_from PK,subject_ref,assertion_ref); ontology.identity_assertions(assertion_id PK,world_id,left_subject,right_subject,relation,valid_interval,knowledge_version,evidence_refs,supersedes); ontology.identity_cases(case_id PK,world_id,candidate_digest,basis_ref,state). No unique constraint on display name or email alone.
//
// [algorithm SPEC-006](../../../docs/algorithms/spec-006.md)
//
// ### SPEC-007
// Inspect(operationId,input,purpose,expectedContract) -> WorldFrame; Explain(frameId,grant) -> Frame; OpenFrame(frameId,freshGrant) -> SameHistoricalFrame | NewerFrame | HistoricalContentUnavailable; Discover(grant) -> AllowedOperationManifest.
//
// ontology.frames(frame_id PK,world_id,head_digest,cut_json,operation_id,plan_digest,perspective,rights_basis,payload_ref,created_at,expires_at); ontology.frame_pins(frame_id,evidence_or_snapshot_ref PK,retention_class). Opaque Focus records live in Eve, not here. Index frames by World and ID; no global public digest endpoint.
//
// [algorithm SPEC-007](../../../docs/algorithms/spec-007.md)
//
// ### SPEC-013
// CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.
//
// ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.
//
// [algorithm SPEC-013](../../../docs/algorithms/spec-013.md)
//
// ### SPEC-014
// ProposeDefinitionChange(base,patch,operationId) -> Change; EvaluateChange(change) -> ReleaseProof; PrepareActivation(change,world) -> PreparedActivation; ApproveChange(change,digest) -> Approval; ActivateRelease(proof,preparation,approval,operationId) -> ActivationReceipt | PreparationStale.
//
// ontology.changes(change_id PK,world_id,base_release,candidate_release,risk,state,author,version); ontology.release_proofs(proof_id PK,release_digest,kernel_image,evaluation_world,cut_digest,report_ref,missing_attestations); ontology.preparations(preparation_id PK,world_id,expected_head,target_release,target_generation,through_cut,open_work_disposition,state); ontology.release_approvals(change_id,principal_id,case_digest PK,policy_basis); ontology.activations(receipt_id PK,world_id,old_head,new_head,proof_ref,preparation_ref). Evaluation namespaces and credentials are separate.
//
// [algorithm SPEC-014](../../../docs/algorithms/spec-014.md)
//
// ### SPEC-015
// ConfigureSource(definition,instance,operationId) -> Binding; SyncSource(binding,cursor) -> CapturedBatch; AdmitBatch(binding,batch,expectedCursor) -> BatchReceipt; InventoryCoverage(world,scope) -> CoverageFrame.
//
// ontology.source_inventory(source_id PK,world_id,owner,category,coverage_scope,expected_freshness,admission_state); ontology.source_bindings(binding_id PK,world_id,definition_digest,credential_ref,state,acl_policy_ref); jobs.source_cursors(binding_id,partition_id PK,cursor_json,watermark,lease_fence,schema_digest); ontology.source_health(binding_id,observed_at PK,status,gaps_json); ontology.source_tombstones(binding_id,external_id,revision PK,evidence_ref).
//
// [algorithm SPEC-015](../../../docs/algorithms/spec-015.md)
//
// ### SPEC-017
// RankClarifications(scope,budget) -> QuestionQueue; AssignSteward(question,principal) -> Assignment; AnswerQuestion(question,digest,answerKind,payload,operationId) -> ScopedReceipt | RuleDraft | Stale.
//
// ontology.clarifications(question_id PK,world_id,subject,predicate,scope_digest,candidate_digest,basis_ref,impact,deadline,state,steward_ref); ontology.stewardships(stewardship_id PK,world_id,scope,principal_ref,authority_kind,valid_interval); eve.question_delivery(question_id,relationship_id PK,attention_state,last_presented_digest). Deduplicate by world/subject/predicate/scope/candidate version.
//
// [algorithm SPEC-017](../../../docs/algorithms/spec-017.md)
//
// ### SPEC-018
// Authorize(principal,operation,resource,purpose,destination,context) -> AllowBasis | Denied; DeriveRights(inputLabels,transform) -> OutputLabel | Rejected; OpenAudienceView(frame,audience) -> IntersectionView; Delegate(scope) -> DelegationReceipt.
//
// ontology.delegations(delegation_id PK,world_id,grantor,grantee,scope,purpose,destination,assurance,expires_at,parent_ref,revoked_at); ontology.rights_labels(label_id PK,world_id,source_refs,policy_refs,license_refs); ontology.source_acls(binding_id,acl_revision,subject_ref PK,permissions,valid_until); ontology.disclosure_receipts(receipt_id PK,frame_ref,audience_digest,rights_cut,outcome). Secret role/policy metadata obeys disclosure too.
//
// [algorithm SPEC-018](../../../docs/algorithms/spec-018.md)
//
// ### SPEC-019
// RequestErasure(scope) -> ReviewedCase; PlanErasure(case,basis) -> ArtifactClosure; ExecuteErasure(task,permit) -> DeletionReceipt; CheckRestoreSuppression(restoredCut,currentLedger) -> SuppressionPlan | Blocked.
//
// ontology.retention_policies(policy_id PK,scope,purpose,expiry_rule,hold_rules,version); ontology.erasure_cases(case_id PK,scope,requested_by,state,decision_ref); ontology.erasure_tasks(task_id PK,case_id,artifact_ref,store,kind,state,receipt_ref); audit.deletion_ledger(sequence PK,scope_digest,artifact_ref,decision_ref,effective_at); ontology.holds(hold_id PK,scope,authority_evidence,expires_at,state). Deletion ledger durability is separate from a restored application backup.
//
// [algorithm SPEC-019](../../../docs/algorithms/spec-019.md)
//
// ### SPEC-020
// CreateWatch(definition,scope,operationId) -> Watch; EvaluateWatch(watch,commitEnvelope) -> Checkpoint | Notice; DecideAttention(noticeRef,relationship) -> Deliver | Merge | Defer | Silence; PauseWatch/ResumeWatch/CancelWatch -> Receipt.
//
// ontology.watches(watch_id PK,world_id,definition_digest,subject_scope,state,checkpoint_cut,materiality_state); ontology.notices(notice_id PK,watch_id,transition_identity,basis_ref,state,UNIQUE(watch_id,transition_identity)); eve.attention(notice_id,relationship_id PK,state,reason,not_before,merge_group,last_checked_rights); ontology.subscriptions(subscription_id PK,world_id,plan_digest,cursor,state).
//
// [algorithm SPEC-020](../../../docs/algorithms/spec-020.md)
//
// ### SPEC-022
// ProposeAction(action,input,basis) -> ActionCase; AnswerCase(caseId,caseDigest,answer,operationId) -> CaseProgress | Receipt | Stale; CancelCase(caseId,operationId) -> State; CommitCase(caseId,digest) -> DecisionReceipt.
//
// ontology.action_cases(case_id PK,world_id,revision,action_id,release_digest,basis_ref,intent_json,case_digest,consequences_digest,guards_json,expires_at,state); ontology.case_approvals(case_id,revision,principal_id PK,answer,case_digest,assurance,policy_basis,recorded_at); ontology.case_receipts(case_id,revision PK,receipt_id,commit_id). Normative states add cancelled and blocked to v2 representative type examples.
//
// [algorithm SPEC-022](../../../docs/algorithms/spec-022.md)
//
// ### SPEC-023
// AcquireEffectPermit(intent,worker,epoch) -> Permit | Denied; AttemptEffect(intent,permit) -> AttemptObservation; ReconcileEffect(effectId) -> ObservedState | Unknown; RecordSettlement(effectId,providerEvidence) -> SettlementReceipt.
//
// ontology.effect_intents(effect_id PK,world_id,receipt_id,ordinal,provider,operation,intent_digest,args_ref,deadline,UNIQUE(receipt_id,ordinal)); ontology.effect_attempts(attempt_id PK,effect_id,epoch,fence,permit_ref,state,sent_at,provider_key,observation_ref); ontology.settlements(settlement_id PK,effect_id,status,provider_state,evidence_refs,observed_at,supersedes); ontology.provider_contracts(contract_id PK,provider,api_version,idempotency_scope,horizon,reconciliation_modes,certificate_ref).
//
// [algorithm SPEC-023](../../../docs/algorithms/spec-023.md)
//
// ### SPEC-024
// CreateMandate(definition,scope,budget,operationId) -> Mandate; ReserveBudget(path,amount,operationId) -> Reservation | BudgetExceeded; ObserveGoal(mandate,evidence) -> pending|achieved|failed|unknown|stopped; StopMandate(id) -> StopReceipt.
//
// ontology.budgets(budget_id PK,world_id,parent_ref,unit,limit_amount,reserved_amount,spent_amount,version); ontology.reservations(reservation_id PK,budget_id,case_ref,effect_ref,amount,state); ontology.mandates(mandate_id PK,world_id,goal_definition,scope,action_allowlist,budget_ref,deadline,state,outcome,basis_ref); ontology.mandate_steps(step_id PK,mandate_id,action_case_ref,observation_ref,state).
//
// [algorithm SPEC-024](../../../docs/algorithms/spec-024.md)
//
// ### SPEC-025
// Search(query,grant,bounds) -> AuthorizedSearchFrame | UnsupportedPlan; RetrieveEvidence(resultRef,freshGrant) -> Evidence; StartSpecializedAgent(definition,parentMandate,task) -> BoundedAgentRun.
//
// ontology.search_documents(document_id PK,world_id,evidence_ref,source_revision,projection_cut,rights_label,text_vector,embedding_ref); ontology.embedding_jobs(job_id PK,source_ref,model_profile,rights_basis,state); ontology.agent_definitions are released data, not unbounded executable loaders. Index records carry deletion/source ACL lineage.
//
// [algorithm SPEC-025](../../../docs/algorithms/spec-025.md)
//
// ### SPEC-029
// ProposeArtifact(envelope,bytesRef) -> Candidate; EvaluateArtifact(candidate,EvaluationWorld) -> Proof; InstallArtifact(digest,requestedGrant,operationId) -> Change; RecallArtifact(digest) -> RecallReceipt.
//
// ontology.artifacts(artifact_digest PK,kind,runtime_abi,entrypoint,sbom_ref,provenance_ref,signature_ref,capability_request,resource_profile); ontology.installations(installation_id PK,world_id,artifact_digest,granted_scope,release_ref,state); ontology.artifact_recalls(recall_id PK,digest,reason,effective_at,scope); ontology.artifact_evaluations(evaluation_id PK,digest,profile,report_ref,state). Blobs are retained under controlled object-store policy.
//
// [algorithm SPEC-029](../../../docs/algorithms/spec-029.md)
//
// ### SPEC-031
// StageDataset(run,inputs) -> StagedVersion; ValidateDataset(stage) -> QualityResult; PinDataset(stage,retention) -> PinProof; PublishDataset(versionSet,expectedBasis,operationId) -> PublicationReceipt; ReadDataset(versionRef,grant) -> ExactSnapshotReader.
//
// ontology.dataset_versions(version_id PK,world_id,dataset_id,table_uuid,snapshot_id,metadata_location,metadata_digest,schema_digest,partition_spec,input_cut,lineage_ref,rights_label,quality_ref); ontology.dataset_pins(pin_id PK,version_id,artifact_set_digest,retention_until,state); ontology.dataset_publications(publication_id PK,world_id,version_refs,commit_id); jobs.dataset_stages(stage_id PK,run_id,table_branch,version_ref,state). Catalog uses a separate database.
//
// [algorithm SPEC-031](../../../docs/algorithms/spec-031.md)
//
// ### SPEC-032
// RunFlow(definition,inputs) -> FlowRun; CheckpointPartition(run,partition,fence,cursor) -> Progress; EvaluateQuality(check,inputCoverage) -> pass|fail|unknown; ProposeFlowPublication(run) -> DatasetProposal | Blocked.
//
// ontology.flow_definitions are released data; jobs.flow_runs(run_id PK,world_id,definition_digest,input_cut,state,attempt,budget_ref); jobs.flow_partitions(run_id,partition PK,cursor,watermark,gaps_json,fence,state); ontology.lineage_edges(output_ref,input_ref,field_mapping_digest PK); ontology.quality_results(result_id PK,run_id,check_id,status,coverage,details_ref).
//
// [algorithm SPEC-032](../../../docs/algorithms/spec-032.md)
//
// ### SPEC-033
// SubscribeLive(binding,subjects,grant) -> EntitledSubscription; ObserveFeed(envelope) -> TransientState; CaptureObservation(binding,sequence,maxAge,operationId) -> CapturedObservationRef | SourceStale; SealFeedRange(range) -> DatasetProposal.
//
// live feed transport is non-authoritative and bounded; ontology.feed_bindings(binding_id PK,world_id,provider,feed_contract,entitlement_ref); ontology.live_captures(capture_id PK,world_id,binding_id,provider_sequence,event_time,acquired_at,digest,evidence_ref,rights_ref); ontology.feed_gaps(gap_id PK,binding_id,sequence_range,state). Sealed history publishes through normal datasets.
//
// [algorithm SPEC-033](../../../docs/algorithms/spec-033.md)
//
// ### SPEC-034
// ExecuteVirtualRead(plan,lease) -> CapturedResult | ReferenceOnlyResult; SubmitCompute(profile,artifact,inputs,budget) -> Run; ObserveCompute(run) -> State; AdmitComputeOutput(run) -> AnalysisOrDatasetProposal.
//
// jobs.compute_runs(run_id PK,world_id,engine_profile,input_cut,artifact_digest,budget_ref,state,output_ref,usage); ontology.virtual_reads(read_id PK,world_id,source_binding,query_digest,external_snapshot_ref,observed_at,coverage,rights_ref,capture_ref_nullable). Engine configuration and scale parameters are versioned runtime data under an admitted adapter ABI.
//
// [algorithm SPEC-034](../../../docs/algorithms/spec-034.md)
//
// ### SPEC-036
// CreateScenario(base,assumptions) -> Scenario; RunScenario(scenario,analysis) -> HypotheticalResult; CompareScenarios(ids,metric) -> ComparisonFrame; ProposeFromScenario(resultRef,currentGrant) -> FreshLiveCase; AdmitModelArtifact(manifest,eval) -> CandidateModel.
//
// ontology.scenarios(scenario_id PK,world_id,base_cut,assumptions_ref,analysis_refs,state,rights_label); ontology.model_artifacts(model_digest PK,training_manifest,code_digest,evaluation_ref,rights_label,retention_policy,admission_state); ontology.scenario_comparisons(comparison_id PK,scenario_refs,metric_definition,coverage,output_ref).
//
// [algorithm SPEC-036](../../../docs/algorithms/spec-036.md)
//
// ### SPEC-037
// ResolvePackGraph(request,pinnedBase) -> LockedGraph; InstallPack(graph,overlay) -> Change; UpgradePack(install,target) -> SemanticDiff; RemovePack(install) -> DispositionPlan; VerifyPublisher(signature) -> VerifiedOrigin | Denied.
//
// ontology.pack_versions(pack_digest PK,publisher,namespace,version,dependencies,requested_capabilities,artifact_refs,signature_ref,license_ref); ontology.pack_installs(install_id PK,world_id,pack_digest,overlay_ref,granted_scope,state); ontology.publisher_records(publisher_id PK,verified_identity,signing_keys,review_state); ontology.marketplace_entitlements(entitlement_id PK,world_id,pack_ref,terms_version,state). No publisher can query installed customer data by default.
//
// [algorithm SPEC-037](../../../docs/algorithms/spec-037.md)
//
// ### SPEC-040
// ReserveUsage(world,resource,estimate) -> Reservation | QuotaExceeded; AdmitWorkload(profile,benchmarkReport) -> CapacityCertificate; RequestSupportAccess(scope,purpose) -> TimeBoundCase; ExportAudit(scope,destination) -> AuthorizedArtifact.
//
// ontology.quota_policies(policy_id PK,world_id,resource,limit,window,priority); jobs.usage_reservations(reservation_id PK,world_id,kind,estimate,actual,state); audit.support_sessions(session_id PK,operator,world_scope,purpose,approver,expires_at,state); audit.slo_reports(report_id PK,profile,workload_digest,window,metrics,evidence_ref). Billing ledger references provider entitlements, never raw card data.
//
// [algorithm SPEC-040](../../../docs/algorithms/spec-040.md)
//
// ### SPEC-042
// PrepareMove(world,destination) -> StagedReplica; FenceSource(world,epoch) -> FenceReceipt; PromoteWorld(fence,destinationProof,expectedDirectory) -> NewEpoch; AdmitBoot(world,cell,epoch) -> WriteAdmission | ReadOnly.
//
// control.world_directory(world_id,realm PK,cell_id,epoch,region,state,version); control.promotions(promotion_id PK,world_id,source_epoch,target_epoch,source_fence_receipt,destination_proof,state); ontology.local_authority(world_id PK,installed_epoch,write_enabled,fence_receipt,boot_admission); jobs.migration_runs(run_id PK,world_id,source_cut,target_cut,validation_ref,state). Directory is a single-writer durable control store, not a grant database.
//
// [algorithm SPEC-042](../../../docs/algorithms/spec-042.md)
//
// ### SPEC-043
// OpenFederatedFrame(plan,localGrant,remoteDelegations) -> FederatedFrame; ProposeCoordination(plan) -> CoordinationCase; ObserveParticipant(receipt) -> PartialState; CompensateParticipant(action) -> NewLocalCase.
//
// ontology.federation_links(link_id PK,local_world,remote_world,trust_profile,permitted_ops,rights_contract,expiry); ontology.federated_frames(frame_id PK,component_refs,cuts,rights_basis,skew,gaps); ontology.coordinations(coordination_id PK,world_id,plan_digest,participants,state,outcome); ontology.coordination_parts(coordination_id,participant PK,local_case_ref,receipt_ref,external_state). No shared global grant/token.
//
// [algorithm SPEC-043](../../../docs/algorithms/spec-043.md)
//
// ### SPEC-044
// IssueOfflineLease(scope,resourcePartition,expiry) -> ChildLease; RecordOfflineOperation(lease,intent) -> LocalReceipt | Denied; ReconcileChild(receipts) -> Admitted|Conflict|Expired; AdmitSelfHostedProfile(evidence) -> Profile; ProposeFleetUpdate(release) -> LocalChangeSet.
//
// ontology.child_leases(lease_id PK,parent_world,child_scope,epoch,resource_partition,allowed_ops,expires_at,clock_uncertainty,max_offline,state); ontology.offline_receipts(receipt_id PK,child_scope,lease_ref,sequence,intent_digest,observed_basis,reconciled_state); control.fleet_profiles(profile_id PK,version,equivalence_evidence,policy_digest,state).
//
// [algorithm SPEC-044](../../../docs/algorithms/spec-044.md)
//
// ### SPEC-050
// SemanticCall(envelope, verifiedRequestContext) -> tagged SemanticResult. Discover, Inspect, Propose, AnswerCase, Commit, Subscribe, Export and admitted Analysis are released operation families, not free-form repository methods.
//
// No new authority store. Reuse operation registry, grants, read guards, ActionCases, receipts and outbox. Descriptor/cache keys bind world, principal, delegation, app binding, purpose, release, query digest, cut and security revision. Cursor/chunk handles are references, not bearer permits.
//
// [algorithm SPEC-050](../../../docs/algorithms/spec-050.md)
//
// ### SPEC-051
// CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.
//
// ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.
//
// [algorithm SPEC-051](../../../docs/algorithms/spec-051.md)
//
// ### SPEC-052
// ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.
//
// MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.
//
// [algorithm SPEC-052](../../../docs/algorithms/spec-052.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
