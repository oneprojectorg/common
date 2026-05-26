import type { Meta, StoryObj } from '@storybook/react-vite';

import { SocialLinks, SocialLinksFooter } from '@/components/SocialLinks';

const meta: Meta<typeof SocialLinks> = {
  title: 'shadcn/SocialLinks',
  component: SocialLinks,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SocialLinks>;

export const Default: Story = {
  render: () => <SocialLinks iconClassName="size-5" />,
};

export const Footer: Story = {
  render: () => <SocialLinksFooter className="text-muted-foreground" />,
};
