import type { MessageKeys, Messages, NestedKeyOf } from 'next-intl';

type WizardMessages = Messages['decisions']['createWizard'];

export type WizardCopyKey = MessageKeys<
  WizardMessages,
  NestedKeyOf<WizardMessages>
>;

export type ProcessType = 'grant' | 'pb' | 'other';

export type GrantShape = 'single' | 'loi';

export type PbShape = 'ideas' | 'proposals';

/** `custom` composes its mapping from the "other" questions; `blank` builds no phases. */
export type OtherShape = 'custom' | 'blank';

export type ShapeKey = GrantShape | PbShape | OtherShape;

export type GrantDecision = 'rubric' | 'applicants' | 'hybrid';

export type Subject = 'funding' | 'ideas' | 'people' | 'else';

/** Something else is named in the creator's own words. */
export type SubjectAnswer =
  | { kind: Exclude<Subject, 'else'> }
  | { kind: 'else'; text: string };

export type Cadence = 'timeline' | 'ongoing';

export type SubmitKey =
  | 'applications'
  | 'proposals'
  | 'rough'
  | 'nominations'
  | 'none';

export type Decision = 'vote' | 'review' | 'both' | 'agree';

export interface WizardAnswers {
  type: ProcessType | null;
  shape: ShapeKey | null;
  grantDecision: GrantDecision | null;
  subject: SubjectAnswer | null;
  cadence: Cadence | null;
  submits: SubmitKey | null;
  decision: Decision | null;
  name: string;
}

export type PhaseType = 'submissions' | 'review' | 'voting' | 'results';

export interface ProcessPiece {
  /** The pitch while choosing; `phaseName` is the timeline label. */
  name: WizardCopyKey;
  phaseName?: WizardCopyKey;
  phaseType: PhaseType;
  description?: WizardCopyKey;
  capabilities: WizardCopyKey[];
  norm?: WizardCopyKey;
}

export interface ProcessDraft {
  type: ProcessType;
  shape: ShapeKey;
  name: string;
  stewardProfileId: string;
  pieces: ProcessPiece[];
}

export interface Choice<K extends string> {
  key: K;
  label: WizardCopyKey;
  description?: WizardCopyKey;
}
