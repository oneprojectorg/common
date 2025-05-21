'use client';

import { trpc } from '@op/api/client';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { z } from 'zod';

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
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof OrganizationDetailsFormValidator> &
  z.infer<typeof FundingInformationFormValidator> &
  z.infer<typeof PrivacyPolicyFormValidator> &
  z.infer<typeof ToSFormValidator>;

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
  const [values, setValues] = useState<FormValues | null>(null);
  const createOrganization = trpc.organization.create.useMutation();
  const router = useRouter();
  const { reset } = useOnboardingFormStore();
  const trpcUtil = trpc.useUtils();

  const onReturn = useCallback<any>(
    (values: Array<FormValues>) => {
      const combined: FormValues = values.reduce(
        (accum, val) => ({ ...accum, ...val }),
        {} as FormValues,
      );
      setValues(combined);
      createOrganization
        .mutateAsync(processInputs(combined))
        .then(() => {
          reset();
          // invalidate account so we refetch organization users again
          trpcUtil.account.getMyAccount
            .invalidate(undefined, {
              refetchType: 'all',
            })
            .then(() => {
              router.push(`/?new=1`);
            });
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
        ToSForm,
        PrivacyPolicyForm,
      ]}
      schemas={[
        PersonalDetailsFormValidator,
        OrganizationDetailsFormValidator,
        FundingInformationFormValidator,
        ToSFormValidator,
        PrivacyPolicyFormValidator,
      ]}
      onFinish={onReturn}
      ProgressComponent={ProgressInPortal}
    />
  );
};
