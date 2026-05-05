import type { Meta } from '@storybook/react-vite';
import { Form } from 'react-aria-components';
import { LuSearch } from 'react-icons/lu';

import { Button } from '../src/components/Button';
import {
  ComboBox,
  ComboBoxItem,
  ComboBoxSection,
} from '../src/components/ComboBox';

const meta: Meta<typeof ComboBox> = {
  component: ComboBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Ice cream flavor',
    placeholder: 'Pick a flavor',
  },
};

export default meta;

export const Example = (args: any) => (
  <ComboBox {...args}>
    <ComboBoxItem>Chocolate</ComboBoxItem>
    <ComboBoxItem id="mint">Mint</ComboBoxItem>
    <ComboBoxItem>Strawberry</ComboBoxItem>
    <ComboBoxItem>Vanilla</ComboBoxItem>
  </ComboBox>
);

export const DisabledItems = (args: any) => <Example {...args} />;
DisabledItems.args = {
  disabledKeys: ['mint'],
};

export const Sections = (args: any) => (
  <ComboBox {...args}>
    <ComboBoxSection title="Fruit">
      <ComboBoxItem id="Apple">Apple</ComboBoxItem>
      <ComboBoxItem id="Banana">Banana</ComboBoxItem>
      <ComboBoxItem id="Orange">Orange</ComboBoxItem>
      <ComboBoxItem id="Honeydew">Honeydew</ComboBoxItem>
      <ComboBoxItem id="Grapes">Grapes</ComboBoxItem>
      <ComboBoxItem id="Watermelon">Watermelon</ComboBoxItem>
      <ComboBoxItem id="Cantaloupe">Cantaloupe</ComboBoxItem>
      <ComboBoxItem id="Pear">Pear</ComboBoxItem>
    </ComboBoxSection>
    <ComboBoxSection title="Vegetable">
      <ComboBoxItem id="Cabbage">Cabbage</ComboBoxItem>
      <ComboBoxItem id="Broccoli">Broccoli</ComboBoxItem>
      <ComboBoxItem id="Carrots">Carrots</ComboBoxItem>
      <ComboBoxItem id="Lettuce">Lettuce</ComboBoxItem>
      <ComboBoxItem id="Spinach">Spinach</ComboBoxItem>
      <ComboBoxItem id="Bok Choy">Bok Choy</ComboBoxItem>
      <ComboBoxItem id="Cauliflower">Cauliflower</ComboBoxItem>
      <ComboBoxItem id="Potatoes">Potatoes</ComboBoxItem>
    </ComboBoxSection>
  </ComboBox>
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

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

export const WithSearchIcon = (args: any) => (
  <ComboBox {...args} icon={<LuSearch aria-hidden className="size-4" />}>
    {US_STATES.map((state) => (
      <ComboBoxItem key={state} id={state}>
        {state}
      </ComboBoxItem>
    ))}
  </ComboBox>
);

WithSearchIcon.args = {
  label: 'State',
  placeholder: 'Search states...',
};
