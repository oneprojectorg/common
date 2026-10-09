'use client';

import {
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common/client';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';

import { useTranslations } from '@/lib/i18n';

import { StepHeading } from '../StepHeading';

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
  const isNameTooShort = trimmed.length < PROCESS_NAME_MIN_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title={t('nameHeading')} />

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
            maxLength={PROCESS_NAME_MAX_LENGTH}
            aria-invalid={trimmed.length > 0 && isNameTooShort}
            aria-describedby={NAME_HINT_ID}
          />
          <FieldDescription id={NAME_HINT_ID} aria-live="polite">
            {isNameTooShort
              ? t('nameTooShort', { count: PROCESS_NAME_MIN_LENGTH })
              : null}
          </FieldDescription>
        </Field>
      </form>
    </div>
  );
}
