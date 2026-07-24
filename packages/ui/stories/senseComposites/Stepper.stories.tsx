import { StepperProgressIndicator } from '@op/sense/Stepper';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { StepperProgressIndicator as OldStepperProgressIndicator } from '../../src/components/Stepper';

// Port swaps framer-motion for a CSS width transition; visuals identical.

const meta: Meta = {
  title: 'Sense Comparison/Composites/Stepper',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const StepperComparison: Story = {
  name: 'Stepper',
  render: () => (
    <div className="p-8">
      <Section title="Stepper">
        <Pair
          label="Progress (step 2 of 3)"
          old={
            <div className="w-64">
              <OldStepperProgressIndicator numItems={3} currentStep={1} />
            </div>
          }
          raw={
            <div className="w-64">
              <StepperProgressIndicator numItems={3} currentStep={1} />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
