'use client';

import { Portal } from '@/components/Portal';

import { Button } from '@op/ui/Button';
import { Form } from '@op/ui/Form';
import { StepItem, StepperProgressIndicator, useStepper } from '@op/ui/Stepper';
import { TextField } from '@op/ui/TextField';

import type { StepperItem } from '@op/ui/Stepper';

const stepperItems: Array<StepperItem> = [
  {
    key: 0,
    label: 'Step 1',
    component: (
      <>
        <TextField label="Full name" />
        <TextField label="Professional title" />
      </>
    ),
  },
  {
    key: 1,
    label: 'Step 2',
    component: (
      <>
        <TextField label="Organization name" />
        <TextField label="Website" />
      </>
    ),
  },
  {
    key: 2,
    label: 'Step 3',
    component: (
      <>
        <TextField label="Is your organization seeking funding?" />
        <TextField label="Website" />
      </>
    ),
  },
];

const OnboardingFlow = () => {
  const { goToStep, nextStep, currentStep } = useStepper({
    items: stepperItems,
  });

  return (
    <div className="flex w-full max-w-96 flex-col">
      <Portal id="top-slot">
        <StepperProgressIndicator
          currentStep={currentStep}
          items={stepperItems}
          goToStep={goToStep}
        />
      </Portal>
      <Form>
        {stepperItems.map((item, i) => (
          <StepItem key={item.key} currentStep={currentStep} itemIndex={i}>
            {item.component}
            <Button onPress={nextStep}>Continue</Button>
          </StepItem>
        ))}
      </Form>
    </div>
  );
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
