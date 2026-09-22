'use client';

import { useTranslations } from '@/lib/i18n';

import { ChoiceList } from '../ChoiceList';
import { StepHeading } from '../StepHeading';
import {
  GRANT_DECISION_QUESTION,
  SHAPE_QUESTION,
  type GrantDecision,
} from '../content';
import type { ProcessType, ShapeKey } from '../types';

/** Step 3 — the one shape question for a grantmaking or budgeting process. */
export function ShapeStep({
  type,
  value,
  onChange,
}: {
  type: ProcessType;
  value: ShapeKey | null;
  onChange: (shape: ShapeKey) => void;
}) {
  const t = useTranslations('decisions.createWizard');
  const question = SHAPE_QUESTION[type];

  if (!question) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t(question.heading)} />
      <ChoiceList
        idPrefix="process-shape"
        options={question.options}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

/** Grantmaking only — who makes the funding call; it changes the phases. */
export function GrantDecisionStep({
  value,
  onChange,
}: {
  value: GrantDecision | null;
  onChange: (decision: GrantDecision) => void;
}) {
  const t = useTranslations('decisions.createWizard');

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t(GRANT_DECISION_QUESTION.heading)} />
      <ChoiceList
        idPrefix="grant-decision"
        options={GRANT_DECISION_QUESTION.options}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
