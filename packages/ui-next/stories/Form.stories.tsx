import type { Meta, StoryObj } from '@storybook/react-vite';

import { Form } from '@/components/Form';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

const meta: Meta<typeof Form> = {
  title: 'shadcn/Form',
  component: Form,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Default: Story = {
  render: () => (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        console.log('submitted');
      }}
    >
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input placeholder="Jane Doe" />
      </Field>
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input type="email" placeholder="jane@example.com" />
      </Field>
      <Button type="submit">Submit</Button>
    </Form>
  ),
};
