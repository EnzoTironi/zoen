import type { ActionActor } from "./criteria.js";

/**
 * Host actor facts for MCP/CLI ActionRunner when a session cookie exists.
 * Real ownership / world-scope grants remain on the Engine (SemanticExecutor);
 * these placeholders only satisfy OMS submission-criteria stubs on the client.
 */
export const sessionHostActor = (
  authenticated: boolean,
  principalId: string | null = null
): ActionActor => ({
  authenticated,
  isOwner: authenticated,
  principalId,
  worldScope: authenticated,
});
