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
  {
    id: 'banana',
    label: 'Banana',
    level: 1,
    definition: 'A yellow tropical fruit',
  },
  { id: 'veg', label: 'Vegetable', level: 0, hasChildren: true },
  {
    id: 'carrot',
    label: 'Carrot',
    level: 1,
    definition: 'An orange root vegetable',
  },
  {
    id: 'broccoli',
    label: 'Broccoli',
    level: 1,
    definition: 'A green tree-like vegetable',
  },
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

const FOCUS_AREAS: Option[] = [
  { id: 'food', label: 'Food Sovereignty' },
  { id: 'climate', label: 'Climate Resilience' },
  { id: 'housing', label: 'Affordable Housing' },
  { id: 'health', label: 'Public Health Equity' },
  { id: 'edu', label: 'Education Access' },
  { id: 'arts', label: 'Arts and Culture' },
  { id: 'tech', label: 'Civic Technology' },
  { id: 'labor', label: 'Worker Power' },
  { id: 'land', label: 'Land Trusts' },
  { id: 'finance', label: 'Community Finance' },
  { id: 'demo', label: 'Participatory Democracy' },
  { id: 'youth', label: 'Youth Leadership' },
  { id: 'elders', label: 'Elder Care Networks' },
  { id: 'transport', label: 'Public Transit Advocacy' },
  { id: 'water', label: 'Watershed Stewardship' },
  { id: 'food-rescue', label: 'Food Rescue Programs' },
  { id: 'maker', label: 'Maker Spaces' },
  { id: 'lang', label: 'Language Justice' },
  { id: 'data', label: 'Data Sovereignty' },
  { id: 'energy', label: 'Energy Cooperatives' },
];

export const ManyMultiWordOptions: Story = {
  render: () => {
    const [value, setValue] = useState<Option[]>([]);
    return (
      <MultiSelectComboBox
        label="Focus Areas"
        placeholder="Select all that apply"
        items={FOCUS_AREAS}
        value={value}
        onChange={setValue}
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
        isDisabled
      />
    );
  },
};
