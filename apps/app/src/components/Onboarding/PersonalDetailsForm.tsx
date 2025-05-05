import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ReactNode, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';

export const validator = z.object({
  fullName: z
    .string()
    .min(1, {
      message: 'Enter your full name',
    })
    .max(20, {
      message: 'Must be at most 20 characters',
    }),
  title: z
    .string()
    .min(1, {
      message: 'Enter your professional title',
    })
    .max(20, {
      message: 'Must be at most 20 characters',
    }),
  profileImageUrl: z.string().optional(),
});

type FormFields = z.infer<typeof validator>;

export const PersonalDetailsForm = ({
  onNext,
  className,
}: StepProps & { className?: string }): ReactNode => {
  const t = useTranslations();
  const uploadImage = trpc.account.uploadImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();

  // If a resolver is provided, use it; otherwise, use the localized validator
  const form = useAppForm({
    // defaultValues: defaultValues as FormFields,
    validators: {
      onChange: validator,
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
        <FormHeader text={t('Add your personal details')}>
          {t('Tell us about yourself so others can find you.')}
        </FormHeader>
        <div className="flex items-center justify-center">
          <AvatarUploader
            label={t('Profile Picture')}
            value={profileImageUrl ?? undefined}
            className="size-32"
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
        </div>
        <form.AppField
          name="fullName"
          children={(field) => (
            <field.TextField
              label={t('Full Name')}
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Enter your full name'),
              }}
            />
          )}
        />
        <form.AppField
          name="title"
          children={(field) => (
            <field.TextField
              label={t('Professional title')}
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Enter your professional title'),
              }}
            />
          )}
        />

        <form.SubmitButton className="sm:w-full">
          {updateProfile.isPending || uploadImage.isPending ? (
            <LoadingSpinner />
          ) : (
            t('Continue')
          )}
        </form.SubmitButton>
      </FormContainer>
    </form>
  );
};
