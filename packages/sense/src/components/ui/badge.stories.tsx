import { Badge } from '@op/sense/Badge';
import { Card, CardHeader, CardTitle } from '@op/sense/Card';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCheck, LuTriangleAlert } from 'react-icons/lu';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'secondary',
        'destructive',
        'warning',
        'accent',
        'outline',
        'ghost',
        'link',
      ],
    },
  },
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge>
        <LuCheck />
        Verified
      </Badge>
      <Badge variant="destructive">
        <LuTriangleAlert className="text-destructive" />
        Alert
      </Badge>
    </div>
  ),
};

export const Count: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Badge className="min-w-5 rounded-full px-1">8</Badge>
      <Badge variant="outline" className="min-w-5 rounded-full px-1">
        20+
      </Badge>
    </div>
  ),
};

// Regression: the badge stays sans in a serif heading.
export const InSerifHeading: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Submissions
          <Badge variant="secondary">Now open</Badge>
        </CardTitle>
      </CardHeader>
    </Card>
  ),
};
