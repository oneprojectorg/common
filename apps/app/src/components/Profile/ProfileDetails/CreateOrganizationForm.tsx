'use client';

import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { AvatarUploader } from '@op/sense/AvatarUploader';
import { BannerUploader } from '@op/sense/BannerUploader';
import { DialogFooter } from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useRouter } from 'next/navigation';
import { forwardRef, useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { createOrganizationFormValidator } from '@/components/Onboarding/shared/organizationValidation';
import { sendOnboardingAnalytics } from '@/components/Onboarding/utils';
import type { Option } from '@/components/multiSelectOption';

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
      toast.error(t('No connection'), {
        description: t('checkConnectionHint'),
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
        toast.error(t('Connection issue'), {
          description: t('resubmitFormHint'),
        });
      } else {
        toast.error(t("That didn't work"), {
          description: errorInfo.message,
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
        toast.error(
          t('unsupportedFileType', {
            types: acceptedTypes.map((type) => type.split('/')[1]).join(', '),
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
              label={t('org.statusLabel')}
              isRequired
              placeholder={t('Select')}
              className="w-full"
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

        {/* Funding Information Section */}
        <hr />
        <div className="flex flex-col gap-4">
          <form.AppField
            name="isReceivingFunds"
            children={(field) => (
              <>
                <ToggleRow label={t('org.seekingFundingQuestion')}>
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
                          label={t('org.fundingSoughtLabel')}
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
                            label={t('org.fundingContributeLabel')}
                            icon={<LuLink className="size-4 text-foreground" />}
                            placeholder={t('org.fundingContributePlaceholder')}
                          />
                          <span className="text-start text-sm text-muted-foreground">
                            {t('org.fundingContributeHint')}
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
                <ToggleRow label={t('org.offersFundingQuestion')}>
                  <field.Switch />
                </ToggleRow>

                {field.state.value ? (
                  <form.AppField
                    name="acceptingApplications"
                    children={(acceptingApplicationsField) => (
                      <>
                        <ToggleRow
                          label={t('org.acceptingApplicationsQuestion')}
                        >
                          <acceptingApplicationsField.Switch />
                        </ToggleRow>
                        <div className="flex flex-col gap-4">
                          {!acceptingApplicationsField.state.value ? (
                            <form.AppField
                              name="offeringFundsDescription"
                              children={(field) => (
                                <field.TextArea
                                  label={t('org.fundingProcessLabel')}
                                  className="min-h-32"
                                  placeholder={t(
                                    'org.fundingProcessPlaceholder',
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
                                      ? t('org.fundingApplyLabel')
                                      : t('org.fundingLearnMoreLabel')
                                  }
                                  icon={
                                    <LuLink className="size-4 text-foreground" />
                                  }
                                  placeholder={
                                    acceptingApplicationsField.state.value
                                      ? t('org.fundingApplyPlaceholder')
                                      : t('org.fundingLearnMorePlaceholder')
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {acceptingApplicationsField.state.value
                                    ? null
                                    : t('org.fundingLearnMoreHint')}
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
