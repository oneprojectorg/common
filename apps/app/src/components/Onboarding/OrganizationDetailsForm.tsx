import { z } from 'zod';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { getFieldErrorMessage, StepProps, useAppForm } from '../form/utils';

export const validator = z.object({
  organizationName: z
    .string()
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  website: z
    .string()
    .url({ message: 'Invalid website address' })
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(20, { message: 'Must be at most 20 characters' }),
});

export const OrganizationDetailsForm = ({
  defaultValues,
  resolver,
  onSubmit,
}: StepProps) => {
  const form = useAppForm({
    defaultValues,
    validators: {
      onChange: resolver,
    },
    onSubmit: ({ value }) => {
      console.log('SUBMIT >>>>');
      console.log(JSON.stringify(value, null, 2));
      onSubmit(value);
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
        <FormHeader text="Add your organization’s details">
          We've pre-filled information about Solidarity Seeds. Please review and
          make any necessary changes.
        </FormHeader>
        <form.AppField
          name="organizationName"
          children={(field) => (
            <field.TextField
              label="Organization name"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.AppField
          name="website"
          children={(field) => (
            <field.TextField
              label="Website"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              label="Email"
              isRequired
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.SubmitButton>Finish</form.SubmitButton>
      </FormContainer>
    </form>
  );
};
