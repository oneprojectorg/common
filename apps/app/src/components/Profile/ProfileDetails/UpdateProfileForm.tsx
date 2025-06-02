import { getPublicUrl } from '@/utils';
import { OrganizationUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import { ReactNode, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';

export const validator = z.object({
  fullName: z
    .string({ message: 'Enter your full name' })
    .trim()
    .min(1, {
      message: 'Enter your full name',
    })
    .max(200, {
      message: 'Must be at most 200 characters',
    }),
  title: z
    .string({
      message: 'Enter your professional title',
    })
    .trim()
    .min(1, {
      message: 'Enter your professional title',
    })
    .max(200, {
      message: 'Must be at most 200 characters',
    }),
});

type FormFields = z.infer<typeof validator>;

interface UpdateProfileFormProps {
  profile: OrganizationUser;
  onSuccess: () => void;
  className?: string;
}

export const UpdateProfileForm = ({
  profile,
  onSuccess,
  className,
}: UpdateProfileFormProps): ReactNode => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const uploadImage = trpc.account.uploadImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();

  // Initialize with current profile data
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(
    getPublicUrl(profile.avatarImage?.name) || undefined,
  );

  const form = useAppForm({
    defaultValues: {
      fullName: profile.name ?? '',
      title: profile.title ?? '',
    },
    validators: {
      onSubmit: validator,
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: value.fullName,
        title: value.title,
      });
      utils.account.getMyAccount.invalidate();
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormContainer className={className}>
        <div className="flex items-center justify-center">
          <AvatarUploader
            label={t('Profile Picture')}
            value={profileImageUrl ?? undefined}
            className="min-w-32"
            onChange={async (file: File): Promise<void> => {
              const reader = new FileReader();

              reader.onload = async (e) => {
                const base64 = (e.target?.result as string)?.split(',')[1];

                if (!base64) {
                  return;
                }

                const dataUrl = `data:${file.type};base64,${base64}`;

                setProfileImageUrl(dataUrl);

                const res = await uploadImage.mutateAsync(
                  {
                    file: base64,
                    fileName: file.name,
                    mimeType: file.type,
                  },
                  {
                    onSuccess: () => {
                      utils.account.getMyAccount.invalidate();
                    },
                  },
                );

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
              value={field.state.value || ''}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: t('Enter your professional title'),
              }}
            />
          )}
        />
      </FormContainer>
      <ModalFooter>
        <form.SubmitButton className="sm:w-auto">
          {updateProfile.isPending || uploadImage.isPending ? (
            <LoadingSpinner />
          ) : (
            t('Save')
          )}
        </form.SubmitButton>
      </ModalFooter>
    </form>
  );
};
