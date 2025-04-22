import { z } from 'zod';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';

import type { StepProps } from '../form/utils';

export const validator = z.object({
  fullName: z
    .string()
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  title: z
    .string()
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
});

export const PersonalDetailsForm = ({ defaultValues, resolver }: StepProps) => {
  const { onNext } = useMultiStep();
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
        <FormHeader text="Add your personal details">
          Tell us about yourself so others can find you.
        </FormHeader>
        <div className="flex flex-col gap-4">
          <form.AppField
            name="fullName"
            children={(field) => (
              <field.TextField
                label="Full Name"
                isRequired
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
              />
            )}
          />
          <form.AppField
            name="title"
            children={(field) => (
              <field.TextField
                label="Professional title"
                isRequired
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
                errorMessage={getFieldErrorMessage(field)}
              />
            )}
          />
        </div>
        <form.SubmitButton>Continue</form.SubmitButton>
      </FormContainer>
    </form>
  );
};
