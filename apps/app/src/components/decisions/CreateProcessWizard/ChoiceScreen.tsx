'use client';

import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Callout } from './Callout';
import { ChoiceList } from './ChoiceList';
import { StepHeading } from './StepHeading';
import type { ChoiceScreen as ChoiceRow, WizardAnswers } from './flow';

interface ChoiceScreenProps {
  screen: ChoiceRow;
  answers: WizardAnswers;
  onAnswer: (patch: Partial<WizardAnswers>) => void;
}

/** Renders any screen answered by picking one option, from its row in the screen table. */
export function ChoiceScreen({ screen, answers, onAnswer }: ChoiceScreenProps) {
  const t = useTranslations('decisions.createWizard');
  const description = screen.description?.(answers);

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title={t(screen.heading(answers))}
        description={description ? t(description) : undefined}
      />
      <ChoiceList
        idPrefix={screen.id}
        options={screen.options(answers)}
        value={screen.chosen(answers)}
        onChange={(key) => onAnswer(screen.choose(key, answers))}
        renderDetail={
          screen.id === 'subject'
            ? (key) =>
                key === 'else' ? (
                  <SubjectElseField answers={answers} onAnswer={onAnswer} />
                ) : null
            : undefined
        }
      />
      {screen.id === 'cadence' ? <CadenceNotice answers={answers} /> : null}
    </div>
  );
}

const ELSE_TEXT_ID = 'other-subject-else-text';

function SubjectElseField({
  answers: { subject },
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
        value={subject?.kind === 'else' ? subject.text : ''}
        onChange={(event) =>
          onAnswer({ subject: { kind: 'else', text: event.target.value } })
        }
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
