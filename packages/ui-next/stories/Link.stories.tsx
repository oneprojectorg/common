import type { Meta, StoryObj } from '@storybook/react-vite';

import { Link } from '@/components/Link';

const meta = {
  title: 'shadcn/Link',
  component: Link,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { href: '#', variant: 'primary', children: 'Primary link' },
};

export const Secondary: Story = {
  args: { href: '#', variant: 'secondary', children: 'Secondary link' },
};

export const Neutral: Story = {
  args: { href: '#', variant: 'neutral', children: 'Neutral link' },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Link href="#">Primary link</Link>
      <Link variant="secondary" href="#">
        Secondary link
      </Link>
      <Link variant="neutral" href="#">
        Neutral link
      </Link>
    </div>
  ),
};
