import { Button } from '../src/components/Button';

export default {
  title: 'Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'gradient', 'destructive'],
    },
    unstyled: {
      control: 'boolean',
    },
    isLoading: {
      control: 'boolean',
    },
  },
  args: {
    isDisabled: false,
    isLoading: false,
    children: 'Button',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    Medium:
    <Button>Button</Button>
    <Button variant="outline">Button</Button>
    <Button variant="destructive">Button</Button>
    <Button isDisabled variant="destructive">
      Button
    </Button>
    Small:
    <Button size="sm">Button</Button>
    <Button size="sm" variant="outline">
      Button
    </Button>
    <Button isDisabled size="sm">
      Button
    </Button>
    Loading:
    <Button isLoading>Button</Button>
    <Button isLoading variant="outline">
      Button
    </Button>
    <Button isLoading variant="destructive">
      Button
    </Button>
    <Button isLoading size="sm">
      Button
    </Button>
    <Button isLoading size="sm" variant="outline">
      Button
    </Button>
  </div>
);

export const Primary = {
  args: {
    color: 'primary',
  },
};

export const Secondary = {
  args: {
    color: 'secondary',
  },
};

export const Destructive = {
  args: {
    color: 'destructive',
  },
};

export const Loading = {
  args: {
    isLoading: true,
  },
};

export const LoadingSmall = {
  args: {
    isLoading: true,
    size: 'small',
  },
};
