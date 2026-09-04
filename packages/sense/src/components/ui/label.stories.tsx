import { Checkbox } from '@op/sense/Checkbox';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Label> = {
  title: 'Primitives/Label',
  component: Label,
  tags: ['autodocs'],
  args: {
    children: 'Email address',
  },
};

export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const WithInput: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="label-email">Email address</Label>
      <Input id="label-email" type="email" placeholder="hi@example.com" />
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="label-terms" />
      <Label htmlFor="label-terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const Required: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="label-required">
        Username <span className="text-destructive">*</span>
      </Label>
      <Input id="label-required" placeholder="This field is required" />
    </div>
  ),
};

export const DisabledPeer: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="label-disabled" disabled />
      <Label htmlFor="label-disabled">Accept terms and conditions</Label>
    </div>
  ),
};
