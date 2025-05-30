'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import { useRouter } from 'next/navigation';
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
const transformOrganizationToFormData = (org: Organization, terms?: any) => {
  // Extract focus areas and communities served from terms
  const focusAreas = terms?.['necSimple:focusArea'] || [];
  const communitiesServed = terms?.['candid:POPULATION'] || [];

  return {
    name: org.name || '',
    website: org.website || '',
    email: org.email || '',
    orgType: org.orgType || '',
    bio: org.bio || '',
    mission: org.mission || '',
    whereWeWork:
      org.whereWeWork?.map((item) => {
        return {
          id: item.id,
          label: item.label,
          data: item.data || {},
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
    strategies:
      org.strategies?.map((item) => {
        return {
          id: item.id,
          label: item.label,
        };
      }) || [],
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
  const router = useRouter();

  // Fetch organization terms for focus areas and communities served
  const { data: terms } = trpc.organization.getTerms.useQuery({
    id: profile.id,
  });

  // Initialize form data from profile and terms
  const initialData = transformOrganizationToFormData(profile, terms);

  // Initialize images from profile
  const [profileImage, setProfileImage] = useState<ImageData | undefined>(
    profile.avatarImage
      ? {
          url: getPublicUrl(profile.avatarImage.name) || '',
          id: profile.avatarImage.id,
        }
      : undefined,
  );
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>(
    profile.headerImage
      ? {
          url: getPublicUrl(profile.headerImage.name) || '',
          id: profile.headerImage.id,
        }
      : undefined,
  );

  const updateOrganization = trpc.organization.update.useMutation();

  const form = useAppForm({
    defaultValues: initialData,
    validators: {
      // @ts-expect-error - We need to refactor this for tanstack form's type inference
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
        router.refresh();

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
      className="w-full"
    >
      <FormContainer className={className}>
        <OrganizationFormFields
          form={form}
          profileImage={profileImage}
          setProfileImage={setProfileImage}
          bannerImage={bannerImage}
          setBannerImage={setBannerImage}
        />
      </FormContainer>

      <ModalFooter>
        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.SubmitButton
            className="max-w-fit"
            isDisabled={updateOrganization.isPending}
          >
            {updateOrganization.isPending ? <LoadingSpinner /> : t('Save')}
          </form.SubmitButton>
        </div>
      </ModalFooter>
    </form>
  );
};
