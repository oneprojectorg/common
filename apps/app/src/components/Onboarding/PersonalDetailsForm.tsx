import { z } from 'zod';

import { trpc } from '@op/trpc/client';
import { ImageUploader } from '@op/ui/ImageUploader';

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
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  profileImageUrl: z.string().optional(),
});

export const PersonalDetailsForm = ({ defaultValues, resolver }: StepProps) => {
  // Ensure profileImageUrl is always present in defaultValues
  const mergedDefaults = {
    ...defaultValues,
    profileImageUrl: defaultValues.profileImageUrl ?? '',
  };

  const { onNext } = useMultiStep();
  const form = useAppForm({
    defaultValues: mergedDefaults,
    validators: {
      onChange: resolver,
    },
    onSubmit: ({ value }) => {
      console.log('SUBMIT >>>>');
      console.log(JSON.stringify(value, null, 2));
      onNext(value);
    },
  });

  const uploadImage = trpc.account.uploadImage.useMutation();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormContainer>
        <FormHeader text="Add your personal details">
          Tell us about yourself so others can find you.
        </FormHeader>
        <ImageUploader
          label="Profile Picture"
          value={(form.state.values as any).profileImageUrl}
          onChange={async (file: File) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const base64 = (e.target?.result as string)?.split(',')[1];
              if (!base64) return;

              const res = await uploadImage.mutateAsync({
                file: base64,
                fileName: file.name,
                mimeType: file.type,
              });

              if (res?.url) {
                form.setFieldValue('profileImageUrl', res.url);
              }
            };
            reader.readAsDataURL(file);
          }}
          uploading={uploadImage.isLoading}
          error={uploadImage.error?.message || undefined}
        />
        <div className="flex flex-col gap-4">
          <form.AppField
            name="fullName"
            children={(field) => (
              <field.TextField
                label="Full Name"
                isRequired
                value={field.state.value as string}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
              />
            )}
          />
          <form.AppField
            name="title"
            children={(field) => (
              <field.TextField
                label="Professional title"
                isRequired
                value={field.state.value as string}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
              />
            )}
          />
        </div>
        <form.SubmitButton>Continue</form.SubmitButton>
      </FormContainer>
    </form>
  );
};
