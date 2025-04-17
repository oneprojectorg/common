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
