import type { Meta } from '@storybook/react';
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

export const Example = (args: any) => (
  <div className="flex flex-col gap-2">
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
