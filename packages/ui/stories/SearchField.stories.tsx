import type { Meta } from '@storybook/react-vite';
import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { SearchField } from '../src/components/SearchField';

const meta: Meta<typeof SearchField> = {
  component: SearchField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Search',
  },
};

export default meta;

export const Example = (args: any) => <SearchField {...args} />;

export const Validation = (args: any) => (
  <Form className="gap-2 flex flex-col items-start">
    <SearchField {...args} />
    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};
