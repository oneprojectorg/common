import { createFormHook, createFormHookContexts } from '@tanstack/react-form';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';

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

export const Step = ({ defaultValues, resolver, onSubmit }: StepProps) => {
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
      className="flex flex-col gap-4"
    >
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
      <Button type="submit">Next</Button>
    </form>
  );
};

export const Step2 = ({ defaultValues, resolver, onSubmit }: StepProps) => {
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
      className="flex flex-col gap-4"
    >
      <form.AppField
        name="dog"
        children={(field) => (
          <field.TextField
            label="Dog"
            isRequired
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
          />
        )}
      />
      <form.AppField
        name="cat"
        children={(field) => (
          <field.TextField
            label="Cat"
            isRequired
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={field.handleChange}
            errorMessage={getFieldErrorMessage(field)}
          />
        )}
      />
      <Button type="submit">Next</Button>
    </form>
  );
};
