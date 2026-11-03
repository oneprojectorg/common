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

export const validator = z
  .object({
    mode: z.enum(['name', 'anonymous']),
    fullName: z.string().trim().max(200).optional(),
  })
  .refine((v) => v.mode === 'anonymous' || Boolean(v.fullName?.trim()), {
    path: ['fullName'],
  });

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
  const utils = trpc.useUtils();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const profileName = userAccount?.profile?.name ?? '';
  const participantNumber = parseParticipantNumber(profileName) ?? profileName;

  const strong = (chunks: ReactNode) => (
    <span className="font-strong text-foreground">{chunks}</span>
  );

  const submit = async () => {
    if (isSubmitting) {
      return;
    }
    const trimmed = fullName.trim();
    if (mode === 'name' && !trimmed) {
      setNameError(t('onboarding.fullNameRequired'));
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === 'name') {
        await updateProfile.mutateAsync({ name: trimmed });
        await Promise.all([
          utils.account.getMyAccount.invalidate(),
          utils.account.getUserProfiles.invalidate(),
        ]);
      }
      const value = { mode, fullName: mode === 'name' ? trimmed : undefined };
      setPersonalDetails(value);
      onNext(value);
    } catch {
      setNameError(t("That didn't work"));
      setIsSubmitting(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
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
                disabled={isSubmitting}
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {t('Continue')}
        </Button>
      </FormContainer>
    </form>
  );
};
