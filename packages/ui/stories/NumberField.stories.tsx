import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import { Form } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { NumberField } from '../src/components/NumberField';

const meta: Meta<typeof NumberField> = {
  component: NumberField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Age',
  },
};

export default meta;

export const Example = () => (
  <div className="flex w-96 flex-col gap-8">
    <NumberField
      inputProps={{ placeholder: 'Enter your age' }}
      description="Helper text"
      label="Normal state"
    />
    <NumberField
      isDisabled
      label="Disabled state"
      isRequired
      inputProps={{ placeholder: 'Enter your age' }}
    />

    <NumberField
      label="With value"
      value={25}
      inputProps={{ placeholder: 'Enter your age' }}
    />

    <NumberField
      isDisabled
      label="Disabled with value"
      value={30}
      inputProps={{ placeholder: 'Enter your age' }}
    />
  </div>
);

export const Validation = (args: any) => (
  <Form className="flex flex-col items-start gap-2">
    <NumberField {...args} />
    <Button type="submit">Submit</Button>
  </Form>
);

Validation.args = {
  isRequired: true,
  inputProps: { placeholder: 'Enter your age' },
};

export const WithPrefix = () => (
  <NumberField
    inputProps={{ placeholder: 'Enter your budget' }}
    label="Budget"
    prefixText="$"
  />
);

export const WithMinMax = () => (
  <div className="flex w-96 flex-col gap-8">
    <NumberField
      label="Budget (max 10,000)"
      prefixText="$"
      maxValue={10000}
      inputProps={{ placeholder: 'Max 10,000' }}
    />
    <NumberField
      label="Score (1–100)"
      minValue={1}
      maxValue={100}
      inputProps={{ placeholder: '1–100' }}
    />
    <NumberField
      label="Quantity (min 0)"
      minValue={0}
      inputProps={{ placeholder: 'Min 0' }}
    />
  </div>
);

export const DynamicPrefix = () => {
  const [value, setValue] = useState(0);
  const [prefix, setPrefix] = useState('$');

  return (
    <NumberField
      inputProps={{ placeholder: 'Enter your budget' }}
      label="Budget"
      prefixText={prefix}
      value={value}
      onChange={(value) => {
        setValue(value ?? 0);
        const valueStr = value?.toString() || '0';
        setPrefix('$'.repeat(valueStr.length));
      }}
    />
  );
};
