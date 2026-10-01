'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { StewardSelect } from '@/components/decisions/StewardSelect';

import { StepHeading } from '../StepHeading';
import { MAX_PROCESS_NAME_LENGTH, MIN_PROCESS_NAME_LENGTH } from '../content';

const NAME_ID = 'process-name';
const NAME_HINT_ID = 'process-name-hint';

export function NameAccessStep({
  name,
  onNameChange,
  stewardProfileId,
  onStewardChange,
  onSubmit,
}: {
  name: string;
  onNameChange: (name: string) => void;
  stewardProfileId: string;
  onStewardChange: (profileId: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations('decisions.createWizard');
  const tDecisions = useTranslations('decisions');
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

      {/* A failed fetch drops only this field; the steward stays the default. */}
      <APIErrorBoundary fallbacks={{ default: () => null }}>
        <Suspense fallback={<StewardSelectSkeleton />}>
          <StewardSelect
            stewardProfileId={stewardProfileId}
            onSelectionChange={onStewardChange}
            label={tDecisions('stewardedByLabel')}
            description={t('shownProcessPageWhoRunning')}
          />
        </Suspense>
      </APIErrorBoundary>
    </div>
  );
}

function StewardSelectSkeleton() {
  return (
    <Field>
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-11 w-full" />
    </Field>
  );
}
