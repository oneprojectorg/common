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

// `unstyled`: no chrome, no resize grip and no type size, so the field takes
// the type around it. One row, growing with the text.
export const Unstyled: Story = {
  render: () => (
    <div className="max-w-sm font-serif text-headline font-light">
      <Textarea
        unstyled
        rows={1}
        aria-label="Title"
        defaultValue="Reads as the heading it sits in"
      />
    </div>
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
