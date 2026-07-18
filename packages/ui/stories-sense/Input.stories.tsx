import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Input> = {
  title: 'Sense/Primitives/Input',
  component: Input,
  decorators: [withSense],
  tags: ['autodocs'],
  args: {
    placeholder: 'Enter text',
  },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => <Input {...args} className="max-w-sm" />,
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="input-username">Username</Label>
      <Input id="input-username" placeholder="Matt Wierzbicki" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Input placeholder="Matt Wierzbicki" disabled className="max-w-sm" />
  ),
};

export const Invalid: Story = {
  render: () => (
    <Input
      placeholder="Matt Wierzbicki"
      aria-invalid="true"
      className="max-w-sm"
    />
  ),
};

export const File: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="input-file">Upload file</Label>
      <Input id="input-file" type="file" />
    </div>
  ),
};
