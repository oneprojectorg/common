import { zodUrl } from '@/utils';
import { ToggleButton } from '@op/ui/ToggleButton';
import { LuLink } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import type { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export const validator = z.object({
  isReceivingFunds: z.boolean().default(false).optional(),
  isOfferingFunds: z.boolean().default(false).optional(),
  acceptingApplications: z.boolean().default(false).optional(),
  receivingFundsDescription: z
    .string()
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  receivingFundsLink: zodUrl({ message: 'Enter a valid website address' }),
  offeringFundsDescription: z.string().optional(),
  offeringFundsLink: zodUrl({ message: 'Enter a valid website address' }),
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
      <FormContainer>
        <FormHeader text="Funding information">
          Specify if your organization is currently seeking funding and offers
          funding.
        </FormHeader>

        <form.AppField
          name="isReceivingFunds"
          children={(field) => (
            <>
              <ToggleRow>
                <span>
                  Is your organization <i>seeking</i> funding?
                </span>

                <ToggleButton
                  isSelected={field.state.value as boolean}
                  onChange={field.handleChange}
                />
              </ToggleRow>
              {field.state.value ? (
                <div className="flex flex-col gap-4">
                  <form.AppField
                    name="receivingFundsDescription"
                    children={(field) => (
                      <field.TextField
                        useTextArea
                        label="What types of funding are you seeking?"
                        value={field.state.value as string}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                        errorMessage={getFieldErrorMessage(field)}
                        textareaProps={{
                          className: 'min-h-32',
                          placeholder:
                            'Enter a description of the type of funding you’re seeking (e.g., grants, integrated capital, etc.',
                        }}
                      />
                    )}
                  />

                  <form.AppField
                    name="receivingFundsLink"
                    children={(field) => (
                      <div className="flex flex-col gap-2">
                        <field.TextField
                          label="Where can people contribute to your organization?"
                          value={field.state.value as string}
                          onBlur={field.handleBlur}
                          onChange={field.handleChange}
                          errorMessage={getFieldErrorMessage(field)}
                          inputProps={{
                            icon: (
                              <LuLink className="size-4 text-neutral-black" />
                            ),
                            placeholder: 'Add your contribution page here',
                          }}
                        />
                        <span className="text-xs text-darkGray">
                          Add a link to your donation page, Open Collective,
                          GoFundMe or any platform where supporters can
                          contribute or learn more about how.
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
                <span>
                  Does your organization <i>offer</i> funding?
                </span>
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
                        Are organizations currently able to apply for funding?
                        <ToggleButton
                          isSelected={
                            acceptingApplicationsField.state.value as boolean
                          }
                          onChange={acceptingApplicationsField.handleChange}
                        />
                      </ToggleRow>
                      <div className="flex flex-col gap-4">
                        <form.AppField
                          name="offeringFundsDescription"
                          children={(field) => (
                            <field.TextField
                              useTextArea
                              label="What is your funding process?"
                              value={field.state.value as string}
                              onBlur={field.handleBlur}
                              onChange={field.handleChange}
                              errorMessage={getFieldErrorMessage(field)}
                              textareaProps={{
                                className: 'min-h-32',
                                placeholder:
                                  'Enter a description of the type of funding you’re seeking (e.g., grants, integrated capital, etc.)',
                              }}
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
                                    ? 'Where can organizations apply?'
                                    : 'Where can organizations learn more?'
                                }
                                value={field.state.value as string}
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                errorMessage={getFieldErrorMessage(field)}
                                inputProps={{
                                  placeholder: acceptingApplicationsField.state
                                    .value
                                    ? 'Add a link where organizations can apply for funding'
                                    : 'Add a link to learn more about your funding process',
                                  icon: (
                                    <LuLink className="size-4 text-neutral-black" />
                                  ),
                                }}
                              />
                              <span className="text-xs text-darkGray">
                                {acceptingApplicationsField.state.value
                                  ? null
                                  : `Add a link where others can learn more about how
                                to they might receive funding from your
                                organization now or in the future.`}
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
            Back
          </form.Button>
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
