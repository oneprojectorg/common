import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuType } from 'react-icons/lu';

import { CollapsibleConfigCard } from '@/components/CollapsibleConfigCard';

const meta: Meta<typeof CollapsibleConfigCard> = {
  title: 'shadcn/CollapsibleConfigCard',
  component: CollapsibleConfigCard,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CollapsibleConfigCard>;

export const Static: Story = {
  args: {
    icon: LuType,
    label: 'Short text',
    badgeLabel: 'Required',
  },
  render: (args) => (
    <CollapsibleConfigCard {...args}>
      <div className="pt-2">Card body content</div>
    </CollapsibleConfigCard>
  ),
};

export const Collapsible: Story = {
  args: {
    icon: LuType,
    label: 'Short text',
    badgeLabel: 'Optional',
    isCollapsible: true,
    defaultExpanded: true,
  },
  render: (args) => (
    <CollapsibleConfigCard {...args}>
      <div>Body shows when expanded</div>
    </CollapsibleConfigCard>
  ),
};

export const Locked: Story = {
  args: {
    icon: LuType,
    label: 'Title field',
    locked: true,
  },
  render: (args) => (
    <CollapsibleConfigCard {...args}>
      <div>Locked card body</div>
    </CollapsibleConfigCard>
  ),
};
