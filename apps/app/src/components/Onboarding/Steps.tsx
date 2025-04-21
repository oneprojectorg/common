import { createFormHook, createFormHookContexts } from '@tanstack/react-form';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';

import { Header1 } from '../Header';

import type { ReactNode } from 'react';

const { fieldContext, formContext } = createFormHookContexts();
const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
  },
  formComponents: {
    Button,
    SubmitButton: (props) => <Button {...props} type="submit" />,
  },
  fieldContext,
  formContext,
});

interface StepProps {
  defaultValues: object;
  resolver?: any;
  onSubmit: (values: object) => void;
}

const getFieldErrorMessage = (field) => {
  return field.state.meta.errors
    .map((err: { message: string }) => err?.message)
    .join(', ');
};

const FormContainer = ({ children }: { children: ReactNode }) => {
  return <div className="flex flex-col gap-4">{children}</div>;
};

const FormHeader = ({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-4">
    <Header1 className="text-center">{text}</Header1>

    <p className="text-center text-midGray">{children}</p>
  </div>
);

export const PersonalDetailsForm = ({
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
        <Button type="submit">Continue</Button>
      </FormContainer>
    </form>
  );
};

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
        <Button type="submit">Finish</Button>
      </FormContainer>
    </form>
  );
};
