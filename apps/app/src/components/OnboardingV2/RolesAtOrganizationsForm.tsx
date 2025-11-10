import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Surface } from '@op/ui/Surface';
import { TextField } from '@op/ui/TextField';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { LuGlobe, LuInfo } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ContactLink } from '../ContactLink';
import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { StepProps } from '../MultiStepForm';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export const validator = z.array(z.object({}));

type RolesAtOrganizationsFormProps = StepProps & {
  className?: string;
};

export const RolesAtOrganizationsForm = ({
  onNext,
  // onBack,
  className,
}: RolesAtOrganizationsFormProps): ReactNode => {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = Number(searchParams.get('step'));
  const { selectedOrganizations, setLastStep } = useOnboardingFormStore();
  const utils = trpc.useUtils();

  const joinOrganization = trpc.organization.join.useMutation({
    onSuccess: () => {
      utils.account.getMyAccount.invalidate();
    },
  });

  const trpcUtil = trpc.useUtils();
  const [isLoading, setLoading] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | undefined
  >();

  // If no matching organizations, automatically proceed to next step
  // If there are organizations, select the first one by default
  useEffect(() => {
    if (selectedOrganizations) {
      if (selectedOrganizations.length === 0) {
        onNext([]);
      } else if (selectedOrganizations.length > 0 && !selectedOrganizationId) {
        setSelectedOrganizationId(selectedOrganizations[0]?.id);
      }
    }
  }, [selectedOrganizations]);

  const handleContinue = async ({
    shouldContinue,
  }: {
    shouldContinue?: boolean;
  } = {}) => {
    if (!selectedOrganizationId) {
      return;
    }

    try {
      setLoading(true);
      await joinOrganization.mutateAsync({
        organizationId: selectedOrganizationId,
      });

      // Invalidate account data to refetch organization users
      await trpcUtil.account.getMyAccount.invalidate(
        undefined,
        {
          refetchType: 'all',
        },
        {},
      );

      trpcUtil.account.getMyAccount.refetch().then(() => {
        if (shouldContinue) {
          router.push(`/start?step=${currentStep + 1}`);
        } else {
          router.push(`/?new=1`);
        }
      });
      // Redirect to the main app with new org flag
    } catch (error) {
      setLoading(false);
      console.error('Failed to join organization:', error);
      let message = 'Failed to join organization';
      if (error instanceof Error) {
        message = `${message} (${error.message})`;
      }

      toast.error({
        message,
      });
    }
  };

  const handleGoBack = () => {
    router.push(`/start?step=${currentStep - 1}`);
  };

  // Don't render if no organizations (useEffect will handle navigation)
  if (!selectedOrganizations || selectedOrganizations.length === 0) {
    // return <LoadingSpinner />;
    return (
      <button onClick={() => router.push(`/start?step=${currentStep + 1}`)}>
        Next
      </button>
    );
  }

  return (
    <div className={cn('max-w-lg', className)}>
      <FormContainer>
        <FormHeader text={t("We've found your organization")}>
          {t('join_subheader')}
        </FormHeader>
        <div className="flex flex-col items-center space-y-4">
          {selectedOrganizations.map((org) => (
            <Surface className="flex w-full flex-col gap-4 p-4" key={org.id}>
              <div className="flex gap-2">
                <OrganizationAvatar
                  profile={org}
                  withLink={false}
                  className="size-12"
                />
                <div className="flex flex-col gap-1">
                  <Header3 className="text-base text-neutral-charcoal">
                    {org.name}
                  </Header3>
                  <div className="flex flex-col gap-1 text-sm text-teal">
                    {org.website ? (
                      <ContactLink className="h-auto">
                        <LuGlobe className="size-3" />
                        <div>{org.website}</div>
                      </ContactLink>
                    ) : null}
                  </div>
                </div>
              </div>
              <TextField
                label={t('Your role at ') + org.name}
                isRequired
                inputProps={{ placeholder: t('Enter your role') }}
              />
            </Surface>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-primary-tealWhite p-3 text-sm">
          <LuInfo className="size-4 text-primary" />
          {t('These organizations will be notified to confirm your roles.')}
        </div>
        <div className="flex flex-col gap-4">
          <Button className="w-full" onPress={() => handleContinue()}>
            {joinOrganization.isPending || isLoading ? (
              <LoadingSpinner />
            ) : (
              t('Request confirmation')
            )}
          </Button>

          <Button
            className="w-full"
            type="button"
            color="secondary"
            onPress={() => handleGoBack()}
            isDisabled={joinOrganization.isPending || isLoading}
          >
            {t('Go back')}
          </Button>
          <button
            onClick={() => {
              setLastStep(currentStep);
              router.push(`/start?step=${currentStep + 1}`);
            }}
          >
            ~SKIP~
          </button>
        </div>
      </FormContainer>
    </div>
  );
};

export const RolesAtOrganizationsFormSuspense = (
  props: RolesAtOrganizationsFormProps,
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
        <RolesAtOrganizationsForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
