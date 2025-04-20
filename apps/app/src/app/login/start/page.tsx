'use client';

import { Portal } from '@/components/Portal';
import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { useMemo } from 'react';
import { z } from 'zod';

import { Button } from '@op/ui/Button';
import { StepItem, StepperProgressIndicator, useStepper } from '@op/ui/Stepper';
import { TextField } from '@op/ui/TextField';

import type { StepperItem } from '@op/ui/Stepper';

const { fieldContext, formContext } = createFormHookContexts();

const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
  },
  formComponents: {
    Button,
    SubmitButton: (props) => <Button {...props} type="submit" />,
  },
  fieldContext,
  formContext,
});

const getFieldErrorMessage = (field) => {
  return field.state.meta.errors
    .map((err: { message: string }) => err?.message)
    .join(', ');
};

const formValidator = z.object({
  fullName: z.string().min(1, 'Full Name is required'),
  title: z.string().min(1, 'Professional title is required'),
  fullName2: z.string().min(1, 'Full Name2 is required'),
  title2: z.string().min(1, 'Professional title2 is required'),
});

const OnboardingFlow = () => {
  const form = useAppForm({
    defaultValues: {
      fullName: '',
      title: '',
      fullName2: '',
      title2: '',
    },
    validators: {
      onChange: formValidator,
    },
    onSubmit: ({ value }) => {
      console.log('SUBMIT >>>>');
      console.log(JSON.stringify(value, null, 2));
    },
  });

  const stepperItems: Array<StepperItem> = useMemo(
    () => [
      {
        key: 0,
        label: 'Step 1',
        validator: formValidator.pick({
          fullName: true,
          title: true,
        }),
        component: (
          <>
            <form.AppField
              name="fullName"
              children={(field) => (
                <field.TextField
                  label="Full Name"
                  isRequired
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />
            <form.AppField
              name="title"
              children={(field) => (
                <field.TextField
                  label="Professional title"
                  isRequired
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />
          </>
        ),
      },
      {
        key: 1,
        label: 'Step 2',
        validator: formValidator.pick({
          fullName2: true,
          title2: true,
        }),
        component: (
          <>
            <form.AppField
              name="fullName2"
              children={(field) => (
                <field.TextField
                  label="Full Name2"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />
            <form.AppField
              name="title2"
              children={(field) => (
                <field.TextField
                  isRequired
                  label="Professional title2"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={field.handleChange}
                  errorMessage={getFieldErrorMessage(field)}
                />
              )}
            />
          </>
        ),
      },
    ],
    [],
  );

  const { goToStep, nextStep, currentStep } = useStepper({
    items: stepperItems,
  });

  const handleContinue = () => {
    const { values } = form.state;

    nextStep(values);
  };

  return (
    <div className="flex w-full max-w-96 flex-col">
      <Portal id="top-slot">
        <StepperProgressIndicator
          currentStep={currentStep}
          items={stepperItems}
          goToStep={goToStep}
        />
      </Portal>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-4"
      >
        {stepperItems.map((item, i) => (
          <StepItem key={item.key} currentStep={currentStep} itemIndex={i}>
            {item.component}
          </StepItem>
        ))}
        {currentStep === stepperItems.length - 1 ? (
          <Button type="submit">Finish</Button>
        ) : (
          <Button onPress={handleContinue}>Continue</Button>
        )}
      </form>
    </div>
  );
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
