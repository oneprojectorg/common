import { SYSTEM_FIELD_KEYS } from '../getProposalTemplateFieldOrder';
import type { PhaseRules } from '../schemas/types';
import { isDevelopPhase, isReviewPhase, isSubmitPhase } from './phaseSettings';

type FieldsTemplate =
  | { properties?: Record<string, unknown> }
  | null
  | undefined;

interface PhaseTemplates {
  proposalTemplate?: FieldsTemplate;
  rubricTemplate?: FieldsTemplate;
}

export function isPhaseReady(
  phase: PhaseTemplates & {
    startDate?: string | null;
    endDate?: string | null;
    rules?: PhaseRules;
  },
  decision: PhaseTemplates,
): boolean {
  if (!phase.startDate || !phase.endDate) {
    return false;
  }

  if (
    isReviewPhase(phase) &&
    !hasFields(phase.rubricTemplate ?? decision.rubricTemplate)
  ) {
    return false;
  }

  if (
    (isSubmitPhase(phase) || isDevelopPhase(phase)) &&
    !hasQuestions(phase.proposalTemplate ?? decision.proposalTemplate)
  ) {
    return false;
  }

  return true;
}

function hasFields(template: FieldsTemplate): boolean {
  return Object.keys(template?.properties ?? {}).length > 0;
}

function hasQuestions(template: FieldsTemplate): boolean {
  return Object.keys(template?.properties ?? {}).some(
    (key) => !SYSTEM_FIELD_KEYS.has(key),
  );
}
