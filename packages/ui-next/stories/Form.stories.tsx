import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/Button';
import { Form } from '@/components/Form';
import { TextField } from '@/components/TextField';

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
      <TextField label="Name" placeholder="Jane Doe" />
      <TextField label="Email" type="email" placeholder="jane@example.com" />
      <Button type="submit">Submit</Button>
    </Form>
  ),
};
