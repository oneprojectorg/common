import { useSignedImageUpload } from '@/hooks/useSignedImageUpload';
import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';
import { createOrganizationFormValidator } from './organizationValidation';

export interface ImageData {
  url?: string;
  /** Draft-space storage path; set once an upload this session completed. */
  storagePath?: string;
}

interface OrganizationFormFieldsProps {
  defaultValues?: any;
  onSubmit: (data: any) => void | Promise<void>;
  initialProfileImage?: ImageData;
  initialBannerImage?: ImageData;
  children: (props: {
    form: any;
    profileImage?: ImageData;
    bannerImage?: ImageData;
    isSubmitting?: boolean;
    formFields: React.ReactNode;
  }) => React.ReactNode;
}

export const OrganizationFormFields = ({
  defaultValues,
  onSubmit,
  initialProfileImage,
  initialBannerImage,
  children,
}: OrganizationFormFieldsProps) => {
  const t = useTranslations();
  // Images upload to the caller's draft space before the org profile exists;
  // the storage paths ride along on submit and organization.create/update
  // claims them server-side.
  const signDraft = trpc.profile.signDraftProfileImageUploadUrl.useMutation();
  const avatarUpload = useSignedImageUpload({
    sign: (fileName) => signDraft.mutateAsync({ fileName }),
    initialUrl: initialProfileImage?.url,
    initialStoragePath: initialProfileImage?.storagePath,
  });
  const bannerUpload = useSignedImageUpload({
    sign: (fileName) => signDraft.mutateAsync({ fileName }),
    initialUrl: initialBannerImage?.url,
    initialStoragePath: initialBannerImage?.storagePath,
  });

  const form = useAppForm({
    defaultValues,
    canSubmitWhenInvalid: true,
    validators: {
      onSubmit: createOrganizationFormValidator(t),
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        ...value,
        profileImage: {
          url: avatarUpload.url,
          storagePath: avatarUpload.storagePath,
        },
        bannerImage: {
          url: bannerUpload.url,
          storagePath: bannerUpload.storagePath,
        },
        orgAvatarImagePath: avatarUpload.storagePath,
        orgBannerImagePath: bannerUpload.storagePath,
      });
    },
  });

  const formFields = (
    <>
      <div className="relative w-full pb-12 sm:pb-20">
        <BannerUploader
          value={bannerUpload.url}
          onChange={bannerUpload.upload}
          uploading={bannerUpload.isUploading}
          error={bannerUpload.uploadError}
        />
        <AvatarUploader
          className="absolute start-4 bottom-0 aspect-square size-20 sm:size-28"
          value={avatarUpload.url}
          onChange={avatarUpload.upload}
          uploading={avatarUpload.isUploading}
          error={avatarUpload.uploadError}
        />
      </div>

      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField
            label={t('Organization Name')}
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
            inputProps={{
              icon: <LuLink className="size-4 text-neutral-black" />,
              placeholder: t("Enter your organization's website here"),
              // Not `type="url"`: our zodUrl validation accepts a bare domain
              // (e.g. "venuecms.com") and auto-prefixes `https://`, but the
              // browser's native URL validation rejects the scheme-less value
              // and silently blocks form submission. `inputMode` keeps the
              // URL-optimized keyboard without that native constraint.
              inputMode: 'url',
            }}
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
            isRequired
            placeholder={t('Select')}
            selectedKey={field.state.value as string}
            onSelectionChange={field.handleChange}
            onBlur={field.handleBlur}
            errorMessage={getFieldErrorMessage(field)}
            className="w-full"
            size="medium"
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
            isRequired
            label={t('Organization headline')}
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
            textareaProps={{
              className: 'min-h-28',
              placeholder: t('Enter a brief description for your organization'),
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
          <TermsMultiSelect
            label={t('Focus Areas')}
            taxonomy="necSimple:focusArea"
            value={(field.state.value as Array<Option>) ?? []}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
          />
        )}
      />

      <form.AppField
        name="communitiesServed"
        children={(field) => (
          <TermsMultiSelect
            label={t('Communities Served')}
            taxonomy="candid:POPULATION"
            value={(field.state.value as Array<Option>) ?? []}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
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
            showDefinitions
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
    </>
  );

  return children({
    form,
    profileImage: {
      url: avatarUpload.url,
      storagePath: avatarUpload.storagePath,
    },
    bannerImage: {
      url: bannerUpload.url,
      storagePath: bannerUpload.storagePath,
    },
    isSubmitting: form.state.isSubmitting,
    formFields,
  });
};
