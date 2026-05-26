import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  AvatarSkeleton,
} from '@/components/Avatar';

const meta = {
  title: 'shadcn/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initial: Story = {
  args: { placeholder: 'Nour', size: 'md' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar size="sm" placeholder="A" />
      <Avatar size="md" placeholder="B" />
      <Avatar size="lg" placeholder="C" />
    </div>
  ),
};

export const FullText: Story = {
  args: { placeholder: 'OP', size: 'lg', showFullText: true },
};

export const WithImage: Story = {
  render: () => (
    <Avatar placeholder="Nour" size="lg">
      <AvatarImage src="https://avatars.githubusercontent.com/u/0" alt="" />
      <AvatarFallback>NM</AvatarFallback>
    </Avatar>
  ),
};

export const ShadcnComposition: Story = {
  name: 'Shadcn composition (preferred for new code)',
  render: () => (
    <Avatar>
      <AvatarImage src="https://avatars.githubusercontent.com/u/0" alt="" />
      <AvatarFallback>NM</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  name: 'AvatarGroup',
  render: () => (
    <AvatarGroup>
      <Avatar placeholder="A" />
      <Avatar placeholder="B" />
      <Avatar placeholder="C" />
      <AvatarGroupCount>+5</AvatarGroupCount>
    </AvatarGroup>
  ),
};

export const SkeletonState: Story = {
  name: 'Skeleton',
  render: () => <AvatarSkeleton size="md" />,
};
