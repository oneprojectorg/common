import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../GeoNamesMultiSelect';
import { TermsMultiSelect } from '../TermsMultiSelect';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import type { StepProps } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';

const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(20),
  isNewValue: z.boolean().default(false).optional(),
  data: z.record(z.any()).default({}),
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
    .min(1, { message: 'Must be at least 1 character' })
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

interface ImageData {
  url: string;
  path?: string;
  id?: string;
}

export const OrganizationDetailsForm = ({
  defaultValues,
  resolver,
  className,
}: StepProps & { className?: string }) => {
  const t = useTranslations();
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
        <FormHeader text={t('Add your organization’s details')}>
          {t("We've pre-filled information about [ORGANIZATION].")}
          <br />
          {t('Please review and make any necessary changes.')}
        </FormHeader>
        <div className="relative w-full pb-12 sm:pb-20">
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
            className="absolute bottom-0 left-4 aspect-square size-20 sm:size-28"
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
              label={t('Name')}
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
              label={t('Website')}
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
              label={t('Email')}
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
              label={t('Where we work')}
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
              label={t('Organizational Status')}
              placeholder={t('Select')}
              selectedKey={field.state.value as string}
              onSelectionChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={getFieldErrorMessage(field)}
              className="w-full"
            >
              <SelectItem id="nonprofit">{t('Nonprofit')}</SelectItem>
              <SelectItem id="forprofit">{t('Forprofit')}</SelectItem>
              <SelectItem id="government">{t('Government Entity')}</SelectItem>
            </field.Select>
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <field.TextField
              useTextArea
              label={t('Bio')}
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              textareaProps={{
                className: 'min-h-28',
                placeholder: t('Enter a brief bio for your profile'),
              }}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <field.TextField
              useTextArea
              label={t('Mission statement')}
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              className="min-h-24"
              textareaProps={{
                className: 'min-h-28',
                placeholder: t('Enter your mission statement or a brief bio'),
              }}
            />
          )}
        />

        <form.AppField
          name="focusAreas"
          children={(field) => (
            <field.MultiSelectComboBox
              label={t('Focus Areas')}
              placeholder={t('Select one or more')}
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
              label={t('Communities Served')}
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
            <TermsMultiSelect
              label={t('Strategies/Tactics')}
              taxonomy="splcStrategies"
              value={(field.state.value as Array<Option>) ?? []}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="networkOrganization"
          children={(field) => (
            <ToggleRow>
              {t(
                'Does your organization serve as a network or coalition with member organizations?',
              )}
              <field.ToggleButton
                isSelected={field.state.value as boolean}
                onChange={field.handleChange}
                aria-label={t(
                  'Does your organization serve as a network or coalition with member organizations?',
                )}
              />
            </ToggleRow>
          )}
        />

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
