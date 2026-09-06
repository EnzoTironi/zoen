import { HostedRetainedDataPolicy } from "@zoen/contracts/hosted/policy/values";

/**
 * Authority-facing alias of the contracts hosted retained policy (EX36 / H01–H02).
 * Wired into DataPolicySchema by root; composition defaults remain local retained.
 */
export const HostedRetainedDataPolicySchema = HostedRetainedDataPolicy;
export type HostedRetainedDataPolicySchema =
  typeof HostedRetainedDataPolicySchema.Type;
