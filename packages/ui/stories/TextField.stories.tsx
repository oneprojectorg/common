import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';

const meta: Meta<typeof TextField> = {
  component: TextField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Name',
  },
};

export default meta;

export const Example = () => (
  <div className="flex w-96 flex-col gap-8">
    <TextField
      inputProps={{ placeholder: 'Placeholder' }}
      description="Helper text"
      label="Normal state"
    />
    <TextField
      isDisabled
      label="Disabled state"
      isRequired
      inputProps={{ placeholder: 'Placeholder' }}
    />

    <TextField
      useTextArea
      label="Disabled state"
      description="Helper text"
      isRequired
      inputProps={{ placeholder: 'Placeholder' }}
    />

    <TextField
      isDisabled
      useTextArea
      label="Disabled state"
      isRequired
      inputProps={{ placeholder: 'Placeholder' }}
    />
  </div>
);

export const Validation = (args: any) => (
  <Form className="flex flex-col items-start gap-2">
    <TextField {...args} />

    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};

const ValidatedTextField = () => {
  const [error, setError] = useState<string | undefined>(
    'This field is required',
  );

  return (
    <TextField
      label="With error and helper text"
      description="Enter a title"
      maxLength={50}
      errorMessage={error}
      onChange={(value) => {
        setError(value ? undefined : 'This field is required');
      }}
      inputProps={{ placeholder: 'Placeholder' }}
    />
  );
};

export const WithCharacterLimit = () => (
  <div className="flex w-128 flex-col gap-16 p-4">
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-title-sm">Character limit only</h3>
      <TextField
        label="Simple field"
        maxLength={50}
        inputProps={{ placeholder: 'Placeholder' }}
      />
    </div>
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-title-sm">
        Character limit with helper text
      </h3>
      <TextField
        label="Title"
        description="Enter a title"
        maxLength={50}
        inputProps={{ placeholder: 'Placeholder' }}
      />
    </div>
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-title-sm">Character limit on textarea</h3>
      <TextField
        label="Description"
        description="Enter a description"
        maxLength={250}
        useTextArea
        textareaProps={{ placeholder: 'Placeholder' }}
      />
    </div>
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-title-sm">Character limit with error</h3>
      <TextField
        label="With error"
        maxLength={50}
        errorMessage="This field is required"
        inputProps={{ placeholder: 'Placeholder' }}
      />
    </div>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-title-sm">
          Character limit with error and helper text
        </h3>
        <p className="text-sm text-neutral-charcoal">
          Note that the helper text is replaced by the error message. But when a
          value is entered, the error message is replaced by the helper text.
        </p>
      </div>
      <ValidatedTextField />
    </div>
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-title-sm">
        Character limit on disabled field
      </h3>
      <TextField
        label="Disabled"
        description="Helper text"
        maxLength={50}
        isDisabled
        inputProps={{ placeholder: 'Placeholder' }}
      />
    </div>
  </div>
);
