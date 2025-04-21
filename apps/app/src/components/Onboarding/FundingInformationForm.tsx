import { z } from 'zod';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { useAppForm } from '../form/utils';

import type { StepProps } from '../form/utils';
import { ToggleButton } from '@op/ui/ToggleButton';

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
            <div className="flex gap-4">
              Is your organization seeking funding?
              <ToggleButton />
            </div>
          )}
        />
        <form.AppField
          name="isOfferingFunds"
          children={(field) => (
            <div className="flex gap-4">
              Does your organization offer funding?
              <ToggleButton />
            </div>
          )}
        />
        <form.AppField
          name="acceptingApplications"
          children={(field) => (
            <div className="flex gap-4">
              Are organizations currently able to apply for funding?
              <ToggleButton />
            </div>
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
