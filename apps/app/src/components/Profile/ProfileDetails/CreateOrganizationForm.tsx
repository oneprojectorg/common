'use client';

import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { DialogFooter } from '@op/sense/Dialog';
import { cn } from '@op/sense/lib/utils';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { forwardRef, useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { createOrganizationFormValidator } from '@/components/Onboarding/shared/organizationValidation';
import { sendOnboardingAnalytics } from '@/components/Onboarding/utils';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { type ImageData } from '../../Onboarding/shared/OrganizationFormFields';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { FormContainer } from '../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';

interface CreateOrganizationFormProps {
  onSubmit: (orgName?: string) => void;
  onError: () => void;
  className?: string;
}

export const CreateOrganizationForm = forwardRef<
  HTMLFormElement,
  CreateOrganizationFormProps
>(({ onSubmit, onError, className }, ref) => {
  const t = useTranslations();
  const router = useRouter();
  const trpcUtil = trpc.useUtils();

  // Initialize form data
  const initialData = {};

  const createOrganization = trpc.organization.create.useMutation({
    onMutate: (data) => {
      // Show "Setting up your org" modal
      onSubmit(data?.name);
    },
    onSuccess: async () => {
      await trpcUtil.account.getMyAccount.refetch();
      router.push(`/?new=1`);
    },
    onError: () => {
      // Close success modal and re-open create modal
      onError();
    },
  });

  const uploadAvatarImage = trpc.organization.uploadAvatarImage.useMutation();
  const uploadBannerImage = trpc.organization.uploadAvatarImage.useMutation();

  const [profileImage, setProfileImage] = useState<ImageData | undefined>();
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>();
  const isOnline = useConnectionStatus();

  const submitCreate = async (formData: any) => {
    if (!isOnline) {
      toast.error({
        title: t('No connection'),
        message: t('Please check your internet connection and try again.'),
      });
      return;
    }

    const createData = {
      ...formData,
      whereWeWork: (formData.whereWeWork as Array<any>)?.map((item) => ({
        id: item.id || '',
        label: item.label || '',
        data: item.data || {},
        isNewValue: item.isNewValue || false,
      })),
      orgAvatarImageId: profileImage?.id,
      orgBannerImageId: bannerImage?.id,
    };

    try {
      await createOrganization.mutateAsync(createData);
      sendOnboardingAnalytics(formData);
    } catch (err) {
      logger.error('Create organization failed', {
        error: err,
        context: 'CreateOrganizationForm',
      });
      onError();
      const errorInfo = analyzeError(err);

      if (errorInfo.isConnectionError) {
        toast.error({
          title: t('Connection issue'),
          message: t('Please try submitting the form again.'),
        });
      } else {
        toast.error({
          title: t("That didn't work"),
          message: errorInfo.message,
        });
      }
    }
  };

  const form = useAppForm({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      await submitCreate(value);
    },
    validators: {
      onChange: createOrganizationFormValidator(t),
      onSubmit: createOrganizationFormValidator(t),
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
        toast.error({
          message: t(
            'That file type is not supported. Accepted types: {types}',
            {
              types: acceptedTypes.map((type) => type.split('/')[1]).join(', '),
            },
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

  return (
    <form
      noValidate
      ref={ref}
      id="update-organization-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <FormContainer
        className={cn('min-h-0 flex-1 overflow-y-auto', className)}
      >
        {/* Header Images */}
        <div className="relative w-full pb-12 sm:pb-20">
          <BannerUploader
            value={bannerImage?.url ?? undefined}
            onChange={(file: File) =>
              handleImageUpload(file, setBannerImage, uploadBannerImage)
            }
            uploading={uploadBannerImage.isPending}
            error={uploadBannerImage.error?.message || undefined}
          />
          <AvatarUploader
            className="absolute start-4 bottom-0 aspect-square size-20 sm:size-28"
            value={profileImage?.url ?? undefined}
            onChange={(file: File) =>
              handleImageUpload(file, setProfileImage, uploadAvatarImage)
            }
            uploading={uploadAvatarImage.isPending}
            error={uploadAvatarImage.error?.message || undefined}
          />
        </div>

        {/* Basic Organization Fields */}
        <form.AppField
          name="name"
          children={(field) => (
            <field.TextField label={t('Organization Name')} isRequired />
          )}
        />

        <form.AppField
          name="website"
          children={(field) => (
            <field.TextField
              label={t('Website')}
              isRequired
              icon={<LuLink className="size-4 text-neutral-black" />}
              placeholder={t("Enter your organization's website here")}
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
              label={t('Where we work')}
              onChange={(value) => {
                // Convert Option[] to the expected format
                const converted = value.map((item: any) => ({
                  id: item.id,
                  label: item.label,
                  data: item.data || {
                    name: item.label,
                    placeId: item.id,
                    countryCode: null,
                    countryName: null,
                  },
                }));
                field.handleChange(converted);
              }}
              value={
                (field.state.value as Array<any>)?.map((item) => ({
                  id: item.id,
                  label: item.label,
                })) ?? []
              }
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
              className="w-full"
              options={[
                { value: 'nonprofit', label: t('Nonprofit') },
                { value: 'forprofit', label: t('Forprofit') },
                { value: 'government', label: t('Government Entity') },
              ]}
            />
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <field.TextArea
              isRequired
              label={t('Organization headline')}
              className="min-h-28"
              placeholder={t('Enter a brief description for your organization')}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <field.TextArea
              label={t('Mission statement')}
              className="min-h-28"
              placeholder={t('Enter your mission statement or a brief bio')}
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
              <field.Switch
                aria-label={t(
                  'Does your organization serve as a network or coalition with member organizations?',
                )}
              />
            </ToggleRow>
          )}
        />

        {/* Funding Information Section */}
        <hr />
        <div className="flex flex-col gap-4">
          <form.AppField
            name="isReceivingFunds"
            children={(field) => (
              <>
                <ToggleRow>
                  <span>{t('Is your organization seeking funding?')}</span>
                  <field.Switch />
                </ToggleRow>
                {field.state.value ? (
                  <div className="flex flex-col gap-4">
                    <form.AppField
                      name="receivingFundsTerms"
                      children={(field) => (
                        <TermsMultiSelect
                          taxonomy="necFunding"
                          value={(field.state.value as Array<Option>) ?? []}
                          label={t('What types of funding are you seeking?')}
                          onChange={field.handleChange}
                          errorMessage={getFieldErrorMessage(field)}
                        />
                      )}
                    />

                    <form.AppField
                      name="receivingFundsLink"
                      children={(field) => (
                        <div className="flex flex-col gap-2">
                          <field.TextField
                            label={t(
                              'Where can people contribute to your organization?',
                            )}
                            icon={
                              <LuLink className="size-4 text-neutral-black" />
                            }
                            placeholder={t('Add your contribution page here')}
                          />
                          <span className="text-start text-sm text-neutral-gray4">
                            {t(
                              'Add a link to your donation page, Open Collective, GoFundMe or any platform where supporters can contribute or learn more about how.',
                            )}
                          </span>
                        </div>
                      )}
                    />
                  </div>
                ) : null}
              </>
            )}
          />

          <hr />

          <form.AppField
            name="isOfferingFunds"
            children={(field) => (
              <>
                <ToggleRow>
                  <span>{t('Does your organization offer funding?')}</span>
                  <field.Switch />
                </ToggleRow>

                {field.state.value ? (
                  <form.AppField
                    name="acceptingApplications"
                    children={(acceptingApplicationsField) => (
                      <>
                        <ToggleRow>
                          {t(
                            'Are organizations currently able to apply for funding?',
                          )}
                          <acceptingApplicationsField.Switch />
                        </ToggleRow>
                        <div className="flex flex-col gap-4">
                          {!acceptingApplicationsField.state.value ? (
                            <form.AppField
                              name="offeringFundsDescription"
                              children={(field) => (
                                <field.TextArea
                                  label={t('What is your funding process?')}
                                  className="min-h-32"
                                  placeholder={t(
                                    "Enter a description of the type of funding you're seeking (e.g., grants, integrated capital, etc.)",
                                  )}
                                />
                              )}
                            />
                          ) : null}

                          <form.AppField
                            name="offeringFundsLink"
                            children={(field) => (
                              <div className="flex flex-col gap-2">
                                <field.TextField
                                  label={
                                    acceptingApplicationsField.state.value
                                      ? t('Where can organizations apply?')
                                      : t('Where can organizations learn more?')
                                  }
                                  icon={
                                    <LuLink className="size-4 text-neutral-black" />
                                  }
                                  placeholder={
                                    acceptingApplicationsField.state.value
                                      ? t(
                                          'Add a link where organizations can apply for funding',
                                        )
                                      : t(
                                          'Add a link to learn more about your funding process',
                                        )
                                  }
                                />
                                <span className="text-sm text-neutral-gray4">
                                  {acceptingApplicationsField.state.value
                                    ? null
                                    : t(
                                        'Add a link where others can learn more about how to they might receive funding from your organization now or in the future.',
                                      )}
                                </span>
                              </div>
                            )}
                          />
                        </div>
                      </>
                    )}
                  />
                ) : null}
              </>
            )}
          />
        </div>
      </FormContainer>

      <DialogFooter>
        <form.SubmitButton
          className="w-full sm:max-w-fit"
          disabled={form.state.isSubmitting || createOrganization.isPending}
          loading={form.state.isSubmitting || createOrganization.isPending}
        >
          {t('Create')}
        </form.SubmitButton>
      </DialogFooter>
    </form>
  );
});

CreateOrganizationForm.displayName = 'CreateOrganizationForm';
