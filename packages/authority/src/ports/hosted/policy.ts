import {
  HostedErasableDataPolicy,
  HostedRetainedDataPolicy,
} from "@zoen/contracts/hosted/policy/values";

/**
 * Authority-facing aliases of the contracts hosted policies (EX36 / ZA-14).
 * Wired into DataPolicySchema by root; composition defaults remain local retained.
 */
export const HostedRetainedDataPolicySchema = HostedRetainedDataPolicy;
export type HostedRetainedDataPolicySchema =
  typeof HostedRetainedDataPolicySchema.Type;

export const HostedErasableDataPolicySchema = HostedErasableDataPolicy;
export type HostedErasableDataPolicySchema =
  typeof HostedErasableDataPolicySchema.Type;
