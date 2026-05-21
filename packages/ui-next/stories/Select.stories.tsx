import type { Meta, StoryObj } from '@storybook/react-vite';

import { Select, SelectItem } from '@/components/Select';

const meta: Meta = {
  title: 'shadcn/Select',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const FRUITS = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
];

export const Default: Story = {
  render: () => (
    <Select label="Fruit" placeholder="Pick one" items={FRUITS}>
      {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
    </Select>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <Select
      label="Fruit"
      description="Pick your favorite."
      placeholder="Pick one"
      items={FRUITS}
    >
      {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
    </Select>
  ),
};

export const WithError: Story = {
  render: () => (
    <Select
      label="Fruit"
      errorMessage="Required"
      placeholder="Pick one"
      items={FRUITS}
    >
      {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select label="Fruit" size="small" placeholder="Pick" items={FRUITS}>
      {(item) => <SelectItem id={item.id}>{item.label}</SelectItem>}
    </Select>
  ),
};
