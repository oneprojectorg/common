import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';

import {
  MultiSelectComboBox,
  type Option,
} from '../src/components/MultiSelectComboBox';

const meta: Meta<typeof MultiSelectComboBox> = {
  component: MultiSelectComboBox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

const fruits: Option[] = [
  { id: 'apple', label: 'Apple' },
  { id: 'banana', label: 'Banana' },
  { id: 'cherry', label: 'Cherry' },
  { id: 'grape', label: 'Grape' },
  { id: 'mango', label: 'Mango' },
  { id: 'orange', label: 'Orange' },
  { id: 'peach', label: 'Peach' },
  { id: 'strawberry', label: 'Strawberry' },
];

export const Example = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Favorite fruits"
        placeholder="Search fruits…"
        items={fruits}
        value={value}
        onChange={setValue}
      />
    </div>
  );
};

export const WithPreselected = () => {
  const [value, setValue] = useState<Option[]>([
    { id: 'apple', label: 'Apple' },
    { id: 'mango', label: 'Mango' },
  ]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Favorite fruits"
        placeholder="Search fruits…"
        items={fruits}
        value={value}
        onChange={setValue}
      />
    </div>
  );
};

export const Required = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Favorite fruits"
        placeholder="Search fruits…"
        items={fruits}
        value={value}
        onChange={setValue}
        isRequired
      />
    </div>
  );
};

export const WithErrorMessage = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Favorite fruits"
        placeholder="Search fruits…"
        items={fruits}
        value={value}
        onChange={setValue}
        isRequired
        errorMessage={
          value.length === 0 ? 'Please select at least one fruit' : undefined
        }
      />
    </div>
  );
};

export const AllowAdditions = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Tags"
        placeholder="Type to add…"
        items={fruits}
        value={value}
        onChange={setValue}
        allowAdditions
      />
    </div>
  );
};

export const WithDefinitions = () => {
  const [value, setValue] = useState<Option[]>([]);

  const itemsWithDefinitions: Option[] = [
    {
      id: 'apple',
      label: 'Apple',
      definition: 'A round fruit with red or green skin',
    },
    { id: 'banana', label: 'Banana', definition: 'A long curved yellow fruit' },
    {
      id: 'cherry',
      label: 'Cherry',
      definition: 'A small round red fruit with a pit',
    },
    {
      id: 'grape',
      label: 'Grape',
      definition: 'A small round fruit that grows in clusters',
    },
  ];

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Fruits"
        placeholder="Search fruits…"
        items={itemsWithDefinitions}
        value={value}
        onChange={setValue}
        showDefinitions
      />
    </div>
  );
};

const treeItems: Option[] = [
  { id: 'citrus', label: 'Citrus', hasChildren: true, level: 0 },
  { id: 'orange', label: 'Orange', level: 1 },
  { id: 'lemon', label: 'Lemon', level: 1 },
  { id: 'lime', label: 'Lime', level: 1 },
  { id: 'berries', label: 'Berries', hasChildren: true, level: 0 },
  { id: 'strawberry', label: 'Strawberry', level: 1 },
  { id: 'blueberry', label: 'Blueberry', level: 1 },
  { id: 'raspberry', label: 'Raspberry', level: 1 },
];

export const TreeWithDisabledParents = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Fruits by category"
        placeholder="Search fruits…"
        items={treeItems}
        value={value}
        onChange={setValue}
        disableParentSelection
      />
    </div>
  );
};

export const Loading = () => {
  const [value, setValue] = useState<Option[]>([]);

  return (
    <div className="w-80">
      <MultiSelectComboBox
        label="Fruits"
        placeholder="Search fruits…"
        items={[]}
        value={value}
        onChange={setValue}
        isLoading
      />
    </div>
  );
};
