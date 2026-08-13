import { Label } from '@op/sense/Label';
import { Textarea } from '@op/sense/Textarea';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Textarea> = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    placeholder: 'Type your message here.',
  },
};

export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => <Textarea {...args} className="max-w-sm" />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="textarea-message">Your message</Label>
      <Textarea id="textarea-message" placeholder="Type your message here." />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Textarea
      placeholder="Type your message here."
      disabled
      className="max-w-sm"
    />
  ),
};

export const Invalid: Story = {
  render: () => (
    <Textarea
      placeholder="Type your message here."
      aria-invalid="true"
      className="max-w-sm"
    />
  ),
};
