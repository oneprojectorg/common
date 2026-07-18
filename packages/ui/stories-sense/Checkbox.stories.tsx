import { Checkbox } from '@op/sense/Checkbox';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Checkbox> = {
  title: 'Sense/Primitives/Checkbox',
  component: Checkbox,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checkbox-terms" />
      <Label htmlFor="checkbox-terms">Accept terms and conditions</Label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checkbox-checked" defaultChecked />
      <Label htmlFor="checkbox-checked">Email me about product updates</Label>
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-start gap-2">
      <Checkbox id="checkbox-notifications" defaultChecked className="mt-1" />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="checkbox-notifications">Enable notifications</Label>
        <p className="text-sm text-muted-foreground">
          You can enable or disable notifications at any time.
        </p>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox id="checkbox-disabled" disabled />
        <Label htmlFor="checkbox-disabled">Accept terms and conditions</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="checkbox-disabled-checked" disabled defaultChecked />
        <Label htmlFor="checkbox-disabled-checked">
          Email me about product updates
        </Label>
      </div>
    </div>
  ),
};

export const Invalid: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checkbox-invalid" aria-invalid="true" />
      <Label htmlFor="checkbox-invalid">Accept terms and conditions</Label>
    </div>
  ),
};
