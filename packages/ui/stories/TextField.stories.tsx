import type { Meta } from '@storybook/react-vite';
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

export const WithCharacterLimit = () => (
  <div className="flex w-96 flex-col gap-8">
    <TextField
      label="Title"
      description="Enter a title"
      maxLength={50}
      inputProps={{ placeholder: 'Placeholder' }}
    />
    <TextField
      label="Description"
      description="Enter a description"
      maxLength={250}
      useTextArea
      textareaProps={{ placeholder: 'Placeholder' }}
    />
    <TextField
      label="With error"
      maxLength={50}
      errorMessage="This field is required"
      inputProps={{ placeholder: 'Placeholder' }}
    />
    <TextField
      label="With error and helper text"
      description="Enter a title"
      maxLength={50}
      errorMessage="This field is required"
      inputProps={{ placeholder: 'Placeholder' }}
    />
    <TextField
      label="Disabled"
      description="Helper text"
      maxLength={50}
      isDisabled
      inputProps={{ placeholder: 'Placeholder' }}
    />
  </div>
);
