'use client';

import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Callout } from '../Callout';
import { ChoiceList } from '../ChoiceList';
import { StepHeading } from '../StepHeading';
import type { ScreenId } from '../flow';
import {
  CADENCE_OPTIONS,
  DECISION_OPTIONS,
  SUBJECT_OPTIONS,
  SUBMIT_HEADING,
  SUBMIT_OPTIONS,
  type OtherAnswers,
} from '../otherContent';

export type OtherScreenId = Extract<
  ScreenId,
  'subject' | 'cadence' | 'submits' | 'decision'
>;

const ELSE_TEXT_ID = 'other-subject-else-text';

export function OtherStep({
  screen,
  answers,
  onChange,
}: {
  screen: OtherScreenId;
  answers: OtherAnswers;
  onChange: (patch: Partial<OtherAnswers>) => void;
}) {
  const t = useTranslations('decisions.createWizard');
  const { subject } = answers;

  switch (screen) {
    case 'subject':
      return (
        <div className="flex flex-col gap-6">
          <StepHeading
            title={t('subjectHeading')}
            description={t('subjectDescription')}
          />
          <ChoiceList
            idPrefix="other-subject"
            options={SUBJECT_OPTIONS}
            value={subject?.kind ?? null}
            onChange={(kind) =>
              onChange({
                subject:
                  kind === 'else'
                    ? {
                        kind,
                        text: subject?.kind === 'else' ? subject.text : '',
                      }
                    : { kind },
              })
            }
            renderDetail={(kind) =>
              kind === 'else' ? (
                <Field className="ps-6">
                  <FieldLabel htmlFor={ELSE_TEXT_ID} className="sr-only">
                    {t('elseTextLabel')}
                  </FieldLabel>
                  <Input
                    id={ELSE_TEXT_ID}
                    value={subject?.kind === 'else' ? subject.text : ''}
                    onChange={(event) =>
                      onChange({
                        subject: { kind: 'else', text: event.target.value },
                      })
                    }
                    placeholder={t('elseTextPlaceholder')}
                  />
                </Field>
              ) : null
            }
          />
        </div>
      );
    case 'cadence':
      return (
        <div className="flex flex-col gap-6">
          <StepHeading title={t('cadenceHeading')} />
          <ChoiceList
            idPrefix="other-cadence"
            options={CADENCE_OPTIONS}
            value={answers.cadence}
            onChange={(cadence) => onChange({ cadence })}
          />
          <div aria-live="polite">
            {answers.cadence === 'ongoing' ? (
              <Callout icon={LuInfo}>{t('cadenceOngoingCallout')}</Callout>
            ) : null}
          </div>
        </div>
      );
    case 'submits': {
      const kind = subject?.kind ?? 'else';

      return (
        <div className="flex flex-col gap-6">
          <StepHeading
            title={t(SUBMIT_HEADING[kind])}
            description={
              answers.cadence === 'ongoing'
                ? t('submitsOngoingDescription')
                : undefined
            }
          />
          <ChoiceList
            idPrefix="other-submits"
            options={SUBMIT_OPTIONS[kind]}
            value={answers.submits}
            onChange={(submits) => onChange({ submits })}
          />
        </div>
      );
    }
    case 'decision':
      return (
        <div className="flex flex-col gap-6">
          <StepHeading
            title={t('decisionHeading')}
            description={
              answers.cadence === 'ongoing'
                ? t('decisionOngoingDescription')
                : undefined
            }
          />
          <ChoiceList
            idPrefix="other-decision"
            options={DECISION_OPTIONS}
            value={answers.decision}
            onChange={(decision) => onChange({ decision })}
          />
        </div>
      );
  }
}
