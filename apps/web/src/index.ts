/**
 * Web app entry — relationship/Living World/Studio surface.
 * Forbidden: source/provider/authority credentials and raw pg adapters.
 * All data/effects must pass through semantic operations.
 */
export type WebSurfaceMarker = { readonly kind: 'web-surface'; readonly holdsAuthorityCredentials: false };

export function createWebSurfaceMarker(): WebSurfaceMarker {
  return { kind: 'web-surface', holdsAuthorityCredentials: false };
}

export const WEB_DEPENDENCY_BOUNDARY = {
  package: 'apps/web',
  mayImport: ['packages/clients', 'packages/contracts', 'packages/kernel'] as const,
  mustNotImport: ['pg', 'packages/adapters/src/pg', 'packages/adapters/src/config'] as const,
} as const;
