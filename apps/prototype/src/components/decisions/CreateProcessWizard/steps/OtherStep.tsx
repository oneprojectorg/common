'use client';

import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CheckList, ChoiceList } from '../ChoiceList';
import { StepHeading } from '../StepHeading';
import {
  CADENCE_OPTIONS,
  DECISION_OPTIONS,
  SUBJECT_OPTIONS,
  SUBMIT_HEADING,
  SUBMIT_OPTIONS,
  activeSubject,
  type OtherAnswers,
  type OtherStep as OtherStepKey,
  type Subject,
} from '../otherFlow';
import type { Choice } from '../types';

const ELSE_TEXT_ID = 'other-subject-else-text';

/**
 * Step 3 for the "other process" pathway — four plain-language questions, plus
 * an interstitial when someone is trying to run more than one thing at once.
 * Only one screen is rendered at a time; the shell drives which.
 */
export function OtherStep({
  step,
  answers,
  onChange,
}: {
  step: OtherStepKey;
  answers: OtherAnswers;
  onChange: (patch: Partial<OtherAnswers>) => void;
}) {
  const t = useTranslations();

  if (step === 'subjects') {
    return (
      <div className="flex flex-col gap-6">
        <StepHeading
          title={t('What are you deciding?')}
          description={t('Pick everything that applies.')}
        />
        <CheckList
          idPrefix="other-subject"
          options={SUBJECT_OPTIONS}
          values={answers.subjects}
          onToggle={(key) => {
            const next = answers.subjects.includes(key)
              ? answers.subjects.filter((subject) => subject !== key)
              : [...answers.subjects, key];

            onChange({
              subjects: next,
              // Keep the follow-ups honest when the set changes underneath them.
              focus:
                answers.focus && next.includes(answers.focus)
                  ? answers.focus
                  : null,
              submits: null,
              elseText: next.includes('else') ? answers.elseText : '',
            });
          }}
          renderDetail={(key) =>
            key === 'else' ? (
              <Field className="ps-6">
                {/* The box's own copy is the visible prompt; the label is here
                    so the field still has a programmatic one. */}
                <FieldLabel htmlFor={ELSE_TEXT_ID} className="sr-only">
                  {t('What are you deciding on?')}
                </FieldLabel>
                <Input
                  id={ELSE_TEXT_ID}
                  value={answers.elseText}
                  onChange={(event) =>
                    onChange({ elseText: event.target.value })
                  }
                  placeholder={t('e.g. which venue we use next year')}
                />
              </Field>
            ) : null
          }
        />
      </div>
    );
  }

  if (step === 'cadence') {
    return (
      <div className="flex flex-col gap-6">
        <StepHeading
          title={t('Does this process have an end, or is it always open?')}
        />
        <ChoiceList
          idPrefix="other-cadence"
          options={CADENCE_OPTIONS}
          value={answers.cadence}
          onChange={(key) =>
            onChange({
              cadence: key,
              // An always-open space covers everything they picked, so there is
              // nothing to choose between — drop any focus already set.
              ...(key === 'ongoing' ? { focus: null, submits: null } : {}),
            })
          }
        />
        {/* Always-open isn't a dead end — it's a different setup, described
            here so the rest of the questions make sense in that light. */}
        <div aria-live="polite">
          {answers.cadence === 'ongoing' ? (
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-accent p-4">
              <LuInfo
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <p className="text-sm text-foreground">
                {t(
                  "Common runs on stages, but plenty of groups do ongoing decision-making with a simple setup: one intake that stays open, just for your group. Members post what they're proposing, and others weigh in with comments and likes to show support. We'll set that up.",
                )}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (step === 'focus') {
    const picked: Choice<Subject>[] = SUBJECT_OPTIONS.filter((option) =>
      answers.subjects.includes(option.key),
    ).map((option) =>
      option.key === 'else' && answers.elseText.trim()
        ? { key: option.key, label: option.label }
        : option,
    );

    return (
      <div className="flex flex-col gap-6">
        <StepHeading
          title={t(
            'Common currently supports one decision per process. Which decision would you like to set up?',
          )}
        />
        <ChoiceList
          idPrefix="other-focus"
          options={picked}
          value={answers.focus}
          onChange={(key) => onChange({ focus: key, submits: null })}
        />
      </div>
    );
  }

  if (step === 'submits') {
    const subject = activeSubject(answers);

    return (
      <div className="flex flex-col gap-6">
        <StepHeading
          title={t(SUBMIT_HEADING[subject])}
          description={
            answers.cadence === 'ongoing'
              ? t('This is what members post when something comes up.')
              : undefined
          }
        />
        <ChoiceList
          idPrefix="other-submits"
          options={SUBMIT_OPTIONS[subject]}
          value={answers.submits}
          onChange={(key) => onChange({ submits: key })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t('How does the decision get made?')}
        description={
          answers.cadence === 'ongoing'
            ? t('For the things members post.')
            : undefined
        }
      />
      <ChoiceList
        idPrefix="other-decision"
        options={DECISION_OPTIONS}
        value={answers.decision}
        onChange={(key) => onChange({ decision: key })}
      />
    </div>
  );
}
