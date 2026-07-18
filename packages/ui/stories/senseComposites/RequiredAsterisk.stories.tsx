import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { RequiredAsterisk as OldRequiredAsterisk } from '../../src/components/RequiredAsterisk';

const meta: Meta = {
  title: 'Sense Comparison/Composites/RequiredAsterisk',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const RequiredAsteriskComparison: Story = {
  name: 'RequiredAsterisk',
  render: () => (
    <div className="p-8">
      <Section title="RequiredAsterisk">
        <Pair
          label="In a label"
          old={
            <span>
              Organization name
              <OldRequiredAsterisk />
            </span>
          }
          raw={
            <span>
              Organization name
              <RequiredAsterisk />
            </span>
          }
        />
      </Section>
    </div>
  ),
};
