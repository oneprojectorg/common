import { StepperProgressIndicator } from '@op/ui/Stepper';

import { MultiStepProvider } from '../form/multiStep';
import { Portal } from '../Portal';

import {
  OrganizationDetailsForm,
  validator as OrganizationDetailsFormValidator,
  validator as FundingInformationFormValidator,
} from './OrganizationDetailsForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';

import type { UnionToIntersection } from '../form/utils';
import type { Form, Return, Schema } from '@formity/react';
import type { z } from 'zod';
import { FundingInformationForm } from './FundingInformationForm';

const resolvers = {
  PersonalDetailsForm: PersonalDetailsFormValidator,
  OrganizationDetailsForm: OrganizationDetailsFormValidator,
  FundingInformationForm: FundingInformationFormValidator,
} as const;

type FormType = z.infer<
  UnionToIntersection<(typeof resolvers)[keyof typeof resolvers]>
>;

export type Values = [
  Form<z.infer<typeof resolvers.PersonalDetailsForm>>,
  Form<z.infer<typeof resolvers.OrganizationDetailsForm>>,
  Return<FormType>,
];

const ProgressIndicator = ({ currentStep = 0 }: { currentStep: number }) => (
  <Portal id="top-slot">
    <StepperProgressIndicator
      currentStep={currentStep}
      numItems={schema.length}
    />
  </Portal>
);

export const schema: Schema<Values> = [
  {
    form: {
      values: () => ({
        fullName: ['', []],
        title: ['', []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={0} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <PersonalDetailsForm
              defaultValues={values}
              resolver={resolvers.PersonalDetailsForm}
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        organizationName: ['', []],
        website: ['', []],
        email: ['', []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={1} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <OrganizationDetailsForm
              defaultValues={values}
              resolver={resolvers.OrganizationDetailsForm}
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        organizationName: ['', []],
        website: ['', []],
        email: ['', []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={2} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <FundingInformationForm
              defaultValues={values}
              resolver={resolvers.OrganizationDetailsForm}
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    return: (props) => props,
  },
];
