import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { cn } from '@op/ui/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { StepProps } from '../MultiStepForm';
import { SelectableSearchInput } from '../SearchInput/SelectableSearchInput';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export const validator = z.array(z.object({}));

type OrganizationsSearchFormProps = StepProps & {
  className?: string;
};

export const OrganizationsSearchForm = ({
  onNext,
  // onBack,
  className,
}: OrganizationsSearchFormProps): ReactNode => {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = Number(searchParams.get('step'));
  const { setSelectedOrganizations, selectedOrganizations, setLastStep } =
    useOnboardingFormStore();

  const utils = trpc.useUtils();

  const joinOrganization = trpc.organization.join.useMutation({
    onSuccess: () => {
      utils.account.getMyAccount.invalidate();
    },
  });

  const handleContinue = async ({
    shouldContinue,
  }: {
    shouldContinue?: boolean;
  } = {}) => {
    if (shouldContinue) {
      setLastStep(currentStep);
      router.push(`/start?step=${currentStep + 1}`);
    } else {
      router.push(`/?new=1`);
    }
    // Redirect to the main app with new org flag
  };

  const handleContinueWithNoSelection = () => {
    console.log({ currentStep });
    setLastStep(currentStep);
    onNext([]);
  };

  return (
    <div className={cn('w-full max-w-lg', className)}>
      <FormContainer>
        <FormHeader text={t('Find organizations you belong to')}>
          {t('find_organizations_subheader')}
        </FormHeader>

        <SelectableSearchInput
          placeholder={t('Search or add your organization')}
          onSelectionChange={setSelectedOrganizations}
          initialSelections={selectedOrganizations}
        />

        {!selectedOrganizations.length ? (
          <>
            <div className="flex w-full items-center justify-center gap-4 text-midGray">
              <div className="h-px grow bg-current" />
              <span>or</span>
              <div className="h-px grow bg-current" />
            </div>
            <div className="flex flex-col gap-4">
              <Button
                className="w-full"
                color="secondary"
                onPress={() => handleContinueWithNoSelection()}
              >
                {t('Skip for now')}
              </Button>
            </div>
          </>
        ) : (
          <Button
            className="w-full"
            onPress={() => handleContinue({ shouldContinue: true })}
          >
            {`${t('Continue with ')}${selectedOrganizations.length} ${t('organization')}${selectedOrganizations.length > 1 ? 's' : ''}`}
          </Button>
        )}
      </FormContainer>
    </div>
  );
};

export const OrganizationsSearchFormSuspense = (
  props: OrganizationsSearchFormProps,
) => {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense
        fallback={
          <div className={props.className}>
            <FormContainer>
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            </FormContainer>
          </div>
        }
      >
        <OrganizationsSearchForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
