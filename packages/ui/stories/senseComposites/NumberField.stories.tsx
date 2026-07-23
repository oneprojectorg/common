import { NumberField } from '@op/sense/NumberField';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Pair, Section } from '../../src/comparison/Comparison';
import { NumberField as OldNumberField } from '../../src/components/NumberField';

// Side-by-side of the @op/ui composite and its @op/sense port. Same numeric
// filtering and Arabic-digit normalization; the prefix now rides InputGroup
// instead of a ResizeObserver.

const meta: Meta = {
  title: 'Sense Comparison/Composites/NumberField',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const NewDemo = () => {
  const [amount, setAmount] = useState<number | null>(250);

  return (
    <NumberField
      label="Budget"
      prefixText="$"
      value={amount}
      onChange={setAmount}
      className="w-64"
    />
  );
};

const OldDemo = () => {
  const [amount, setAmount] = useState<number | null>(250);

  return (
    <div className="w-64">
      <OldNumberField
        label="Budget"
        prefixText="$"
        value={amount}
        onChange={setAmount}
      />
    </div>
  );
};

export const NumberFieldComparison: Story = {
  name: 'NumberField',
  render: () => (
    <div className="p-8">
      <Section title="NumberField">
        <Pair label="With prefix" old={<OldDemo />} raw={<NewDemo />} />
        <Pair
          label="Bounds error"
          old={
            <div className="w-64">
              <OldNumberField label="Votes" minValue={0} maxValue={10} />
            </div>
          }
          raw={
            <NumberField
              label="Votes"
              minValue={0}
              maxValue={10}
              className="w-64"
            />
          }
        />
      </Section>
    </div>
  ),
};
