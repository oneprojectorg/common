import { trpc } from '@op/api/client';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import type { FieldApi } from '@tanstack/react-form';
import { useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { getFieldErrorMessage } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';
import type { OrganizationFormData } from './organizationValidation';

interface ImageData {
  url: string;
  path?: string;
  id?: string;
}

interface OrganizationFormFieldsProps {
  form: any; // Form instance from useAppForm
  profileImage?: ImageData;
  setProfileImage: (image: ImageData | undefined) => void;
  bannerImage?: ImageData;
  setBannerImage: (image: ImageData | undefined) => void;
}

export const OrganizationFormFields = ({
  form,
  profileImage,
  setProfileImage,
  bannerImage,
  setBannerImage,
}: OrganizationFormFieldsProps) => {
  const t = useTranslations();
  const uploadAvatarImage = trpc.organization.uploadAvatarImage.useMutation();
  const uploadImage = trpc.organization.uploadAvatarImage.useMutation();

  return (
    <>
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
          uploading={uploadImage.isPending}
          error={uploadImage.error?.message || undefined}
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
              const res = await uploadAvatarImage.mutateAsync({
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
          uploading={uploadAvatarImage.isPending}
          error={uploadAvatarImage.error?.message || undefined}
        />
      </div>

      <form.AppField
        name="name"
        children={(field: FieldApi<OrganizationFormData, 'name'>) => (
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
        children={(field: FieldApi<OrganizationFormData, 'website'>) => (
          <field.TextField
            label={t('Website')}
            isRequired
            value={field.state.value as string}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            inputProps={{
              icon: <LuLink className="size-4 text-neutral-black" />,
              placeholder: "Enter your organization's website here",
            }}
            errorMessage={getFieldErrorMessage(field)}
          />
        )}
      />

      <form.AppField
        name="email"
        children={(field: FieldApi<OrganizationFormData, 'email'>) => (
          <field.TextField
            label={t('Email')}
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
        children={(field: FieldApi<OrganizationFormData, 'whereWeWork'>) => (
          <GeoNamesMultiSelect
            label={t('Where we work')}
            onChange={(value) => field.handleChange(value)}
            value={(field.state.value as Array<Option>) ?? []}
          />
        )}
      />

      <form.AppField
        name="orgType"
        children={(field: FieldApi<OrganizationFormData, 'orgType'>) => (
          <field.Select
            label={t('Organizational Status')}
            isRequired
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
        children={(field: FieldApi<OrganizationFormData, 'bio'>) => (
          <field.TextField
            useTextArea
            isRequired
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
        children={(field: FieldApi<OrganizationFormData, 'mission'>) => (
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
        children={(field: FieldApi<OrganizationFormData, 'focusAreas'>) => (
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
        children={(field: FieldApi<OrganizationFormData, 'communitiesServed'>) => (
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
        children={(field: FieldApi<OrganizationFormData, 'strategies'>) => (
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
        children={(field: FieldApi<OrganizationFormData, 'networkOrganization'>) => (
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
};