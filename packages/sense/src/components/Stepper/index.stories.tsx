import { Button } from '@op/sense/Button';
import {
  StepItem,
  StepperProgressIndicator,
  useStepper,
} from '@op/sense/Stepper';
import type { StepperItem } from '@op/sense/Stepper';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof StepperProgressIndicator> = {
  title: 'Composites/Stepper',
  component: StepperProgressIndicator,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof StepperProgressIndicator>;

const steps: StepperItem[] = [
  { key: 0, label: 'Basics', component: <p>Name your decision process.</p> },
  { key: 1, label: 'Phases', component: <p>Define the phases.</p> },
  { key: 2, label: 'Members', component: <p>Invite participants.</p> },
];

// useStepper drives the flow; the gradient progress bar fills per step with
// a CSS width transition.
const StepperDemo = () => {
  const { currentStep, nextStep, prevStep } = useStepper({ items: steps });

  return (
    <div className="flex w-96 flex-col gap-4 overflow-hidden rounded-lg border">
      <StepperProgressIndicator
        numItems={steps.length}
        currentStep={currentStep}
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
        </p>
        {steps.map((step, index) => (
          <StepItem key={step.key} currentStep={currentStep} itemIndex={index}>
            {step.component}
          </StepItem>
        ))}
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={currentStep === 0}
            onClick={prevStep}
          >
            Back
          </Button>
          <Button
            size="sm"
            disabled={currentStep === steps.length - 1}
            onClick={() => nextStep()}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <StepperDemo />,
};
