/** Display-only props. EX12 maps authorized semantic results into this view. */
export interface SourceCard {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly value: string;
  readonly description: string;
}

export interface EvidencePanel {
  readonly sourceName: string;
  readonly location: string;
  readonly excerpt: string;
  readonly retainedAt: string;
}

export interface InspectionView {
  /** Local presentation identity; change to discard drafts when displayed context changes. */
  readonly interactionKey: string;
  readonly title: string;
  readonly explanation: string;
  readonly statusLabel: string;
  readonly verificationLabel: string;
  readonly scope: string;
  readonly basisLabel: string;
  readonly coverageLabel: string;
  readonly sources: readonly SourceCard[];
  readonly evidence?: EvidencePanel;
}

export type WorkspaceView =
  | { readonly kind: "empty" }
  | { readonly kind: "uploading"; readonly message: string }
  | { readonly kind: "inspection"; readonly inspection: InspectionView }
  | { readonly kind: "denied" }
  | { readonly kind: "unavailable" };

export interface CorrectionDraft {
  readonly answer: string;
  readonly explanation: string;
}

export interface WorldsWorkspaceProps {
  readonly readOnly?: boolean;
  readonly view: WorkspaceView;
  readonly acceptedFileTypes: string;
  readonly fileHelp: string;
  readonly onFilesSelected: (files: readonly File[]) => void;
  readonly onLogout: () => void;
  readonly onInspectEvidence: (sourceId: string) => void;
  readonly onCorrection?: (draft: CorrectionDraft) => void;
  readonly onUnknown?: () => void;
  readonly onUndo?: () => void;
  readonly onRetry?: () => void;
  readonly actionPending?: boolean;
  readonly feedback?: string;
}
