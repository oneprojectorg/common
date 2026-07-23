import { Label } from '@op/sense/Label';
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@op/sense/NativeSelect';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof NativeSelect> = {
  title: 'Sense/Primitives/NativeSelect',
  component: NativeSelect,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof NativeSelect>;

export const Default: Story = {
  render: () => (
    <NativeSelect defaultValue="" className="w-[200px]">
      <NativeSelectOption value="" disabled>
        Select a fruit
      </NativeSelectOption>
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
      <NativeSelectOption value="banana">Banana</NativeSelectOption>
      <NativeSelectOption value="cherry">Cherry</NativeSelectOption>
    </NativeSelect>
  ),
};

export const Small: Story = {
  render: () => (
    <NativeSelect size="sm" defaultValue="apple" className="w-[180px]">
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
      <NativeSelectOption value="banana">Banana</NativeSelectOption>
      <NativeSelectOption value="cherry">Cherry</NativeSelectOption>
    </NativeSelect>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-[240px] gap-2">
      <Label htmlFor="native-select-country">Country</Label>
      <NativeSelect
        id="native-select-country"
        defaultValue="poland"
        className="w-full"
      >
        <NativeSelectOption value="poland">Poland</NativeSelectOption>
        <NativeSelectOption value="germany">Germany</NativeSelectOption>
        <NativeSelectOption value="france">France</NativeSelectOption>
        <NativeSelectOption value="usa">United States</NativeSelectOption>
      </NativeSelect>
    </div>
  ),
};

export const WithOptGroups: Story = {
  render: () => (
    <NativeSelect defaultValue="apple" className="w-[200px]">
      <NativeSelectOptGroup label="Fruits">
        <NativeSelectOption value="apple">Apple</NativeSelectOption>
        <NativeSelectOption value="banana">Banana</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Vegetables">
        <NativeSelectOption value="carrot">Carrot</NativeSelectOption>
        <NativeSelectOption value="spinach">Spinach</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  ),
};

export const Disabled: Story = {
  render: () => (
    <NativeSelect defaultValue="apple" disabled className="w-[200px]">
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
      <NativeSelectOption value="banana">Banana</NativeSelectOption>
    </NativeSelect>
  ),
};

export const Invalid: Story = {
  render: () => (
    <NativeSelect
      defaultValue="apple"
      aria-invalid="true"
      className="w-[200px]"
    >
      <NativeSelectOption value="apple">Apple</NativeSelectOption>
      <NativeSelectOption value="banana">Banana</NativeSelectOption>
    </NativeSelect>
  ),
};
