import type { Meta } from '@storybook/react';
import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { NumberField } from '../src/components/NumberField';

const meta: Meta<typeof NumberField> = {
  component: NumberField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Cookies',
  },
};

export default meta;

export const Example = (args: any) => <NumberField {...args} />;

export const Validation = (args: any) => (
  <Form className="flex flex-col items-start gap-2">
    <NumberField {...args} />
    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};
