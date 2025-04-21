import { z } from 'zod';

import { ListBox } from '@op/ui/ListBox';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';

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
    // .url({ message: 'Invalid website address' })
    .min(1, { message: 'Required' })
    .max(20, { message: 'Must be at most 20 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(20, { message: 'Must be at most 20 characters' }),
  type: z.string().max(20, { message: 'Must be at most 20 characters' }),
  bio: z.string().max(200, { message: 'Must be at most 200 characters' }),
  mission: z.string().max(200, { message: 'Must be at most 200 characters' }),
});

export const OrganizationDetailsForm = ({
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
            <ListBox
              label="Where we work"
              isRequired
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              selectionMode="multiple"
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </ListBox>
          )}
        />
        <form.AppField
          name="type"
          children={(field) => (
            <Select
              label="Organizational Status"
              placeholder="Select"
              selectedKey={field.state.value}
              onSelectionChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={getFieldErrorMessage(field)}
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </Select>
          )}
        />

        <form.AppField
          name="bio"
          children={(field) => (
            <TextField
              useTextArea
              label="Bio"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              textareaProps={{ className: 'min-h-28' }}
            />
          )}
        />

        <form.AppField
          name="mission"
          children={(field) => (
            <TextField
              useTextArea
              label="Mission statement"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              className="min-h-24"
            />
          )}
        />

        <form.AppField
          name="focusAreas"
          children={(field) => (
            <ListBox
              label="Focus Areas"
              placeholder="Select one or more"
              onSelectionChange={field.handleChange}
              onBlur={field.handleBlur}
              errorMessage={getFieldErrorMessage(field)}
              selectionMode="multiple"
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </ListBox>
          )}
        />

        <form.AppField
          name="communitesServed"
          children={(field) => (
            <ListBox
              label="Communities Served"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              selectionMode="multiple"
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </ListBox>
          )}
        />
        <form.AppField
          name="strategies"
          children={(field) => (
            <ListBox
              label="Strategies/Tactics"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              errorMessage={getFieldErrorMessage(field)}
              selectionMode="multiple"
            >
              <SelectItem id="nonprofit">Nonprofit</SelectItem>
              <SelectItem id="forprofit">Forprofit</SelectItem>
              <SelectItem id="government">Government Entity</SelectItem>
            </ListBox>
          )}
        />

        <form.AppField
          name="networkOrganization"
          children={(field) => (
            <div className="flex gap-4">
              Does your organization serve as a network or coalition with member
              organizations?
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
