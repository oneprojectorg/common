// import { Button } from '../src/components/Button';
// import { Form } from '../src/components/Form';
// import { TextField } from '../src/components/TextField';
// import type { StepperItem } from '../src/components/Stepper';
import type { Meta } from '@storybook/react-vite';

import {
  StepItem,
  // StepperProgressIndicator,
  // useStepper,
} from '../src/components/Stepper';

const meta: Meta<any> = {
  title: 'Components/Stepper',
  component: StepItem,
  tags: ['autodocs'],
};

export default meta;

// const stepperItems: Array<StepperItem> = [
// {
// key: 0,
// label: 'Step 1',
// component: (
// <>
// <TextField label="Full name" />
// <TextField label="Professional title" />
// </>
// ),
// },
// {
// key: 1,
// label: 'Step 2',
// component: (
// <>
// <TextField label="Organization name" />
// <TextField label="Website" />
// </>
// ),
// },
// {
// key: 2,
// label: 'Step 3',
// component: (
// <>
// <TextField label="Additional info" />
// <TextField label="Website" />
// </>
// ),
// },
// ];

export const Basic = {
  render: () => {
    return null;

    // const { goToStep, nextStep, currentStep } = useStepper({
    // items: stepperItems,
    // initialStep: 0,
    // });

    // return (
    // <div style={{ width: 400 }} className="flex flex-col gap-8">
    // <StepperProgressIndicator
    // currentStep={currentStep}
    // items={stepperItems}
    // goToStep={goToStep}
    // />
    // <Form>
    // {stepperItems.map((item, i) => (
    // <StepItem key={item.key} currentStep={currentStep} itemIndex={i}>
    // {item.component}
    // <Button onPress={() => nextStep()}>Continue</Button>
    // </StepItem>
    // ))}
    // </Form>
    // </div>
    // );
  },
};
