import { LuLink } from 'react-icons/lu';
import { z } from 'zod';

import { ToggleButton } from '@op/ui/ToggleButton';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';

import type { StepProps } from '../form/utils';

export const validator = z.object({
  isReceivingFunds: z.boolean().default(false),
  isOfferingFunds: z.boolean().default(false),
  acceptingApplications: z.boolean().default(false),
  receivingFundsDescription: z.string().optional(),
  receivingFundsLink: z.string().optional(),
  offeringFundsDescription: z.string().optional(),
  offeringFundsLink: z.string().optional(),
});

export const FundingInformationForm = ({
  defaultValues,
  resolver,
}: StepProps) => {
  const { onNext, onBack } = useMultiStep();
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: resolver,
    },
    onSubmit: ({ value }) => {
      console.log('SUBMIT >>>>');
      console.log(JSON.stringify(value, null, 2));
      // CREATE NEW ORGANIZATION!!
      onNext(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
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
                Is your organization seeking funding?
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
                            icon: <LuLink className="text-teal" />,
                            placeholder: 'Add your contribution page here',
                          }}
                        />
                        <span className="text-xs text-darkGray">
                          Add a link to your donation page, Open Collective,
                          GoFundMe or any platform where supporters can
                          contribute or learn more about how.
                        </span>
                        <hr className="mt-6" />
                      </div>
                    )}
                  />
                </div>
              ) : null}
            </>
          )}
        />
        <form.AppField
          name="isOfferingFunds"
          children={(field) => (
            <>
              <ToggleRow>
                Does your organization offer funding?
                <ToggleButton
                  isSelected={field.state.value as boolean}
                  onChange={field.handleChange}
                />
              </ToggleRow>
            </>
          )}
        />
        <form.AppField
          name="acceptingApplications"
          children={(field) => (
            <>
              <ToggleRow>
                Are organizations currently able to apply for funding?
                <ToggleButton
                  isSelected={field.state.value as boolean}
                  onChange={field.handleChange}
                />
              </ToggleRow>
              {field.state.value ? (
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
                          label="Where can organizations learn more?"
                          value={field.state.value as string}
                          onBlur={field.handleBlur}
                          onChange={field.handleChange}
                          errorMessage={getFieldErrorMessage(field)}
                          inputProps={{
                            placeholder:
                              'Add a link to learn more about your funding process',
                            icon: <LuLink className="text-teal" />,
                          }}
                        />
                        <span className="text-xs text-darkGray">
                          Add a link where others can learn more about how to
                          they might receive funding from your organization now
                          or in the future.
                        </span>
                        <hr className="mt-6" />
                      </div>
                    )}
                  />
                </div>
              ) : null}
            </>
          )}
        />
        <div className="flex justify-between">
          <form.Button color="secondary" onPress={onBack}>
            Back
          </form.Button>
          <form.SubmitButton>Finish</form.SubmitButton>
        </div>
      </FormContainer>
    </form>
  );
};
