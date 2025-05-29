import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useAppForm } from '../form/utils';
import { OrganizationFormFields } from './shared/OrganizationFormFields';
import { organizationFormValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';

interface ImageData {
  url: string;
  path?: string;
  id?: string;
}

export const OrganizationDetailsForm = ({
  onNext,
  onBack,
  className,
}: StepProps & { className?: string }) => {
  const organizationDetails = useOnboardingFormStore(
    (s) => s.organizationDetails,
  );
  const setOrganizationDetails = useOnboardingFormStore(
    (s) => s.setOrganizationDetails,
  );
  const t = useTranslations();
  // Hydrate images from store if present
  const [profileImage, setProfileImage] = useState<ImageData | undefined>(
    organizationDetails?.profileImage,
  );
  const [bannerImage, setBannerImage] = useState<ImageData | undefined>(
    organizationDetails?.bannerImage,
  );


  const form = useAppForm({
    defaultValues: organizationDetails,
    validators: {
      onSubmit: organizationFormValidator,
    },
    onSubmit: ({ value }) => {
      setOrganizationDetails({ ...value, profileImage, bannerImage }); // Persist to store on submit
      onNext({
        ...value,
        orgAvatarImageId: profileImage?.id,
        orgBannerImageId: bannerImage?.id,
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer>
        <FormHeader text={t('Add your organization’s details')}>
          {t("We've pre-filled information about [ORGANIZATION].")}
          <br />
          {t('Please review and make any necessary changes.')}
        </FormHeader>
        <OrganizationFormFields
          form={form}
          profileImage={profileImage}
          setProfileImage={setProfileImage}
          bannerImage={bannerImage}
          setBannerImage={setBannerImage}
        />

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.Button color="secondary" onPress={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
