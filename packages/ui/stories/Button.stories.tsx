import { Button } from '../src/components/Button';

export default {
  title: 'Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'destructive'],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'gradient', 'destructive'],
    },
    surface: {
      control: 'select',
      options: ['solid', 'outline', 'ghost'],
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
    variant: 'secondary',
  },
};

export const Secondary = {
  args: {
    variant: 'secondary',
  },
};

export const Destructive = {
  args: {
    variant: 'destructive',
  },
};
