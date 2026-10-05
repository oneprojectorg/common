'use client';

import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';
import { MAX_PROCESS_NAME_LENGTH, MIN_PROCESS_NAME_LENGTH } from '../content';

const NAME_ID = 'process-name';
const NAME_HINT_ID = 'process-name-hint';

export function NameAccessStep({
  name,
  onNameChange,
  onSubmit,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations('decisions.createWizard');
  const trimmed = name.trim();
  const isNameTooShort = trimmed.length < MIN_PROCESS_NAME_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t('nameHeading')} />

      {/* Enter in a form's only text field submits it. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Field>
          <FieldLabel htmlFor={NAME_ID}>{t('nameLabel')}</FieldLabel>
          <Input
            id={NAME_ID}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={MAX_PROCESS_NAME_LENGTH}
            aria-invalid={trimmed.length > 0 && isNameTooShort}
            aria-describedby={NAME_HINT_ID}
          />
          <FieldDescription id={NAME_HINT_ID} aria-live="polite">
            {isNameTooShort
              ? t('nameTooShort', { count: MIN_PROCESS_NAME_LENGTH })
              : null}
          </FieldDescription>
        </Field>
      </form>
    </div>
  );
}
