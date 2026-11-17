import { Badge, BadgeNumber, type BadgeSize } from '@op/sense/Badge';
import { Card, CardHeader, CardTitle } from '@op/sense/Card';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCheck, LuTriangleAlert } from 'react-icons/lu';

const sizes: BadgeSize[] = ['default', 'md', 'lg'];

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
        'success',
        'accent',
        'outline',
        'ghost',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: sizes,
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
      <Badge variant="success">Success</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="ghost">Ghost</Badge>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {sizes.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-4">
          <span className="w-16 shrink-0 text-sm text-muted-foreground">
            {size}
          </span>
          <Badge size={size}>Budget</Badge>
          <Badge size={size} variant="secondary">
            Ranked voting
          </Badge>
          <Badge size={size} variant="success">
            <LuCheck data-icon="inline-start" />
            Verified
          </Badge>
          <BadgeNumber size={size}>8</BadgeNumber>
          <BadgeNumber size={size} variant="outline">
            20+
          </BadgeNumber>
        </div>
      ))}
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
