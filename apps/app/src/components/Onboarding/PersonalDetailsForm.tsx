import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import type { StepProps } from '../form/utils';

export const getValidator = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    fullName: z
      .string()
      .min(1, {
        message: t('onboarding.personalDetails.validation.enterFullName'),
      })
      .max(20, {
        message: t('onboarding.personalDetails.validation.max20Chars'),
      }),
    title: z
      .string()
      .min(1, {
        message: t('onboarding.personalDetails.validation.enterTitle'),
      })
      .max(20, {
        message: t('onboarding.personalDetails.validation.max20Chars'),
      }),
    profileImageUrl: z.string().optional(),
  });

type FormFields = z.infer<ReturnType<typeof getValidator>>;

export const PersonalDetailsForm = ({
  defaultValues,
  resolver,
  className,
}: StepProps & { className?: string }) => {
  const t = useTranslations();
  const locale = useLocale();
  console.log('LOCLE', locale);
  const uploadImage = trpc.account.uploadImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();

  const { onNext } = useMultiStep();
  // If a resolver is provided, use it; otherwise, use the localized validator
  const validatorInstance = getValidator(t);
  const form = useAppForm({
    defaultValues: defaultValues as FormFields,
    validators: {
      onChange: resolver ? resolver : validatorInstance,
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: (value as FormFields).fullName,
        title: (value as FormFields).title,
      });

      onNext(value as FormFields);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer>
        <FormHeader text={t('onboarding.personalDetails.header')}>
          {t('onboarding.personalDetails.subheader')}
        </FormHeader>
        <AvatarUploader
          label={t('onboarding.personalDetails.profilePicture')}
          value={profileImageUrl ?? undefined}
          onChange={async (file: File): Promise<void> => {
            const reader = new FileReader();

            reader.onload = async (e) => {
              const base64 = (e.target?.result as string)?.split(',')[1];

              if (!base64) {
                return;
              }

              const dataUrl = `data:${file.type};base64,${base64}`;

              setProfileImageUrl(dataUrl);

              const res = await uploadImage.mutateAsync({
                file: base64,
                fileName: file.name,
                mimeType: file.type,
              });

              if (res?.url) {
                setProfileImageUrl(res.url);
              }
            };

            reader.readAsDataURL(file);
          }}
          uploading={uploadImage.isPending}
          error={uploadImage.error?.message || undefined}
        />
        <form.AppField
          name="fullName"
          children={(field) => (
            <field.TextField
              label={t('onboarding.personalDetails.fullName')}
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('onboarding.personalDetails.enterFullName'),
              }}
            />
          )}
        />
        <form.AppField
          name="title"
          children={(field) => (
            <field.TextField
              label={t('onboarding.personalDetails.professionalTitle')}
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('onboarding.personalDetails.enterTitle'),
              }}
            />
          )}
        />

        <form.SubmitButton className="sm:w-full">
          {updateProfile.isPending || uploadImage.isPending ? (
            <LoadingSpinner />
          ) : (
            t('onboarding.personalDetails.continue')
          )}
        </form.SubmitButton>
      </FormContainer>
    </form>
  );
};
