import { StepperProgressIndicator } from '@op/ui/Stepper';

import { MultiStepProvider } from '../form/multiStep';
import { Portal } from '../Portal';

import {
  FundingInformationForm,
  validator as FundingInformationFormValidator,
} from './FundingInformationForm';
import {
  OrganizationDetailsForm,
  validator as OrganizationDetailsFormValidator,
} from './OrganizationDetailsForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';

import type { UnionToIntersection } from '../form/utils';
import type { Form, Return, Schema } from '@formity/react';
import type { z } from 'zod';

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
  Form<z.infer<typeof resolvers.FundingInformationForm>>,
  Return<FormType>,
];

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
              className="sm:w-[32rem]"
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        name: ['', []],
        website: ['', []],
        email: ['', []],
        orgType: ['', []],
        bio: ['', []],
        mission: ['', []],
        focusAreas: [[], []],
        communitiesServed: [[], []],
        strategies: [[], []],
        whereWeWork: [[], []],
        networkOrganization: [false, []],

        orgAvatarImageId: [undefined, []],
        orgBannerImageId: [undefined, []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={1} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <OrganizationDetailsForm
              defaultValues={values}
              resolver={resolvers.OrganizationDetailsForm}
              className="sm:w-[32rem]"
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        isReceivingFunds: [false, []],
        isOfferingFunds: [false, []],
        acceptingApplications: [false, []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={2} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <FundingInformationForm
              defaultValues={values}
              resolver={resolvers.FundingInformationForm}
              className="sm:w-[32rem]"
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    return: props => props,
  },
];

function ProgressIndicator({ currentStep = 0 }: { currentStep: number }) {
  return (
    <Portal id="top-slot">
      <StepperProgressIndicator
        currentStep={currentStep}
        numItems={schema.length}
      />
    </Portal>
  );
}
