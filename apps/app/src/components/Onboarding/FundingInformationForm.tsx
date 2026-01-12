import { zodUrl } from '@op/common/validation';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { ToggleButton } from '@op/ui/ToggleButton';
import { LuLink } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import type { StepProps } from '../MultiStepForm';
import { TermsMultiSelect } from '../TermsMultiSelect';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';
import { multiSelectOptionValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export const validator = z.object({
  isReceivingFunds: z.boolean().prefault(false).optional(),
  isOfferingFunds: z.boolean().prefault(false).optional(),
  acceptingApplications: z.boolean().prefault(false).optional(),
  receivingFundsDescription: z
    .string()
    .max(200, {
      error: 'Must be at most 200 characters',
    })
    .optional(),
  receivingFundsTerms: z.array(multiSelectOptionValidator).optional(),
  receivingFundsLink: zodUrl({
    error: 'Enter a valid website address',
  }),
  offeringFundsTerms: z.array(multiSelectOptionValidator).optional(),
  offeringFundsDescription: z
    .string()
    .max(200, {
      error: 'Must be at most 200 characters',
    })
    .optional(),
  offeringFundsLink: zodUrl({
    error: 'Enter a valid website address',
  }),
});

export const FundingInformationForm = ({
  onNext,
  onBack,
  className,
}: StepProps & { className?: string }) => {
  const fundingInformation = useOnboardingFormStore(
    (s) => s.fundingInformation,
  );
  const setFundingInformation = useOnboardingFormStore(
    (s) => s.setFundingInformation,
  );
  const t = useTranslations();

  const form = useAppForm({
    defaultValues: fundingInformation,
    validators: {
      onBlur: validator,
    },
    onSubmit: ({ value }) => {
      setFundingInformation(value); // Persist to store on submit
      onNext(value);
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
      <FormContainer className="max-w-lg">
        <FormHeader text={t('Funding information')}>
          {t(
            'Specify if your organization is currently seeking funding and offers funding.',
          )}
        </FormHeader>

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
                        <span className="text-sm text-neutral-gray4">
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
                      <div className="flex flex-col gap-4">
                        <form.AppField
                          name="offeringFundsTerms"
                          children={(field) => (
                            <TermsMultiSelect
                              taxonomy="necFunding"
                              value={(field.state.value as Array<Option>) ?? []}
                              label={t(
                                'What types of funding are you offering?',
                              )}
                              onChange={field.handleChange}
                              errorMessage={getFieldErrorMessage(field)}
                            />
                          )}
                        />

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
                                  placeholder: acceptingApplicationsField.state
                                    .value
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
