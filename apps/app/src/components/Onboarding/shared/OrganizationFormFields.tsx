import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/sense/AvatarUploader';
import { BannerUploader } from '@op/sense/BannerUploader';
import { toast } from '@op/sense/Toast';
import { type ComponentProps, useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';
import { createOrganizationFormValidator } from './organizationValidation';

// `TermsMultiSelect` / `GeoNamesMultiSelect` still own the option shape; derive
// it from their props rather than redeclaring it.
type Option = NonNullable<
  ComponentProps<typeof TermsMultiSelect>['value']
>[number];

export interface ImageData {
  url: string;
  path?: string;
  id?: string;
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
  const uploadAvatarImage = trpc.organization.uploadAvatarImage.useMutation();
  const uploadImage = trpc.organization.uploadAvatarImage.useMutation();

  const [profileImage, setProfileImage] = useState<ImageData | undefined>(
    initialProfileImage,
  );
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>(
    initialBannerImage,
  );

  const form = useAppForm({
    defaultValues,
    canSubmitWhenInvalid: true,
    validators: {
      onChange: createOrganizationFormValidator(t),
      onSubmit: createOrganizationFormValidator(t),
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        ...value,
        profileImage,
        bannerImage,
        orgAvatarImageId: profileImage?.id,
        orgBannerImageId: bannerImage?.id,
      });
    },
  });

  const handleImageUpload = async (
    file: File,
    setImage: (image: ImageData | undefined) => void,
    uploadMutation: any,
  ): Promise<void> => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];

      if (!base64) {
        return;
      }

      const acceptedTypes = [
        'image/gif',
        'image/png',
        'image/jpeg',
        'image/webp',
      ];
      if (!acceptedTypes.includes(file.type)) {
        const types = acceptedTypes.map((t) => t.split('/')[1]).join(', ');
        toast.error(
          t('unsupportedFileType', {
            types,
          }),
        );
        return;
      }

      if (file.size > DEFAULT_MAX_SIZE) {
        const maxSizeMB = (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(2);
        toast.error(
          t('fileTooLarge', {
            size: maxSizeMB,
          }),
        );
        return;
      }

      const dataUrl = `data:${file.type};base64,${base64}`;

      setImage({ url: dataUrl });
      const res = await uploadMutation.mutateAsync({
        file: base64,
        fileName: file.name,
        mimeType: file.type,
      });

      if (res?.url) {
        setImage(res);
      }
    };

    reader.readAsDataURL(file);
  };

  const formFields = (
    <>
      <div className="relative w-full pb-12 sm:pb-20">
        <BannerUploader
          value={bannerImage?.url ?? undefined}
          onChange={(file: File) =>
            handleImageUpload(file, setBannerImage, uploadImage)
          }
          uploading={uploadImage.isPending}
          error={uploadImage.error?.message || undefined}
        />
        <AvatarUploader
          className="absolute start-4 bottom-0 aspect-square size-20 sm:size-28"
          value={profileImage?.url ?? undefined}
          onChange={(file: File) =>
            handleImageUpload(file, setProfileImage, uploadAvatarImage)
          }
          uploading={uploadAvatarImage.isPending}
        />
      </div>

      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField label={t('org.nameLabel')} isRequired />
        )}
      />

      <form.AppField
        name="website"
        children={(field) => (
          <field.TextField
            label={t('Website')}
            isRequired
            icon={<LuLink className="size-4 text-foreground" />}
            placeholder={t('org.websitePlaceholder')}
            // Not `type="url"`: our zodUrl validation accepts a bare domain
            // (e.g. "venuecms.com") and auto-prefixes `https://`, but the
            // browser's native URL validation rejects the scheme-less value
            // and silently blocks form submission. `inputMode` keeps the
            // URL-optimized keyboard without that native constraint.
            inputMode="url"
          />
        )}
      />

      <form.AppField
        name="email"
        children={(field) => (
          <field.TextField label={t('Email')} isRequired type="email" />
        )}
      />

      <form.AppField
        name="whereWeWork"
        children={(field) => (
          <GeoNamesMultiSelect
            label={t('org.whereWeWorkLabel')}
            onChange={(value) => field.handleChange(value)}
            value={(field.state.value as Array<Option>) ?? []}
          />
        )}
      />

      <form.AppField
        name="orgType"
        children={(field) => (
          <field.Select
            label={t('org.statusLabel')}
            isRequired
            placeholder={t('Select')}
            options={[
              { value: 'nonprofit', label: t('org.statusNonprofit') },
              { value: 'forprofit', label: t('org.statusForprofit') },
              { value: 'government', label: t('org.statusGovernment') },
            ]}
          />
        )}
      />

      <form.AppField
        name="bio"
        children={(field) => (
          <field.TextArea
            isRequired
            label={t('org.headlineLabel')}
            className="min-h-28"
            placeholder={t('org.headlinePlaceholder')}
          />
        )}
      />

      <form.AppField
        name="mission"
        children={(field) => (
          <field.TextArea
            label={t('org.missionLabel')}
            className="min-h-28"
            placeholder={t('org.missionPlaceholder')}
          />
        )}
      />

      <form.AppField
        name="focusAreas"
        children={(field) => (
          <TermsMultiSelect
            label={t('org.focusAreasLabel')}
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
            label={t('org.communitiesServedLabel')}
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
            label={t('org.strategiesLabel')}
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
          <ToggleRow label={t('org.networkQuestion')}>
            <field.Switch />
          </ToggleRow>
        )}
      />
    </>
  );

  return children({
    form,
    profileImage,
    bannerImage,
    isSubmitting: form.state.isSubmitting,
    formFields,
  });
};
