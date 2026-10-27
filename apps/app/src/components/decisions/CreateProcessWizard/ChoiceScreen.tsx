'use client';

import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Callout } from './Callout';
import { STEP_HEADING_ID, StepHeading } from './StepHeading';
import {
  type ChoiceScreen as ChoiceRow,
  type WizardAnswers,
  chooseOption,
  chosenOption,
} from './flow';

interface ChoiceScreenProps {
  screen: ChoiceRow;
  answers: WizardAnswers;
  onAnswer: (patch: Partial<WizardAnswers>) => void;
}

/** Renders any screen answered by picking one option, from its row in the screen table. */
export function ChoiceScreen({ screen, answers, onAnswer }: ChoiceScreenProps) {
  const t = useTranslations('decisions.createWizard');
  const description = screen.description?.(answers);
  const value = chosenOption(screen, answers);

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t(screen.heading(answers))}
        description={description ? t(description) : undefined}
      />
      <RadioGroup
        aria-labelledby={STEP_HEADING_ID}
        value={value}
        onValueChange={(next) => {
          // The reducer settles a key that was not offered back to null.
          if (typeof next === 'string') {
            onAnswer(chooseOption(screen, next, answers));
          }
        }}
        className="gap-2.5"
      >
        {screen.options(answers).map((option) => {
          const id = `${screen.id}-${option.key}`;

          return (
            <div key={option.key} className="flex flex-col gap-2">
              <OptionBox
                htmlFor={id}
                control={<RadioGroupItem id={id} value={option.key} />}
                label={t(option.label)}
                description={
                  option.description ? t(option.description) : undefined
                }
                className="bg-background"
              />
              {/* A sibling of the box, which is a `<label>`. */}
              {screen.id === 'subject' &&
              option.key === 'else' &&
              value === 'else' ? (
                <SubjectElseField answers={answers} onAnswer={onAnswer} />
              ) : null}
            </div>
          );
        })}
      </RadioGroup>
      {screen.id === 'cadence' ? <CadenceNotice answers={answers} /> : null}
    </div>
  );
}

const ELSE_TEXT_ID = 'other-subject-else-text';

function SubjectElseField({
  answers: { subjectText },
  onAnswer,
}: Omit<ChoiceScreenProps, 'screen'>) {
  const t = useTranslations('decisions.createWizard');

  return (
    <Field className="ps-6">
      <FieldLabel htmlFor={ELSE_TEXT_ID} className="sr-only">
        {t('elseTextLabel')}
      </FieldLabel>
      <Input
        id={ELSE_TEXT_ID}
        value={subjectText}
        onChange={(event) => onAnswer({ subjectText: event.target.value })}
        placeholder={t('elseTextPlaceholder')}
      />
    </Field>
  );
}

function CadenceNotice({ answers }: { answers: WizardAnswers }) {
  const t = useTranslations('decisions.createWizard');

  return (
    <div aria-live="polite">
      {answers.cadence === 'ongoing' ? (
        <Callout icon={LuInfo}>{t('cadenceOngoingCallout')}</Callout>
      ) : null}
    </div>
  );
}
