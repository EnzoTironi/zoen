import * as cedar from '@cedar-policy/cedar-wasm/nodejs';
import type { Authorizer, Membership, Resource } from '../../contracts/src/ports.js';
import type { OperationDescriptor, VerifiedContext } from '../../contracts/src/semantic.js';
import { KernelError } from '../../kernel/src/result.js';
/** Image-pinned foundation policy; NOT the future runtime policy publisher. */
export const FOUNDATION_POLICY = `
permit(principal, action, resource)
when {
  context.active && context.samePrincipal && context.purpose == "operations" &&
  context.published &&
  (context.role == "owner" || context.role == "editor" || (context.role == "viewer" && !context.mutation))
};
forbid(principal, action, resource)
when { context.sensitivity == "owner-only" && context.role != "owner" };
forbid(principal, action, resource)
when { !context.active || !context.samePrincipal || !context.published };
`;
export class CedarAuthorizer implements Authorizer {
  async authorize(context: VerifiedContext, op: OperationDescriptor, resource: Resource, membership: Membership, purpose: string): Promise<boolean> {
    const result = cedar.isAuthorized({
      principal: { type: 'Zoen::Principal', id: context.principalId },
      action: { type: 'Zoen::Action', id: op.id },
      resource: { type: 'Zoen::Resource', id: `${resource.world.realm}:${resource.world.worldId}:${resource.sourceId ?? 'world'}` },
      context: { active: membership.state === 'active', samePrincipal: membership.principalId === context.principalId,
        role: membership.role, purpose, published: op.published, mutation: op.kind === 'mutation', sensitivity: resource.sensitivity },
      policies: { staticPolicies: FOUNDATION_POLICY }, entities: [],
    });
    if (result.type !== 'success' || result.response.diagnostics.errors.length !== 0) throw new KernelError('Unavailable', 'POLICY_EVALUATION_FAILED');
    return result.response.decision === 'allow';
  }
}
