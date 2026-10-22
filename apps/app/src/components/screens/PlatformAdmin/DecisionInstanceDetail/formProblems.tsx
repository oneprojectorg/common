'use client';

import { FieldError } from '@op/sense/Field';

import {
  type TranslateFn,
  type TranslationKey,
  useTranslations,
} from '@/lib/i18n';

import type { DraftProblem, DraftProblemCode } from './formDefinition';

/** Renders `problems` as the error text under the control they belong to. */
export const ProblemMessages = ({ problems }: { problems: DraftProblem[] }) => {
  const t = useTranslations();

  return (
    <FieldError
      errors={problems.map((problem) => ({
        message: describeProblem(problem, t),
      }))}
    />
  );
};

/** Each code names exactly one control, so a control selects its own
 *  problems by code. */
export const getProblemsWithCode = (
  problems: DraftProblem[],
  ...codes: DraftProblemCode[]
): DraftProblem[] => problems.filter((problem) => codes.includes(problem.code));

/** Keyed, not switched, so a new code is a compile error here. `schema` is
 *  absent on purpose — it carries its own raw detail. */
const PROBLEM_MESSAGES: Record<
  Exclude<DraftProblemCode, 'schema'>,
  TranslationKey
> = {
  'missing-name': 'admin.formInternalNameRequiredError',
  'name-too-long': 'admin.formCharacterLimitError',
  'missing-phase': 'admin.formPhaseRequiredError',
  'missing-title': 'admin.formHeadingRequiredError',
  'title-too-long': 'admin.formCharacterLimitError',
  'description-too-long': 'admin.formCharacterLimitError',
  'no-fields': 'admin.formFieldsRequiredError',
  'too-many-fields': 'admin.formFieldsLimitError',
  'field-missing-question': 'admin.fieldQuestionRequiredError',
  'field-question-too-long': 'admin.formCharacterLimitError',
  'field-description-too-long': 'admin.formCharacterLimitError',
  'field-missing-options': 'admin.fieldOptionsRequiredError',
};

const describeProblem = (problem: DraftProblem, t: TranslateFn): string =>
  problem.code === 'schema'
    ? (problem.detail ?? '')
    : t(PROBLEM_MESSAGES[problem.code], {
        // Only the limit messages read it; the other codes carry no cap.
        max: problem.max ?? 0,
      });
