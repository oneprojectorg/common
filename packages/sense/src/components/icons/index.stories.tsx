import { CheckIcon, MegaphoneIcon } from '@op/sense/icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

// The two bespoke SVG icons that aren't in `react-icons`. Each takes a
// `className` for sizing/color via tokens.
const meta: Meta = {
  title: 'Composites/Icons',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj;

export const Check: Story = {
  render: () => <CheckIcon className="size-6 text-foreground" />,
};

export const Megaphone: Story = {
  render: () => <MegaphoneIcon className="size-6 text-foreground" />,
};
