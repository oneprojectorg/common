import { z } from 'zod';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useMultiStep } from '../form/multiStep';
import { getFieldErrorMessage, useAppForm } from '../form/utils';

import type { StepProps } from '../form/utils';

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
}: StepProps) => {
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

        <form.AppField
          name="whereWeWork"
          children={(field) => (
            <field.TextField
              label="Where we work"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.AppField
          name="organizationalStatus"
          children={(field) => (
            <field.TextField
              label="Organizational Status"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <field.TextField
              label="Bio"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <field.TextField
              label="Mission statement"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="focusAreas"
          children={(field) => (
            <field.TextField
              label="Focus Areas"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />

        <form.AppField
          name="communitesServed"
          children={(field) => (
            <field.TextField
              label="Communities Served"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
            />
          )}
        />
        <form.AppField
          name="strategies"
          children={(field) => (
            <field.TextField
              label="Strategies/Tactics"
              isRequired
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
