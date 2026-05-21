import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/Field';
import { RadioGroup, RadioGroupItem } from '@/components/RadioGroup';

const meta: Meta<typeof RadioGroup> = {
  title: 'shadcn/RadioGroup',
  component: RadioGroup,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => {
    const ids = [useId(), useId(), useId()];
    return (
      <RadioGroup defaultValue="a" className="flex flex-col gap-2">
        {['a', 'b', 'c'].map((v, i) => (
          <label key={v} htmlFor={ids[i]} className="flex items-center gap-2">
            <RadioGroupItem id={ids[i]} value={v} />
            Option {v.toUpperCase()}
          </label>
        ))}
      </RadioGroup>
    );
  },
};

export const Controlled: Story = {
  render: () => {
    const ids = [useId(), useId(), useId()];
    const [value, setValue] = useState('a');
    return (
      <RadioGroup
        value={value}
        onValueChange={(v) => setValue(v as string)}
        className="flex flex-col gap-2"
      >
        {['a', 'b', 'c'].map((v, i) => (
          <label key={v} htmlFor={ids[i]} className="flex items-center gap-2">
            <RadioGroupItem id={ids[i]} value={v} />
            Option {v.toUpperCase()}
          </label>
        ))}
      </RadioGroup>
    );
  },
};

export const Horizontal: Story = {
  render: () => {
    const ids = [useId(), useId(), useId()];
    return (
      <RadioGroup defaultValue="b" className="flex gap-4">
        {['a', 'b', 'c'].map((v, i) => (
          <label key={v} htmlFor={ids[i]} className="flex items-center gap-2">
            <RadioGroupItem id={ids[i]} value={v} />
            {v.toUpperCase()}
          </label>
        ))}
      </RadioGroup>
    );
  },
};

export const WithFieldComposition: Story = {
  name: 'Field + RadioGroup',
  render: () => {
    const ids = [useId(), useId()];
    return (
      <Field className="w-80">
        <FieldLabel>Plan</FieldLabel>
        <FieldDescription>Pick a billing cadence.</FieldDescription>
        <RadioGroup defaultValue="monthly" className="flex flex-col gap-2">
          <label htmlFor={ids[0]} className="flex items-center gap-2">
            <RadioGroupItem id={ids[0]} value="monthly" />
            Monthly
          </label>
          <label htmlFor={ids[1]} className="flex items-center gap-2">
            <RadioGroupItem id={ids[1]} value="yearly" />
            Yearly
          </label>
        </RadioGroup>
        <FieldError />
      </Field>
    );
  },
};
