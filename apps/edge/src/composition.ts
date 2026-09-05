// @zoen-plan apps/edge/src/composition.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `apps/edge/src/composition.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `apps/edge/src/composition.ts`. Representation: **comment-only-source**. Allocation: **conditional-support**.
//
// Specs: [SPEC-002](../../../docs/specs/spec-002.md), [SPEC-011](../../../docs/specs/spec-011.md), [SPEC-026](../../../docs/specs/spec-026.md), [SPEC-028](../../../docs/specs/spec-028.md), [SPEC-035](../../../docs/specs/spec-035.md), [SPEC-038](../../../docs/specs/spec-038.md), [SPEC-050](../../../docs/specs/spec-050.md), [SPEC-051](../../../docs/specs/spec-051.md), [SPEC-053](../../../docs/specs/spec-053.md), [SPEC-054](../../../docs/specs/spec-054.md).
// Tickets: [ZN-0013](../../../docs/tickets/zn-0013.md), [ZN-0014](../../../docs/tickets/zn-0014.md), [ZN-0015](../../../docs/tickets/zn-0015.md), [ZN-0016](../../../docs/tickets/zn-0016.md), [ZN-0017](../../../docs/tickets/zn-0017.md), [ZN-0018](../../../docs/tickets/zn-0018.md), [ZN-0064](../../../docs/tickets/zn-0064.md), [ZN-0065](../../../docs/tickets/zn-0065.md), [ZN-0066](../../../docs/tickets/zn-0066.md), [ZN-0067](../../../docs/tickets/zn-0067.md), [ZN-0068](../../../docs/tickets/zn-0068.md), [ZN-0153](../../../docs/tickets/zn-0153.md), [ZN-0154](../../../docs/tickets/zn-0154.md), [ZN-0155](../../../docs/tickets/zn-0155.md), [ZN-0156](../../../docs/tickets/zn-0156.md), [ZN-0157](../../../docs/tickets/zn-0157.md), [ZN-0164](../../../docs/tickets/zn-0164.md), [ZN-0165](../../../docs/tickets/zn-0165.md), [ZN-0166](../../../docs/tickets/zn-0166.md), [ZN-0167](../../../docs/tickets/zn-0167.md), [ZN-0205](../../../docs/tickets/zn-0205.md), [ZN-0219](../../../docs/tickets/zn-0219.md), [ZN-0220](../../../docs/tickets/zn-0220.md), [ZN-0221](../../../docs/tickets/zn-0221.md), [ZN-0222](../../../docs/tickets/zn-0222.md), [ZN-0291](../../../docs/tickets/zn-0291.md), [ZN-0292](../../../docs/tickets/zn-0292.md), [ZN-0296](../../../docs/tickets/zn-0296.md), [ZN-0297](../../../docs/tickets/zn-0297.md), [ZN-0308](../../../docs/tickets/zn-0308.md), [ZN-0309](../../../docs/tickets/zn-0309.md), [ZN-0310](../../../docs/tickets/zn-0310.md), [ZN-0311](../../../docs/tickets/zn-0311.md), [ZN-0315](../../../docs/tickets/zn-0315.md).
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
// ### SPEC-002
// DoorPort.verify(assertion) -> PresenceProof; CreatePersonalWorld(operationId, seedDigest) -> GenesisReceipt; OpenWorld(worldId,purpose) -> GrantRef | Denied; AcceptInvitation(invitationToken,operationId) -> MembershipReceipt.
//
// door.subject_map(subject_id PK, principal_id UNIQUE); ontology.worlds(world_id PK, realm, cell_id, epoch, release_digest, generation_id, security_revision, status); ontology.memberships(world_id,principal_id PK, role, status, revision); ontology.grants(grant_hash PK, world_id, principal_id, purpose, audience_hash, assurance, expires_at, security_revision, scope_json); ontology.invitations(invitation_hash PK, world_id, intended_subject, expires_at, consumed_by). Owner runtime role differs from migration owner.
//
// [algorithm SPEC-002](../../../docs/algorithms/spec-002.md)
//
// ### SPEC-011
// AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.
//
// channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.
//
// [algorithm SPEC-011](../../../docs/algorithms/spec-011.md)
//
// ### SPEC-026
// Discover(world,purpose) -> AuthorizedManifest; Invoke(operationId,contractDigest,input,operationId?) -> Result; GenerateClient(manifest,target) -> ReproducibleClient; NegotiateProtocol(clientVersions) -> SelectedVersion | UnsupportedVersion.
//
// No new authority tables. Generated contracts live in contracts/generated/<release-digest> and include operation IDs, input/output/error schemas, effect class, assurance, compatibility and manifest digest. Protocol edition and generated toolchain versions are separately admitted in execution-lock.json.
//
// [algorithm SPEC-026](../../../docs/algorithms/spec-026.md)
//
// ### SPEC-028
// AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.
//
// Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.
//
// [algorithm SPEC-028](../../../docs/algorithms/spec-028.md)
//
// ### SPEC-035
// EditDraft -> Draft; PreviewApp -> IsolatedPreview; PublishApp -> existing DefinitionChange process. AppBridgeRequest is a transport envelope for SemanticCall, not a domain data API.
//
// MiniAppDefinition is released meaning owned by Ontology. SPEC-052 owns definition/manifest contracts; SPEC-051 owns authority-free links and scoped execution sessions; SPEC-029 owns signed artifacts; SPEC-053 owns non-authoritative bridge/runner state. eve.builder_drafts remains non-authoritative authoring state. No app authority database.
//
// [algorithm SPEC-035](../../../docs/algorithms/spec-035.md)
//
// ### SPEC-038
// AuthenticateEnterprise(assertion,connection) -> PresenceProof; ApplyDirectoryChange(connection,event) -> ProvisioningReceipt; ReconcileDirectory(connection,cut) -> Differences; MintWorkloadIdentity(scope) -> NarrowCredential.
//
// door.enterprise_connections(connection_id PK,organization_ref,protocol,issuer,metadata_digest,state); door.directory_subjects(connection_id,external_id PK,principal_ref,version,active); ontology.directory_mappings(mapping_id PK,world_id,connection_id,group_ref,role_scope,release_ref); audit.provisioning_events(event_id PK,connection_id,provider_event_ref,state,receipt_ref). Workloads have distinct principals, not shared human sessions.
//
// [algorithm SPEC-038](../../../docs/algorithms/spec-038.md)
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
// ### SPEC-053
// BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.
//
// No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.
//
// [algorithm SPEC-053](../../../docs/algorithms/spec-053.md)
//
// ### SPEC-054
// Zoen-owned port: PrepareRuntime(artifact,profile,realm) -> PreparedRuntime; ProbeRuntime(preparation) -> Attestation; ResolvePreparedRuntime(binding,session) -> IsolatedTarget; RetireRuntime(slot) -> Result. These are Zoen adapter contracts, not asserted Rivet API names.
//
// jobs.app_runtime_preparations(preparation_id PK,world_id,realm,manifest_digest,artifact_digest,profile_digest,runtime_slot_ref,host_state_partition,attempt_fence,status,attestation_ref,expires_at); jobs.app_runtime_slots(slot_ref PK,immutable_identity,digest,runner_scope,state). Public AppPublicationBinding remains in the released Ontology graph. Runtime process globals/SQLite are not authoritative company data.
//
// [algorithm SPEC-054](../../../docs/algorithms/spec-054.md)
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
