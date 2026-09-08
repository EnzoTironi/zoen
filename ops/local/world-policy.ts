/**
 * Local provision World data-policy selection (EX34 / EX39).
 * Default remains worlds-local-retained-v1. Erasable and hosted retained are
 * explicit NEW-install choices only — never rebound onto existing Worlds.
 */

export type LocalWorldPolicyId =
  | "worlds-local-retained-v1"
  | "worlds-local-erasable-v1"
  | "worlds-hosted-retained-v1"
  | "worlds-hosted-erasable-v1";

export interface LocalWorldPolicy {
  readonly dataScope: "admitted-non-sensitive";
  readonly enabledRealm: "live";
  readonly erasure: boolean;
  readonly legalHold: false;
  readonly licensedExpiry: false;
  readonly profileId: LocalWorldPolicyId;
  readonly restoreAfterErasure: false;
  readonly retention: "while-pinned";
}

const RETAINED: LocalWorldPolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
};

const ERASABLE: LocalWorldPolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
};

/** Candidate hosted retained (freeze H01–H02); local compose stand-in only. */
const HOSTED_RETAINED: LocalWorldPolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-hosted-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
};

/**
 * Hosted erasable (ZA-14 / H-02): NEW installs only. Bootstrap/admission still
 * refuse legacy zoen and retained bucket reuse; Full hosted Erased stays gated.
 */
const HOSTED_ERASABLE: LocalWorldPolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-hosted-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
};

const BY_ID: Record<LocalWorldPolicyId, LocalWorldPolicy> = {
  "worlds-hosted-erasable-v1": HOSTED_ERASABLE,
  "worlds-hosted-retained-v1": HOSTED_RETAINED,
  "worlds-local-erasable-v1": ERASABLE,
  "worlds-local-retained-v1": RETAINED,
};

export const LOCAL_WORLD_POLICY_IDS: readonly LocalWorldPolicyId[] = [
  "worlds-local-retained-v1",
  "worlds-local-erasable-v1",
  "worlds-hosted-retained-v1",
  "worlds-hosted-erasable-v1",
];

export const isLocalWorldPolicyId = (
  value: string
): value is LocalWorldPolicyId =>
  value === "worlds-local-retained-v1" ||
  value === "worlds-local-erasable-v1" ||
  value === "worlds-hosted-retained-v1" ||
  value === "worlds-hosted-erasable-v1";

/** Resolve install policy; null when the id is not an admitted local profile. */
export const resolveLocalWorldPolicy = (
  worldPolicy: string
): LocalWorldPolicy | null => {
  if (!isLocalWorldPolicyId(worldPolicy)) {
    return null;
  }
  return BY_ID[worldPolicy];
};
