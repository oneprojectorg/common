import { Label } from '@op/sense/Label';
import { Switch } from '@op/sense/Switch';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Switch> = {
  title: 'Sense/Primitives/Switch',
  component: Switch,
  decorators: [withSense],
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['default', 'sm'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="switch-airplane" />
      <Label htmlFor="switch-airplane">Airplane mode</Label>
    </div>
  ),
};

export const Checked: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Switch size="sm" defaultChecked />
      <Switch size="default" defaultChecked />
    </div>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <div className="flex items-start gap-3">
      <Switch id="switch-notifications" defaultChecked />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="switch-notifications">Notifications</Label>
        <p className="text-sm text-muted-foreground">
          Receive emails about new decisions and comments.
        </p>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Switch disabled />
      <Switch disabled defaultChecked />
    </div>
  ),
};
