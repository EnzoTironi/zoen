/** Typed local authority plan marker (no provider I/O). */
export type TypedAuthorityPlan = Readonly<{
  kind: string;
  domains: readonly string[];
  payload: Readonly<Record<string, unknown>>;
}>;

export function typedPlan(
  kind: string,
  domains: readonly string[],
  payload: Readonly<Record<string, unknown>> = {},
): TypedAuthorityPlan {
  return Object.freeze({ kind, domains: Object.freeze([...domains]), payload: Object.freeze({ ...payload }) });
}
