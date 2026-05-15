import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import {
  MultiSelectComboBox,
  type Option,
} from '@/components/MultiSelectComboBox';

const meta: Meta<typeof MultiSelectComboBox> = {
  title: 'shadcn/MultiSelectComboBox',
  component: MultiSelectComboBox,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[28rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiSelectComboBox>;

const FRUITS: Option[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'date', label: 'Date' },
  { id: 'elderberry', label: 'Elderberry' },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Fruits"
        placeholder="Pick some"
        items={FRUITS}
        value={value}
        onChange={setValue}
      />
    );
  },
};

export const Required: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Fruits"
        isRequired
        placeholder="Pick at least one"
        items={FRUITS}
        value={value}
        onChange={setValue}
      />
    );
  },
};

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Fruits"
        placeholder="Pick some"
        items={FRUITS}
        value={value}
        onChange={setValue}
        errorMessage="Select at least one fruit"
      />
    );
  },
};

const TERMS: Option[] = [
  { id: 'fruit', label: 'Fruit', level: 0, hasChildren: true },
  { id: 'apple', label: 'Apple', level: 1, definition: 'A red or green fruit' },
  { id: 'banana', label: 'Banana', level: 1, definition: 'A yellow tropical fruit' },
  { id: 'veg', label: 'Vegetable', level: 0, hasChildren: true },
  { id: 'carrot', label: 'Carrot', level: 1, definition: 'An orange root vegetable' },
  { id: 'broccoli', label: 'Broccoli', level: 1, definition: 'A green tree-like vegetable' },
];

export const WithTreeAndDefinitions: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Terms"
        placeholder="Select one or more"
        items={TERMS}
        value={value}
        onChange={setValue}
        showDefinitions
      />
    );
  },
};

export const Creatable: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Tags"
        placeholder="Type and press Enter"
        items={FRUITS}
        value={value}
        onChange={setValue}
        allowAdditions
      />
    );
  },
};

export const Loading: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Async terms"
        placeholder="Type to search…"
        items={[]}
        value={value}
        onChange={setValue}
        enableLocalSearch={false}
        onInputUpdate={() => {}}
        isLoading
      />
    );
  },
};

export const Disabled: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([
      { id: 'apple', label: 'Apple' },
    ]);
    return (
      <MultiSelectComboBox
        label="Fruits"
        items={FRUITS}
        value={value}
        onChange={setValue}
        placeholder="Locked"
      />
    );
  },
};
