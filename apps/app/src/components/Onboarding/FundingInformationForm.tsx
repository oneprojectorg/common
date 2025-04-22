import { z } from 'zod';

import { ToggleButton } from '@op/ui/ToggleButton';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { useAppForm } from '../form/utils';
import { ToggleRow } from '../layout/split/form/ToggleRow';

import type { StepProps } from '../form/utils';

export const validator = z.object({
  isReceivingFunds: z.boolean().default(false),
  isOfferingFunds: z.boolean().default(false),
  acceptingApplications: z.boolean().default(false),
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
            <ToggleRow>
              Is your organization seeking funding?
              <ToggleButton />
            </ToggleRow>
          )}
        />
        <form.AppField
          name="isOfferingFunds"
          children={(field) => (
            <ToggleRow>
              Does your organization offer funding?
              <ToggleButton />
            </ToggleRow>
          )}
        />
        <form.AppField
          name="acceptingApplications"
          children={(field) => (
            <ToggleRow>
              Are organizations currently able to apply for funding?
              <ToggleButton />
            </ToggleRow>
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
