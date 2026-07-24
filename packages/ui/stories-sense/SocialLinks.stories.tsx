import { SocialLinks } from '@op/sense/SocialLinks';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof SocialLinks> = {
  title: 'Sense/Composites/SocialLinks',
  component: SocialLinks,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SocialLinks>;

export const Default: Story = {
  render: () => <SocialLinks />,
};

export const Large: Story = {
  render: () => <SocialLinks iconClassName="size-6" />,
};
