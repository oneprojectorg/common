import type { PhaseKind, ProcessType } from '@op/common/client';
import type { MessageKeys, Messages, NestedKeyOf } from 'next-intl';

type WizardMessages = Messages['decisions']['createWizard'];

export type WizardCopyKey = MessageKeys<
  WizardMessages,
  NestedKeyOf<WizardMessages>
>;

export type GrantShape = 'single' | 'loi';

export type PbShape = 'ideas' | 'proposals';

/** The other pathway composes its phases from its questions instead of a shape. */
export type ShapeKey = GrantShape | PbShape;

export type GrantDecision = 'rubric' | 'applicants' | 'hybrid';

export type Subject = 'funding' | 'ideas' | 'people' | 'else';

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
  subject: Subject | null;
  /** Something else, in the creator's own words. */
  subjectText: string;
  cadence: Cadence | null;
  submits: SubmitKey | null;
  decision: Decision | null;
  name: string;
}

export interface WizardPhase {
  /** The pitch while choosing; `phaseName` is the timeline label. */
  name: WizardCopyKey;
  phaseName: WizardCopyKey;
  kind: PhaseKind;
  description?: WizardCopyKey;
  capabilities: WizardCopyKey[];
  norm?: WizardCopyKey;
}

export interface Choice<K extends string> {
  key: K;
  label: WizardCopyKey;
  description?: WizardCopyKey;
}
