import { useState } from 'react';
import { z } from 'zod';

import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { SelectItem } from '@op/ui/Select';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { GeoNamesMultiSelect } from '../GeoNamesMultiSelect';
import { ToggleRow } from '../layout/split/form/ToggleRow';

import type { StepProps } from '../form/utils';
import type { Option } from '@op/ui/MultiSelectComboBox';

const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(20),
  isNewValue: z.boolean().default(false).optional(),
  data: z.any().optional(),
});

export const validator = z.object({
  name: z
    .string()
    .min(1, { message: 'Enter a name for your organization' })
    .max(20, { message: 'Must be at most 20 characters' })
    .optional(),
  website: z
    .string()
    .url({ message: 'Enter a valid website address' })
    .min(1, { message: 'enter a ' })
    .max(200, { message: 'Must be at most 200 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(20, { message: 'Must be at most 20 characters' })
    .optional(),
  orgType: z.string().max(20, { message: 'Must be at most 20 characters' }),
  bio: z.string().max(200, { message: 'Must be at most 200 characters' }),
  mission: z
    .string()
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  whereWeWork: z.array(multiSelectOptionValidator).optional(),
  focusAreas: z.array(multiSelectOptionValidator).optional(),
  communitiesServed: z.array(multiSelectOptionValidator).optional(),
  strategies: z.array(multiSelectOptionValidator).optional(),
  networkOrganization: z.boolean().default(false),

  orgAvatarImageId: z.string().optional(),
  orgBannerImageId: z.string().optional(),
});

type ImageData = {
  url: string;
  path?: string;
  id?: string;
};

export const OrganizationDetailsForm = ({
  defaultValues,
  resolver,
  className,
}: StepProps & { className?: string }) => {
  const { onNext, onBack } = useMultiStep();
  const [profileImage, setProfileImage] = useState<ImageData | undefined>();
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>();

  const uploadImage = trpc.organization.uploadAvatarImage.useMutation();

  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: resolver,
    },
    onSubmit: ({ value }) => {
      onNext({
        ...value,
        orgAvatarImageId: profileImage?.id,
        orgBannerImageId: bannerImage?.id,
      });
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
        <FormHeader text="Add your organization’s details">
          We've pre-filled information about [ORGANIZATION]. Please review and
          make any necessary changes.
        </FormHeader>
        <div className="relative w-full pb-20">
          <BannerUploader
            className="relative aspect-[128/55] w-full bg-offWhite"
            value={bannerImage?.url ?? undefined}
            onChange={async (file: File): Promise<void> => {
              const reader = new FileReader();

              reader.onload = async (e) => {
                const base64 = (e.target?.result as string)?.split(',')[1];

                if (!base64) {
                  return;
                }

                const dataUrl = `data:${file.type};base64,${base64}`;

                setBannerImage({ url: dataUrl });
                const res = await uploadImage.mutateAsync({
                  file: base64,
                  fileName: file.name,
                  mimeType: file.type,
                });

                if (res?.url) {
                  setBannerImage(res);
                }
              };

              reader.readAsDataURL(file);
            }}
          />
          <AvatarUploader
            className="absolute bottom-0 left-4 aspect-square size-28"
            value={profileImage?.url ?? undefined}
            onChange={async (file: File): Promise<void> => {
              const reader = new FileReader();

              reader.onload = async (e) => {
                const base64 = (e.target?.result as string)?.split(',')[1];

                if (!base64) {
                  return;
                }

                const dataUrl = `data:${file.type};base64,${base64}`;

                setProfileImage({ url: dataUrl });
                const res = await uploadImage.mutateAsync({
                  file: base64,
                  fileName: file.name,
                  mimeType: file.type,
                });

                if (res?.url) {
                  setProfileImage(res);
                }
              };

              reader.readAsDataURL(file);
            }}
            uploading={uploadImage.isPending}
            error={uploadImage.error?.message || undefined}
          />
        </div>
        <form.AppField
          name="name"
          children={(field) => (
            <field.TextField
              label="Organization name"
              isRequired
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="website"
          children={(field) => (
            <field.TextField
              label="Website"
              isRequired
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label="Email"
              isRequired
              type="email"
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="whereWeWork"
          children={(field) => (
            <GeoNamesMultiSelect
              label="Where we work"
              isRequired
              onChange={(value) => field.handleChange(value)}
              value={(field.state.value as Array<Option>) ?? []}
            />
          )}
        />
        <form.AppField
          name="orgType"
          children={(field) => (
            <field.Select
              label="Organizational Status"
              placeholder="Select"
              selectedKey={field.state.value as string}
              onSelectionChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={getFieldErrorMessage(field)}
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </field.Select>
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <field.TextField
              useTextArea
              label="Bio"
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              textareaProps={{
                className: 'min-h-28',
                placeholder: 'Enter a brief bio for your profile',
              }}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <field.TextField
              useTextArea
              label="Mission statement"
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              className="min-h-24"
              textareaProps={{
                className: 'min-h-28',
                placeholder: 'Enter your mission statement or a brief bio',
              }}
            />
          )}
        />

        <form.AppField
          name="focusAreas"
          children={(field) => (
            <field.MultiSelectComboBox
              label="Focus Areas"
              placeholder="Select one or more"
              value={(field.state.value as Array<Option>) ?? []}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              items={[
                { id: 'placeholder1', label: 'Placeholder 1' },
                { id: 'placeholder2', label: 'Placeholder 2' },
                { id: 'placeholder3', label: 'Placeholder 3' },
                { id: 'placeholder4', label: 'Placeholder 4' },
                { id: 'placeholder5', label: 'Placeholder 5' },
                { id: 'placeholder6', label: 'Placeholder 6' },
                { id: 'placeholder7', label: 'Placeholder 7' },
                { id: 'placeholder8', label: 'Placeholder 8' },
                { id: 'placeholder9', label: 'Placeholder 9' },
              ]}
            />
          )}
        />

        <form.AppField
          name="communitiesServed"
          children={(field) => (
            <field.MultiSelectComboBox
              label="Communities Served"
              value={(field.state.value as Array<Option>) ?? []}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              items={[
                { id: 'placeholder1', label: 'Placeholder 1' },
                { id: 'placeholder2', label: 'Placeholder 2' },
                { id: 'placeholder3', label: 'Placeholder 3' },
                { id: 'placeholder4', label: 'Placeholder 4' },
                { id: 'placeholder5', label: 'Placeholder 5' },
                { id: 'placeholder6', label: 'Placeholder 6' },
                { id: 'placeholder7', label: 'Placeholder 7' },
                { id: 'placeholder8', label: 'Placeholder 8' },
                { id: 'placeholder9', label: 'Placeholder 9' },
              ]}
            />
          )}
        />
        <form.AppField
          name="strategies"
          children={(field) => (
            <field.MultiSelectComboBox
              label="Strategies/Tactics"
              value={(field.state.value as Array<Option>) ?? []}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              items={[
                { id: 'placeholder1', label: 'Placeholder 1' },
                { id: 'placeholder2', label: 'Placeholder 2' },
                { id: 'placeholder3', label: 'Placeholder 3' },
                { id: 'placeholder4', label: 'Placeholder 4' },
                { id: 'placeholder5', label: 'Placeholder 5' },
                { id: 'placeholder6', label: 'Placeholder 6' },
                { id: 'placeholder7', label: 'Placeholder 7' },
                { id: 'placeholder8', label: 'Placeholder 8' },
                { id: 'placeholder9', label: 'Placeholder 9' },
              ]}
            />
          )}
        />

        <form.AppField
          name="networkOrganization"
          children={(field) => (
            <ToggleRow>
              Does your organization serve as a network or coalition with member
              organizations?
              <field.ToggleButton
                isSelected={field.state.value as boolean}
                onChange={field.handleChange}
                aria-label="Does your organization serve as a network or coalition with member organizations?"
              />
            </ToggleRow>
          )}
        />

        <div className="flex justify-between">
          <form.Button color="secondary" onPress={onBack}>
            Back
          </form.Button>
          <form.SubmitButton>Continue</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
