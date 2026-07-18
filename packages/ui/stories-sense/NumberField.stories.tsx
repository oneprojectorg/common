import { NumberField } from '@op/sense/NumberField';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof NumberField> = {
  title: 'Sense/NumberField',
  component: NumberField,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof NumberField>;

const DefaultDemo = () => {
  const [amount, setAmount] = useState<number | null>(250);

  return (
    <NumberField
      label="Budget"
      description="Whole numbers or decimals; non-numeric input is filtered."
      prefixText="$"
      value={amount}
      onChange={setAmount}
      className="w-72"
    />
  );
};

export const Default: Story = {
  render: () => <DefaultDemo />,
};

const BoundsDemo = () => {
  const [votes, setVotes] = useState<number | null>(5);

  return (
    <NumberField
      label="Votes"
      description="Between 0 and 10. Bounds are validated on blur."
      minValue={0}
      maxValue={10}
      value={votes}
      onChange={setVotes}
      className="w-72"
    />
  );
};

export const WithBounds: Story = {
  render: () => <BoundsDemo />,
};

// Type Arabic-Indic (٠١٢٣) or Persian (۰۱۲۳) digits — they normalize to
// ASCII on input, and the field stays LTR in RTL locales.
const ArabicDigitsDemo = () => {
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <div dir="rtl">
      <NumberField
        label="المبلغ"
        description="جرّب كتابة ٤٢ أو ۴۲"
        value={amount}
        onChange={setAmount}
        className="w-72"
      />
    </div>
  );
};

export const ArabicDigits: Story = {
  render: () => <ArabicDigitsDemo />,
};

export const States: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-6">
      <NumberField label="Disabled" disabled value={42} />
      <NumberField
        label="With error"
        errorMessage="The budget exceeds the remaining funds."
        value={9000}
      />
    </div>
  ),
};
