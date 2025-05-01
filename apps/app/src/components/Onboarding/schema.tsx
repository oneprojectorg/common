import type { Form, Return, Schema } from '@formity/react';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import type { z } from 'zod';

import { Portal } from '../Portal';
import { MultiStepProvider } from '../form/multiStep';
import type { UnionToIntersection } from '../form/utils';
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
import {
  PrivacyPolicyForm,
  validator as PrivacyPolicyFormValidator,
} from './PrivacyPolicyForm';
import { ToSForm, validator as ToSFormValidator } from './ToSForm';

const resolvers = {
  PersonalDetailsForm: PersonalDetailsFormValidator,
  OrganizationDetailsForm: OrganizationDetailsFormValidator,
  FundingInformationForm: FundingInformationFormValidator,
  ToSForm: ToSFormValidator,
  PrivacyPolicyForm: PrivacyPolicyFormValidator,
} as const;

type FormType = z.infer<
  UnionToIntersection<(typeof resolvers)[keyof typeof resolvers]>
>;

export type Values = [
  Form<z.infer<typeof resolvers.PersonalDetailsForm>>,
  Form<z.infer<typeof resolvers.OrganizationDetailsForm>>,
  Form<z.infer<typeof resolvers.FundingInformationForm>>,
  Form<z.infer<typeof resolvers.ToSForm>>,
  Form<z.infer<typeof resolvers.PrivacyPolicyForm>>,
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
              className="lg:w-[48rem]"
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
              className="lg:w-[48rem]"
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
              className="lg:w-[48rem]"
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        tosAccept: [false, []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={3} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <ToSForm
              defaultValues={values}
              resolver={resolvers.PrivacyPolicyForm}
            />
          </MultiStepProvider>
        </>
      ),
    },
  },
  {
    form: {
      values: () => ({
        privacyPolicyAccept: [false, []],
      }),
      render: ({ values, onNext, onBack }) => (
        <>
          <ProgressIndicator currentStep={4} />
          <MultiStepProvider onNext={onNext} onBack={onBack}>
            <PrivacyPolicyForm
              defaultValues={values}
              resolver={resolvers.PrivacyPolicyForm}
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
