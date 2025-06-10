'use client';

import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { toast } from '@op/ui/Toast';
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
  MatchingOrganizationsForm,
  validator as MatchingOrganizationsFormValidator,
} from './MatchingOrganizationsForm';
import { OrganizationDetailsForm } from './OrganizationDetailsForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';
import {
  PrivacyPolicyForm,
  validator as PrivacyPolicyFormValidator,
} from './PrivacyPolicyForm';
import { ToSForm, validator as ToSFormValidator } from './ToSForm';
import { organizationFormValidator as OrganizationDetailsFormValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof MatchingOrganizationsFormValidator> &
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
  const [submitting, setSubmitting] = useState<boolean>(false);
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

      setSubmitting(true);

      createOrganization
        .mutateAsync(processInputs(combined))
        .then(() => {
          reset();
          // invalidate account so we refetch organization users again
          trpcUtil.account.getMyAccount.reset();
          trpcUtil.account.getMyAccount.refetch().then(() => {
            router.push(`/?new=1`);
          });
          setSubmitting(false);
        })
        .catch((err) => {
          console.error('ERROR', err);
          setSubmitting(false);
          toast.error({
            title: 'Oops! Not found',
            message: "We can't seem to find that.It might have been removed.",
          });
          router.push(`/start?step=1`);
        });
    },
    [createOrganization],
  );

  if (submitting) {
    return <LoadingSpinner />;
  }

  return (
    <MultiStepForm
      steps={[
        PersonalDetailsForm,
        MatchingOrganizationsForm,
        OrganizationDetailsForm,
        FundingInformationForm,
        ToSForm,
        PrivacyPolicyForm,
      ]}
      schemas={[
        PersonalDetailsFormValidator,
        MatchingOrganizationsFormValidator,
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
