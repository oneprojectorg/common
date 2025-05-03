'use client';

import { trpc } from '@op/trpc/client';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { MultiStepForm } from '../MultiStepForm';
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

export const OnboardingFlow = () => {
  const [values, setValues] = useState<any | null>(null);
  const createOrganization = trpc.organization.create.useMutation();
  const router = useRouter();

  const onReturn = useCallback<any>(
    (values) => {
      console.log('VALUES', values);
      setValues(values);
      createOrganization
        .mutateAsync(processInputs(values))
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
    />
  );
};
