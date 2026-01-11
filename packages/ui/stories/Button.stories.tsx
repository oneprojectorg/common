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
  },
  args: {
    isDisabled: false,
    children: 'Button',
  },
};

export const Example = () => (
  <div className="flex flex-col gap-8">
    Medium:
    <Button>Button</Button>
    <Button color="secondary">Button</Button>
    <Button color="destructive">Button</Button>
    <Button isDisabled color="destructive">
      Button
    </Button>
    Small:
    <Button size="small">Button</Button>
    <Button size="small" color="secondary">
      Button
    </Button>
    <Button isDisabled size="small">
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
