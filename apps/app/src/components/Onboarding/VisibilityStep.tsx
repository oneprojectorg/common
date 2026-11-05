'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { Field, FieldError, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { type ReactNode, useId, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import type { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export const MAX_FULL_NAME_LENGTH = 200;

export const validator = z
  .object({
    mode: z.enum(['name', 'anonymous']),
    fullName: z.string().trim().max(MAX_FULL_NAME_LENGTH).optional(),
  })
  .refine((v) => v.mode === 'anonymous' || Boolean(v.fullName?.trim()), {
    path: ['fullName'],
  });

export const fullNameIssue = (value: string): 'required' | 'tooLong' | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'required';
  }
  if (trimmed.length > MAX_FULL_NAME_LENGTH) {
    return 'tooLong';
  }
  return null;
};

export const parseParticipantNumber = (profileName: string): string | null => {
  const match = /^Participant (\d+)$/.exec(profileName);
  return match?.[1] ?? null;
};

export const VisibilityStep = ({ onNext }: StepProps): ReactNode => {
  const t = useTranslations();
  const tSettings = useTranslations('settings');
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const personalDetails = useOnboardingFormStore((s) => s.personalDetails);
  const setPersonalDetails = useOnboardingFormStore(
    (s) => s.setPersonalDetails,
  );

  const nameOptionId = useId();
  const anonymousOptionId = useId();
  const nameFieldId = useId();

  const [mode, setMode] = useState<'name' | 'anonymous'>(
    personalDetails?.mode === 'anonymous' ? 'anonymous' : 'name',
  );
  const [fullName, setFullName] = useState<string>(
    personalDetails?.fullName ?? '',
  );
  const [nameError, setNameError] = useState<string | undefined>();

  const profileName = userAccount?.profile?.name ?? '';
  const participantNumber = parseParticipantNumber(profileName) ?? profileName;

  // <bdi>: the interpolated value is "Participant <n>" today, but the
  // fallback is the raw profile name — user-authored text, which must be
  // bidi-isolated inside an RTL paragraph.
  const strong = (chunks: ReactNode) => (
    <span className="font-strong text-foreground">
      <bdi>{chunks}</bdi>
    </span>
  );

  const submit = () => {
    if (mode === 'name') {
      const issue = fullNameIssue(fullName);
      if (issue) {
        setNameError(
          issue === 'required'
            ? t('onboarding.fullNameRequired')
            : t('onboarding.fullNameTooLong'),
        );
        return;
      }
    }
    const trimmed = fullName.trim();
    const value = { mode, fullName: mode === 'name' ? trimmed : undefined };
    setPersonalDetails(value);
    onNext(value);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <FormContainer className="max-w-lg">
        <FormHeader text={t('onboarding.visibilityTitle')}>
          {t('onboarding.visibilitySubtitle')}
        </FormHeader>

        <RadioGroup
          value={mode}
          onValueChange={(value) => {
            if (value === 'name' || value === 'anonymous') {
              setMode(value);
              setNameError(undefined);
            }
          }}
          aria-label={t('onboarding.visibilityTitle')}
          className="gap-4"
        >
          <OptionBox
            htmlFor={nameOptionId}
            control={<RadioGroupItem id={nameOptionId} value="name" />}
            label={tSettings('showNameOption')}
            description={tSettings('showNameHint')}
            className="rounded-xl p-4"
          />
          {/* Inside the radiogroup on purpose: this field is a disclosure of
              the "Show my name" radio, so the focus order (radio → its field →
              next radio) matters more than the letter of the owned-elements
              table; axe accepts extra non-radio children in a radiogroup. */}
          {mode === 'name' ? (
            <Field className="ps-10">
              <FieldLabel htmlFor={nameFieldId}>
                {t('onboarding.fullNameLabel')}
              </FieldLabel>
              <Input
                id={nameFieldId}
                value={fullName}
                placeholder={t('onboarding.fullNamePlaceholder')}
                autoComplete="name"
                aria-invalid={nameError ? true : undefined}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setNameError(undefined);
                }}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
          ) : null}
          <OptionBox
            htmlFor={anonymousOptionId}
            control={
              <RadioGroupItem id={anonymousOptionId} value="anonymous" />
            }
            label={tSettings('stayAnonymousOption')}
            description={tSettings.rich('stayAnonymousHint', {
              number: participantNumber,
              strong,
            })}
            className="rounded-xl p-4"
          />
        </RadioGroup>

        <Button type="submit" className="w-full">
          {t('Continue')}
        </Button>
      </FormContainer>
    </form>
  );
};
