'use client';

import { getPublicUrl } from '@/utils';
import { trpc } from '@op/api/client';
import type { Organization } from '@op/api/encoders';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ModalFooter } from '@op/ui/Modal';
import { useRouter } from 'next/navigation';
import { forwardRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type ImageData,
  OrganizationFormFields,
} from '../../Onboarding/shared/OrganizationFormFields';
import { FormContainer } from '../../form/FormContainer';

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

  return (
    <OrganizationFormFields
      defaultValues={initialData}
      initialProfileImage={initialProfileImage}
      initialBannerImage={initialBannerImage}
      onSubmit={async (data) => {
        try {
          await updateOrganization.mutateAsync({
            id: profile.id,
            ...data,
          });

          // Invalidate relevant queries
          await utils.organization.getBySlug.invalidate({ slug: profile.profile.slug });
          router.refresh();

          onSuccess();
        } catch (error) {
          console.error('Failed to update organization:', error);
        }
      }}
    >
      {({ form, isSubmitting, formFields }) => (
        <form
          ref={ref}
          id="update-organization-form"
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="w-full"
        >
          <FormContainer className={className}>{formFields}</FormContainer>

          <ModalFooter className="hidden sm:flex">
            <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
              <form.SubmitButton
                className="max-w-fit"
                isDisabled={isSubmitting || updateOrganization.isPending}
              >
                {isSubmitting || updateOrganization.isPending ? (
                  <LoadingSpinner />
                ) : (
                  t('Save')
                )}
              </form.SubmitButton>
            </div>
          </ModalFooter>
        </form>
      )}
    </OrganizationFormFields>
  );
});

UpdateOrganizationForm.displayName = 'UpdateOrganizationForm';
