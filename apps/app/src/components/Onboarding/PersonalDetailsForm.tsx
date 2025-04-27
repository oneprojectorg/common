import { useState } from 'react';
import { LuLoaderCircle } from 'react-icons/lu';
import { z } from 'zod';

import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';

import type { StepProps } from '../form/utils';

export const validator = z.object({
  fullName: z
    .string()
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  title: z
    .string()
    .min(1, { message: 'Enter a title' })
    .max(20, { message: 'Must be at most 20 characters' }),
  profileImageUrl: z.string().optional(),
});

type FormFields = z.infer<typeof validator>;

export const PersonalDetailsForm = ({
  defaultValues,
  resolver,
  className,
}: StepProps & { className?: string }) => {
  const uploadImage = trpc.account.uploadImage.useMutation();
  const updateProfile = trpc.account.updateUserProfile.useMutation();
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();

  const { onNext } = useMultiStep();
  const form = useAppForm({
    defaultValues: defaultValues as FormFields,
    validators: {
      onChange: resolver,
    },
    onSubmit: async ({ value }: { value: FormFields }) => {
      await updateProfile.mutateAsync({
        name: value.fullName,
        title: value.title,
      });

      onNext(value);
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
        <FormHeader text="Add your personal details">
          Tell us about yourself so others can find you.
        </FormHeader>
        <AvatarUploader
          label="Profile Picture"
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
          children={field => (
            <field.TextField
              label="Full Name"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: 'Enter your full name',
              }}
            />
          )}
        />
        <form.AppField
          name="title"
          children={field => (
            <field.TextField
              label="Professional title"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              inputProps={{
                placeholder: 'Enter your professional title',
              }}
            />
          )}
        />

        <form.SubmitButton>
          {updateProfile.isPending || uploadImage.isPending
            ? (
                <LuLoaderCircle />
              )
            : (
                'Continue'
              )}
        </form.SubmitButton>
      </FormContainer>
    </form>
  );
};
