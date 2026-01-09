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
  <div className="w-96 gap-8 flex flex-col">
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
  <Form className="gap-2 flex flex-col items-start">
    <TextField {...args} />

    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};
