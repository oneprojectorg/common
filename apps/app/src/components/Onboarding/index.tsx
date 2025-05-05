'use client';

import { trpc } from '@op/trpc/client';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { MultiStepForm, ProgressComponentProps } from '../MultiStepForm';
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
import {
  PrivacyPolicyForm,
  validator as PrivacyPolicyFormValidator,
} from './PrivacyPolicyForm';
import { ToSForm, validator as ToSFormValidator } from './ToSForm';

const processInputs = (data: any) => {
  const inputs = {
    ...data,
  };

  return inputs;
};

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

export const OnboardingFlow = () => {
  const [values, setValues] = useState<any | null>(null);
  const createOrganization = trpc.organization.create.useMutation();
  const router = useRouter();

  const onReturn = useCallback<any>(
    (values) => {
      const combined = values.reduce(
        (accum, val) => ({ ...accum, ...val }),
        {},
      );
      setValues(combined);
      createOrganization
        .mutateAsync(processInputs(combined))
        .then(() => {
          router.push(`/?new=1`);
        })
        .catch((err) => {
          console.error('ERROR', err);
        });
    },
    [createOrganization],
  );

  if (values) {
    return <div>Processing...</div>;
  }

  return (
    <MultiStepForm
      steps={[
        PersonalDetailsForm,
        OrganizationDetailsForm,
        FundingInformationForm,
        PrivacyPolicyForm,
        ToSForm,
      ]}
      schemas={[
        PersonalDetailsFormValidator,
        OrganizationDetailsFormValidator,
        FundingInformationFormValidator,
        PrivacyPolicyFormValidator,
        ToSFormValidator,
      ]}
      onFinish={onReturn}
      ProgressComponent={ProgressInPortal}
    />
  );
};
