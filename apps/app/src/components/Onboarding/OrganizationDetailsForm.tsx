import { trpc } from '@op/trpc/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { GeoNamesMultiSelect } from '../GeoNamesMultiSelect';
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

export const validator = (t: ReturnType<typeof useTranslations>) => z.object({
  name: z
    .string()
    .min(1, { message: t('onboarding.organizationDetails.validation.enterName') })
    .max(20, { message: t('onboarding.organizationDetails.validation.max20Chars') })
    .optional(),
  website: z
    .string()
    .url({ message: t('onboarding.organizationDetails.validation.enterValidWebsite') })
    .min(1, { message: t('onboarding.organizationDetails.validation.min1Char') })
    .max(200, { message: t('onboarding.organizationDetails.validation.max200Chars') }),
  email: z
    .string()
    .email({ message: t('onboarding.organizationDetails.validation.invalidEmail') })
    .max(20, { message: t('onboarding.organizationDetails.validation.max20Chars') })
    .optional(),
  orgType: z.string().max(20, { message: t('onboarding.organizationDetails.validation.max20Chars') }),
  bio: z.string().max(200, { message: t('onboarding.organizationDetails.validation.max200Chars') }),
  mission: z
    .string()
    .max(200, { message: t('onboarding.organizationDetails.validation.max200Chars') })
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
        <FormHeader text={t('onboarding.organizationDetails.header')}>
          {t('onboarding.organizationDetails.prefillNotice', { organization: '[ORGANIZATION]' })}
          <br />
          {t('onboarding.organizationDetails.reviewNotice')}
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
              label={t('onboarding.organizationDetails.website')}
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
              label={t('onboarding.organizationDetails.email')}
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
              label={t('onboarding.organizationDetails.whereWeWork')}
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
              label={t('onboarding.organizationDetails.orgStatus')}
              placeholder={t('onboarding.organizationDetails.select')}
              selectedKey={field.state.value as string}
              onSelectionChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={getFieldErrorMessage(field)}
            >
              <SelectItem id="nonprofit">{t('onboarding.organizationDetails.nonprofit')}</SelectItem>
              <SelectItem id="forprofit">{t('onboarding.organizationDetails.forprofit')}</SelectItem>
              <SelectItem id="government">{t('onboarding.organizationDetails.governmentEntity')}</SelectItem>
            </field.Select>
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <field.TextField
              useTextArea
              label={t('onboarding.organizationDetails.bio')}
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              textareaProps={{
                className: 'min-h-28',
                placeholder: t('onboarding.organizationDetails.enterBio'),
              }}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <field.TextField
              useTextArea
              label={t('onboarding.organizationDetails.missionStatement')}
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              className="min-h-24"
              textareaProps={{
                className: 'min-h-28',
                placeholder: t('onboarding.organizationDetails.enterMission'),
              }}
            />
          )}
        />

        <form.AppField
          name="focusAreas"
          children={(field) => (
            <field.MultiSelectComboBox
              label={t('onboarding.organizationDetails.focusAreas')}
              placeholder={t('onboarding.organizationDetails.selectOneOrMore')}
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
              label={t('onboarding.organizationDetails.communitiesServed')}
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
              label={t('onboarding.organizationDetails.strategiesTactics')}
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
              {t('onboarding.organizationDetails.networkQuestion')}
              <field.ToggleButton
                isSelected={field.state.value as boolean}
                onChange={field.handleChange}
                aria-label={t('onboarding.organizationDetails.networkQuestion')}
              />
            </ToggleRow>
          )}
        />

        <div className="flex justify-between gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('onboarding.organizationDetails.back')}
          </form.Button>
          <form.SubmitButton>{t('onboarding.organizationDetails.continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
