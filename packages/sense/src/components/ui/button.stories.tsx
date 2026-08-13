import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuChevronRight, LuMail } from 'react-icons/lu';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'destructive',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
      ],
    },
  },
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button>Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(
        [
          'default',
          'outline',
          'secondary',
          'ghost',
          'destructive',
          'link',
        ] as const
      ).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-4">
          <Button variant={variant} size="xs">
            Extra small
          </Button>
          <Button variant={variant} size="sm">
            Small
          </Button>
          <Button variant={variant} size="default">
            Default
          </Button>
          <Button variant={variant} size="lg">
            Large
          </Button>
          <Button variant={variant} size="icon-sm" aria-label="Mail">
            <LuMail />
          </Button>
          <Button variant={variant} size="icon" aria-label="Mail">
            <LuMail />
          </Button>
        </div>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button>
        <LuMail data-icon="inline-start" />
        Email
      </Button>
      <Button variant="outline">
        Continue
        <LuChevronRight data-icon="inline-end" />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>
        <Spinner data-icon="inline-start" />
        Loading
      </Button>
      <Button variant="outline" disabled>
        <Spinner data-icon="inline-start" />
        Loading
      </Button>
      <Button variant="destructive" size="sm" disabled>
        <Spinner data-icon="inline-start" />
        Loading
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>Default</Button>
      <Button variant="outline" disabled>
        Outline
      </Button>
      <Button variant="destructive" disabled>
        Destructive
      </Button>
    </div>
  ),
};
