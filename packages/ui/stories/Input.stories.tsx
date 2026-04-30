import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '../src/components/ui/input';

const meta: Meta<typeof Input> = {
  title: 'Components/ui/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => <Input placeholder="Type here..." className="w-72" />,
};

export const Disabled: StoryObj = {
  render: () => (
    <Input placeholder="Disabled" className="w-72" disabled />
  ),
};

export const WithValue: StoryObj = {
  render: () => (
    <Input defaultValue="Pre-filled value" className="w-72" />
  ),
};
