import type { Meta } from '@storybook/react';
import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { Select, SelectItem, SelectSection } from '../src/components/Select';

const meta: Meta<typeof Select> = {
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Ice cream flavor',
  },
};

export default meta;

export const Example = () => (
  <>
    <Select className="w-full">
      <SelectItem>Chocolate</SelectItem>
      <SelectItem id="mint">Mint</SelectItem>
      <SelectItem>Strawberry</SelectItem>
      <SelectItem>Vanilla</SelectItem>
    </Select>
    Disabled
    <Select className="w-full" isDisabled>
      <SelectItem>Chocolate</SelectItem>
      <SelectItem id="mint">Mint</SelectItem>
      <SelectItem>Strawberry</SelectItem>
      <SelectItem>Vanilla</SelectItem>
    </Select>
  </>
);

export const DisabledItems = (args: any) => <Example {...args} />;
DisabledItems.args = {
  disabledKeys: ['mint'],
};

export const Sections = (args: any) => (
  <Select {...args}>
    <SelectSection title="Fruit">
      <SelectItem id="Apple">Apple</SelectItem>
      <SelectItem id="Banana">Banana</SelectItem>
      <SelectItem id="Orange">Orange</SelectItem>
      <SelectItem id="Honeydew">Honeydew</SelectItem>
      <SelectItem id="Grapes">Grapes</SelectItem>
      <SelectItem id="Watermelon">Watermelon</SelectItem>
      <SelectItem id="Cantaloupe">Cantaloupe</SelectItem>
      <SelectItem id="Pear">Pear</SelectItem>
    </SelectSection>
    <SelectSection title="Vegetable">
      <SelectItem id="Cabbage">Cabbage</SelectItem>
      <SelectItem id="Broccoli">Broccoli</SelectItem>
      <SelectItem id="Carrots">Carrots</SelectItem>
      <SelectItem id="Lettuce">Lettuce</SelectItem>
      <SelectItem id="Spinach">Spinach</SelectItem>
      <SelectItem id="Bok Choy">Bok Choy</SelectItem>
      <SelectItem id="Cauliflower">Cauliflower</SelectItem>
      <SelectItem id="Potatoes">Potatoes</SelectItem>
    </SelectSection>
  </Select>
);

Sections.args = {
  label: 'Preferred fruit or vegetable',
};

export const Validation = (args: any) => (
  <Form className="flex flex-col items-start gap-2">
    <Example {...args} />
    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
};

export const PillVariant = (args: any) => (
  <div className="flex flex-col gap-4">
    <Select {...args} variant="pill" placeholder="Select category">
      <SelectItem>Planning</SelectItem>
      <SelectItem>Design</SelectItem>
      <SelectItem>Development</SelectItem>
      <SelectItem>Testing</SelectItem>
      <SelectItem>Deployment</SelectItem>
    </Select>
    
    <Select {...args} variant="pill" placeholder="Select category" isDisabled>
      <SelectItem>Planning</SelectItem>
      <SelectItem>Design</SelectItem>
      <SelectItem>Development</SelectItem>
      <SelectItem>Testing</SelectItem>
      <SelectItem>Deployment</SelectItem>
    </Select>
  </div>
);

PillVariant.args = {
  label: undefined,
};
