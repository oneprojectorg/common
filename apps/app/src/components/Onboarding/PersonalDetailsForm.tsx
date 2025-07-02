import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { toast } from '@op/ui/Toast';
import { ReactNode, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormFields = z.infer<typeof validator>;

export const createValidator = (t: (key: string) => string) => z.object({
  fullName: z
    .string({ message: t('Enter your full name') })
    .trim()
    .min(1, {
      message: t('Enter your full name'),
    })
    .max(200, {
      message: t('Must be at most 200 characters'),
    }),
  title: z
    .string({
      message: t('Enter your professional title'),
    })
    .trim()
    .min(1, {
      message: t('Enter your professional title'),
    })
    .max(200, {
      message: t('Must be at most 200 characters'),
    }),
  profileImageUrl: z.string().optional(),
});

// Fallback validator for external use
export const validator = z.object({
  fullName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  profileImageUrl: z.string().optional(),
});
const DEFAULT_MAX_SIZE = 4 * 1024 * 1024; // 4MB

const DEFAULT_ACCEPTED_TYPES = [
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];
const validateFile = (file: File, t: (key: string, params?: any) => string): string | null => {
  if (!DEFAULT_ACCEPTED_TYPES.includes(file.type)) {
    const types = DEFAULT_ACCEPTED_TYPES.map((t) => t.split('/')[1]).join(', ');
    return t('That file type is not supported. Accepted types: {types}', { types });
  }

  if (file.size > DEFAULT_MAX_SIZE) {
    const maxSizeMB = (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(2);
    return t('File too large. Maximum size: {maxSizeMB}MB', { maxSizeMB });
  }
  return null;
};

export const PersonalDetailsForm = ({
  onNext,
  className,
}: StepProps & { className?: string }): ReactNode => {
  const personalDetails = useOnboardingFormStore((s) => s.personalDetails);
  const setPersonalDetails = useOnboardingFormStore(
    (s) => s.setPersonalDetails,
  );
  const t = useTranslations();
  const uploadImage = trpc.account.uploadImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

  // Hydrate profileImageUrl from store if present, else undefined
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(
    personalDetails?.profileImageUrl,
  );

  // Hydrate form from store if present
  const form = useAppForm({
    defaultValues: personalDetails,
    validators: {
      onSubmit: createValidator(t),
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: value.fullName,
        title: value.title,
      });
      setPersonalDetails({ ...value, profileImageUrl }); // Persist to store on submit

      onNext(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        console.log('submit');
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer className="max-w-lg">
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
                const validationError = validateFile(file, t);
                if (validationError) {
                  toast.status({ code: 500, message: validationError });
                  setProfileImageUrl(undefined);

                  throw new Error(validationError);
                }

                const base64 = (e.target?.result as string)?.split(',')[1];

                if (!base64) {
                  return;
                }

                const dataUrl = `data:${file.type};base64,${base64}`;

                setProfileImageUrl(dataUrl);

                const res = await uploadImage
                  .mutateAsync({
                    file: base64,
                    fileName: file.name,
                    mimeType: file.type,
                  })
                  .catch((error) => {
                    toast.status({ code: 500, message: error.message });
                    setProfileImageUrl(undefined);
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
              isRequired
              label={t('Full Name')}
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
              isRequired
              label={t('Professional title')}
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
