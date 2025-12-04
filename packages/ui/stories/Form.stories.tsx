import type { Meta } from '@storybook/react';

import { Button } from '../src/components/Button';
import { Form } from '../src/components/Form';
import { TextField } from '../src/components/TextField';

const meta: Meta<typeof Form> = {
  component: Form,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <Form {...args}>
    <TextField label="Email" name="email" type="email" isRequired />
    <TextField label="Name" name="name" isRequired />
    <div className="flex gap-2">
      <Button type="submit">Submit</Button>
      <Button type="reset">Reset</Button>
    </div>
  </Form>
);
