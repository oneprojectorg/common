import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { StepItem, StepperProgressIndicator } from '@/components/Stepper';

const meta: Meta = {
  title: 'shadcn/Stepper',
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const totalSteps = 4;
    const [step, setStep] = useState(0);
    return (
      <div className="flex flex-col gap-6">
        <StepperProgressIndicator
          numItems={totalSteps}
          currentStep={step}
        />
        <div className="rounded-lg border p-6">
          <StepItem currentStep={step} itemIndex={0}>
            Step 1 — intro
          </StepItem>
          <StepItem currentStep={step} itemIndex={1}>
            Step 2 — details
          </StepItem>
          <StepItem currentStep={step} itemIndex={2}>
            Step 3 — review
          </StepItem>
          <StepItem currentStep={step} itemIndex={3}>
            Step 4 — done
          </StepItem>
        </div>
        <div className="flex justify-between">
          <Button
            color="secondary"
            isDisabled={step === 0}
            onPress={() => setStep((s) => Math.max(s - 1, 0))}
          >
            Back
          </Button>
          <Button
            isDisabled={step === totalSteps - 1}
            onPress={() => setStep((s) => Math.min(s + 1, totalSteps - 1))}
          >
            Next
          </Button>
        </div>
      </div>
    );
  },
};
