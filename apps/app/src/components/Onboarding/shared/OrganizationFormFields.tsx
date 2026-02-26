import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';
import { createOrganizationFormValidator } from './organizationValidation';

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
        toast.error({
          message: t(
            'That file type is not supported. Accepted types: {types}',
            { types },
          ),
        });
        return;
      }

      if (file.size > DEFAULT_MAX_SIZE) {
        const maxSizeMB = (DEFAULT_MAX_SIZE / 1024 / 1024).toFixed(2);
        toast.error({
          message: t('File too large. Maximum size: {size}MB', {
            size: maxSizeMB,
          }),
        });
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
          className="absolute bottom-0 left-4 aspect-square size-20 sm:size-28"
          value={profileImage?.url ?? undefined}
          onChange={(file: File) =>
            handleImageUpload(file, setProfileImage, uploadAvatarImage)
          }
          uploading={uploadAvatarImage.isPending}
          error={uploadAvatarImage.error?.message || undefined}
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
    profileImage,
    bannerImage,
    isSubmitting: form.state.isSubmitting,
    formFields,
  });
};
