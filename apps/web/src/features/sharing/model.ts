import type {
  Membership,
  PrincipalRef,
  SharingSuccess,
} from "@zoen/contracts/sharing/operations";

export interface AccessTarget {
  readonly principalRef: PrincipalRef;
  readonly membership: Membership | null;
}
export interface SharingState {
  readonly target: AccessTarget | null;
  readonly confirmation: "grant" | "revoke" | null;
  readonly receipt: Extract<
    SharingSuccess,
    { readonly receiptRef: string }
  > | null;
  readonly stale: boolean;
}
export const emptySharing: SharingState = {
  confirmation: null,
  receipt: null,
  stale: false,
  target: null,
};

export const audience =
  "A leitura inclui todas as claims e evidências deste espaço, atuais e futuras. Não inclui sessões, credenciais, lista de membros, recibos de outros autores, Questions, Frames ou correções privadas do proprietário.";
