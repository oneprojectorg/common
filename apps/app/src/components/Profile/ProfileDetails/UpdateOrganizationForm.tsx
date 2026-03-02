'use client';

import { DEFAULT_MAX_SIZE } from '@/hooks/useFileUpload';
import { getPublicUrl } from '@/utils';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { AvatarUploader } from '@op/ui/AvatarUploader';
import { BannerUploader } from '@op/ui/BannerUploader';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { SelectItem } from '@op/ui/Select';
import { toast } from '@op/ui/Toast';
import { ToggleButton } from '@op/ui/ToggleButton';
import { useRouter } from 'next/navigation';
import { forwardRef, useState } from 'react';
import { LuLink } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { GeoNamesMultiSelect } from '../../GeoNamesMultiSelect';
import { type ImageData } from '../../Onboarding/shared/OrganizationFormFields';
import { TermsMultiSelect } from '../../TermsMultiSelect';
import { FormContainer } from '../../form/FormContainer';
import { getFieldErrorMessage, useAppForm } from '../../form/utils';
import { ToggleRow } from '../../layout/split/form/ToggleRow';

interface UpdateOrganizationFormProps {
  profile: Organization;
  onSuccess: () => void;
  className?: string;
}

// Helper function to transform organization data to form format
const transformOrganizationToFormData = (org: Organization, terms?: any) => {
  // Extract focus areas and communities served from terms
  const focusAreas = terms?.['necSimple:focusArea'] || [];
  const communitiesServed = terms?.['candid:POPULATION'] || [];
  const receivingFundsTerms = terms?.['necFunding'] || [];

  // Extract funding links from the links array
  const receivingFundingLink = org.links?.find(
    (link) => link.type === 'receiving',
  );
  const offeringFundingLink = org.links?.find(
    (link) => link.type === 'offering',
  );

  return {
    name: org.profile.name || '',
    website: org.profile.website || '',
    email: org.profile.email || '',
    orgType: org.orgType || '',
    bio: org.profile.bio || '',
    mission: org.profile.mission || '',
    whereWeWork:
      org.whereWeWork?.map((item) => {
        return {
          id: item.id,
          label: item.name || '',
          data: item || {},
        };
      }) || [],
    focusAreas: focusAreas.map((item: any) => ({
      id: item.id,
      label: item.label,
    })),
    communitiesServed: communitiesServed.map((item: any) => ({
      id: item.id,
      label: item.label,
    })),
    strategies: org.strategies
      ? org.strategies.map((item) => ({
          id: item.id,
          label: item.label,
        }))
      : [],
    networkOrganization: org.networkOrganization || false,
    // Funding information
    isReceivingFunds: org.isReceivingFunds || false,
    isOfferingFunds: org.isOfferingFunds || false,
    acceptingApplications: org.acceptingApplications || false,
    receivingFundsDescription: receivingFundingLink?.description || '',
    receivingFundsTerms: receivingFundsTerms.map((item: any) => ({
      id: item.id,
      label: item.label,
    })),
    receivingFundsLink: receivingFundingLink?.href || '',
    offeringFundsDescription: offeringFundingLink?.description || '',
    offeringFundsLink: offeringFundingLink?.href || '',
  };
};

export const UpdateOrganizationForm = forwardRef<
  HTMLFormElement,
  UpdateOrganizationFormProps
>(({ profile, onSuccess, className }, ref) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const router = useRouter();

  // Fetch organization terms for focus areas and communities served
  const { data: terms } = trpc.organization.getTerms.useQuery({
    id: profile.id,
  });

  // Initialize form data from profile and terms
  const initialData = transformOrganizationToFormData(profile, terms);

  // Initialize images from profile
  const initialProfileImage: ImageData | undefined = profile.profile.avatarImage
    ? {
        url: getPublicUrl(profile.profile.avatarImage.name) || '',
        id: profile.profile.avatarImage.id,
      }
    : undefined;

  const initialBannerImage: ImageData | undefined = profile.profile.headerImage
    ? {
        url: getPublicUrl(profile.profile.headerImage.name) || '',
        id: profile.profile.headerImage.id,
      }
    : undefined;

  const updateOrganization = trpc.organization.update.useMutation();
  const uploadAvatarImage = trpc.organization.uploadAvatarImage.useMutation();
  const uploadImage = trpc.organization.uploadAvatarImage.useMutation();

  const [profileImage, setProfileImage] = useState<ImageData | undefined>(
    initialProfileImage,
  );
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>(
    initialBannerImage,
  );
  const isOnline = useConnectionStatus();

  const submitUpdate = async (formData: any) => {
    if (!isOnline) {
      toast.error({
        title: t('No connection'),
        message: t('Please check your internet connection and try again.'),
      });
      return;
    }

    const updateData = {
      id: profile.id,
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
      await updateOrganization.mutateAsync(updateData);

      // Invalidate relevant queries
      await utils.organization.getBySlug.invalidate({
        slug: profile.profile.slug,
      });
      router.refresh();

      onSuccess();
    } catch (error) {
      console.error('Failed to update organization:', error);

      const errorInfo = analyzeError(error);

      if (errorInfo.isConnectionError) {
        toast.error({
          title: t('Connection issue'),
          message: t('Please try submitting the form again.'),
        });
      } else {
        toast.error({
          title: t('Update failed'),
          message: errorInfo.message,
        });
      }
    }
  };

  const form = useAppForm({
    defaultValues: initialData,
    onSubmit: async ({ value }) => {
      await submitUpdate(value);
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
      ref={ref}
      id="update-organization-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="w-full"
    >
      <FormContainer className={className}>
        {/* Header Images */}
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

        {/* Basic Organization Fields */}
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
              selectedKey={field.state.value as string}
              onSelectionChange={(key) => field.handleChange(key as string)}
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
              isRequired
              label={t('Organization headline')}
              value={field.state.value as string}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              textareaProps={{
                className: 'min-h-28',
                placeholder: t(
                  'Enter a brief description for your organization',
                ),
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

        {/* Funding Information Section */}
        <hr />
        <div className="flex flex-col gap-4">
          <form.AppField
            name="isReceivingFunds"
            children={(field) => (
              <>
                <ToggleRow>
                  <span>{t('Is your organization seeking funding?')}</span>
                  <ToggleButton
                    isSelected={field.state.value as boolean}
                    onChange={field.handleChange}
                  />
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
                            value={field.state.value as string}
                            onBlur={field.handleBlur}
                            onChange={field.handleChange}
                            errorMessage={getFieldErrorMessage(field)}
                            inputProps={{
                              icon: (
                                <LuLink className="size-4 text-neutral-black" />
                              ),
                              placeholder: t('Add your contribution page here'),
                            }}
                          />
                          <span className="text-left text-sm text-neutral-gray4">
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
                  <ToggleButton
                    isSelected={field.state.value as boolean}
                    onChange={field.handleChange}
                  />
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
                          <ToggleButton
                            isSelected={
                              acceptingApplicationsField.state.value as boolean
                            }
                            onChange={acceptingApplicationsField.handleChange}
                          />
                        </ToggleRow>
                        <div className="flex flex-col gap-4">
                          {!acceptingApplicationsField.state.value ? (
                            <form.AppField
                              name="offeringFundsDescription"
                              children={(field) => (
                                <field.TextField
                                  useTextArea
                                  label={t('What is your funding process?')}
                                  value={field.state.value as string}
                                  onBlur={field.handleBlur}
                                  onChange={field.handleChange}
                                  errorMessage={getFieldErrorMessage(field)}
                                  textareaProps={{
                                    className: 'min-h-32',
                                    placeholder: t(
                                      "Enter a description of the type of funding you're seeking (e.g., grants, integrated capital, etc.)",
                                    ),
                                  }}
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
                                  value={field.state.value as string}
                                  onBlur={field.handleBlur}
                                  onChange={field.handleChange}
                                  errorMessage={getFieldErrorMessage(field)}
                                  inputProps={{
                                    placeholder: acceptingApplicationsField
                                      .state.value
                                      ? t(
                                          'Add a link where organizations can apply for funding',
                                        )
                                      : t(
                                          'Add a link to learn more about your funding process',
                                        ),
                                    icon: (
                                      <LuLink className="size-4 text-neutral-black" />
                                    ),
                                  }}
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

      <ModalFooter className="sticky">
        <div className="flex flex-col-reverse justify-end gap-4 sm:flex-row sm:gap-2">
          <form.SubmitButton
            className="w-full sm:max-w-fit"
            isDisabled={form.state.isSubmitting || updateOrganization.isPending}
          >
            {form.state.isSubmitting || updateOrganization.isPending ? (
              <LoadingSpinner />
            ) : (
              t('Save')
            )}
          </form.SubmitButton>
        </div>
      </ModalFooter>
    </form>
  );
});

UpdateOrganizationForm.displayName = 'UpdateOrganizationForm';
