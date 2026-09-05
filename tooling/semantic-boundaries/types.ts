/** SPEC-050 / ZN-0292 — module-graph classification types. */

export type RootKind = 'trusted-composition' | 'client' | 'shared-contracts' | 'unknown';

export type ForbiddenEdge = Readonly<{
  from: string;
  to: string;
  detail: string;
  via?: string;
}>;

export type BoundaryFinding = Readonly<{
  code: string;
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}>;

export type NoBypassReport = Readonly<{
  schemaVersion: string;
  ticket: 'ZN-0292';
  spec: 'SPEC-050';
  status: 'Certified' | 'Rejected';
  selectedFileCount: number;
  clientRoots: readonly string[];
  trustedRoots: readonly string[];
  forbiddenEdges: readonly ForbiddenEdge[];
  allowedSemanticClientImports: readonly string[];
  findings: readonly BoundaryFinding[];
  fixtureSeed: string;
}>;
