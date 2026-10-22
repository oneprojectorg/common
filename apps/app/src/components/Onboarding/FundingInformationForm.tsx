import { zodUrl } from '@op/common/validation';
import type { ComponentProps } from 'react';
import { LuLink } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import type { TranslateFn } from '@/lib/i18n';

import type { StepProps } from '../MultiStepForm';
import { TermsMultiSelect } from '../TermsMultiSelect';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';
import { multiSelectOptionValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';

// `TermsMultiSelect` still owns the option shape; derive it from that
// component's props rather than redeclaring it.
type Option = NonNullable<
  ComponentProps<typeof TermsMultiSelect>['value']
>[number];

const createFundingValidator = (t: TranslateFn) =>
  z.object({
    isReceivingFunds: z.boolean().prefault(false).optional(),
    isOfferingFunds: z.boolean().prefault(false).optional(),
    acceptingApplications: z.boolean().prefault(false).optional(),
    receivingFundsDescription: z
      .string()
      .max(200, {
        error: t('maxLength200Error'),
      })
      .optional(),
    receivingFundsTerms: z.array(multiSelectOptionValidator).optional(),
    receivingFundsLink: zodUrl({
      error: t('validWebsiteError'),
    }),
    offeringFundsTerms: z.array(multiSelectOptionValidator).optional(),
    offeringFundsDescription: z
      .string()
      .max(200, {
        error: t('maxLength200Error'),
      })
      .optional(),
    offeringFundsLink: zodUrl({
      error: t('validWebsiteError'),
    }),
  });

// Static validator for type inference and external schema composition.
// Must mirror createFundingValidator's structure (without translated error messages).
export const validator = z.object({
  isReceivingFunds: z.boolean().prefault(false).optional(),
  isOfferingFunds: z.boolean().prefault(false).optional(),
  acceptingApplications: z.boolean().prefault(false).optional(),
  receivingFundsDescription: z.string().max(200).optional(),
  receivingFundsTerms: z.array(multiSelectOptionValidator).optional(),
  receivingFundsLink: zodUrl({ error: 'Enter a valid website address' }),
  offeringFundsTerms: z.array(multiSelectOptionValidator).optional(),
  offeringFundsDescription: z.string().max(200).optional(),
  offeringFundsLink: zodUrl({ error: 'Enter a valid website address' }),
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
      onBlur: createFundingValidator(t),
    },
    onSubmit: ({ value }) => {
      setFundingInformation(value); // Persist to store on submit
      onNext(value);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className={className}
    >
      <FormContainer className="max-w-lg">
        <FormHeader text={t('onboarding.fundingTitle')}>
          {t('onboarding.fundingSubtitle')}
        </FormHeader>

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
                        <span className="text-sm text-muted-foreground">
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
                      <div className="flex flex-col gap-4">
                        <form.AppField
                          name="offeringFundsTerms"
                          children={(field) => (
                            <TermsMultiSelect
                              taxonomy="necFunding"
                              value={(field.state.value as Array<Option>) ?? []}
                              label={t('onboarding.fundingOfferedLabel')}
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

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <form.Button variant="secondary" onClick={onBack}>
            {t('Back')}
          </form.Button>
          <form.SubmitButton>{t('Continue')}</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
