import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { OrganizationFormFields } from './shared/OrganizationFormFields';
import { useOnboardingFormStore } from './useOnboardingFormStore';

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

  return (
    <OrganizationFormFields
      defaultValues={organizationDetails}
      initialProfileImage={organizationDetails?.profileImage}
      initialBannerImage={organizationDetails?.bannerImage}
      onSubmit={(data) => {
        setOrganizationDetails(data);
        onNext(data);
      }}
    >
      {({ form, formFields }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className={className}
        >
          <FormContainer className="max-w-lg">
            <FormHeader text={t("Add your organization's details")} />

            {formFields}

            <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
              <form.Button color="secondary" onPress={onBack}>
                {t('Back')}
              </form.Button>
              <form.SubmitButton>{t('Continue')}</form.SubmitButton>
            </div>
          </FormContainer>
        </form>
      )}
    </OrganizationFormFields>
  );
};
