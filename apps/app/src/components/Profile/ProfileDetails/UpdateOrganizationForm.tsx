'use client';

import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { cn } from '@op/ui/utils';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { OrganizationFormFields } from '../../Onboarding/shared/OrganizationFormFields';
import { organizationFormValidator } from '../../Onboarding/shared/organizationValidation';
import { FormContainer } from '../../form/FormContainer';
import { useAppForm } from '../../form/utils';

interface ImageData {
  url: string;
  path?: string;
  id?: string;
}

interface UpdateOrganizationFormProps {
  profile: Organization;
  onSuccess: () => void;
  className?: string;
}

// Helper function to transform organization data to form format
const transformOrganizationToFormData = (org: Organization) => {
  return {
    name: org.name || '',
    website: org.website || '',
    email: org.email || '',
    orgType: org.orgType || '',
    bio: org.bio || '',
    mission: org.mission || '',
    whereWeWork:
      org.organizationsWhereWeWork?.map((item) => ({
        id: item.taxonomyTerm.id,
        label: item.taxonomyTerm.label,
        data: item.taxonomyTerm.data || {},
      })) || [],
    focusAreas:
      org.organizationsTerms?.map((item) => ({
        id: item.taxonomyTerm.id,
        label: item.taxonomyTerm.label,
      })) || [],
    communitiesServed:
      org.organizationsTerms?.map((item) => ({
        id: item.taxonomyTerm.id,
        label: item.taxonomyTerm.label,
      })) || [],
    strategies:
      org.organizationsStrategies?.map((item) => ({
        id: item.taxonomyTerm.id,
        label: item.taxonomyTerm.label,
      })) || [],
    networkOrganization: org.networkOrganization || false,
  };
};

export const UpdateOrganizationForm = ({
  profile,
  onSuccess,
  className,
}: UpdateOrganizationFormProps) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  // Initialize form data from profile
  const initialData = transformOrganizationToFormData(profile);

  // Initialize images from profile
  const [profileImage, setProfileImage] = useState<ImageData | undefined>(
    profile.avatarImage
      ? {
          url: profile.avatarImage.url || '',
          id: profile.avatarImage.id,
        }
      : undefined,
  );
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>(
    profile.headerImage
      ? {
          url: profile.headerImage.url || '',
          id: profile.headerImage.id,
        }
      : undefined,
  );

  const uploadAvatarImage = trpc.organization.uploadAvatarImage.useMutation();
  const uploadImage = trpc.organization.uploadAvatarImage.useMutation();
  const updateOrganization = trpc.organization.update.useMutation();

  const form = useAppForm({
    defaultValues: initialData,
    validators: {
      onSubmit: organizationFormValidator,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateOrganization.mutateAsync({
          id: profile.id,
          ...value,
          orgAvatarImageId: profileImage?.id,
          orgBannerImageId: bannerImage?.id,
        });

        // Invalidate relevant queries
        await utils.organization.getBySlug.invalidate({ slug: profile.slug });

        onSuccess();
      } catch (error) {
        console.error('Failed to update organization:', error);
      }
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className={cn('w-full', className)}
    >
      <FormContainer>

        <OrganizationFormFields
          form={form}
          profileImage={profileImage}
          setProfileImage={setProfileImage}
          bannerImage={bannerImage}
          setBannerImage={setBannerImage}
        />

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <Button color="secondary" type="button" onPress={() => onSuccess()}>
            {t('Cancel')}
          </Button>
          <form.SubmitButton isDisabled={updateOrganization.isPending}>
            {updateOrganization.isPending ? (
              <LoadingSpinner />
            ) : (
              t('Update Organization')
            )}
          </form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
