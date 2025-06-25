import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Header3 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Surface } from '@op/ui/Surface';
import { cn } from '@op/ui/utils';
import { useRouter } from 'next/navigation';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { LuGlobe, LuMail } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ContactLink } from '../ContactLink';
import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { StepProps } from '../MultiStepForm';
import { OrganizationAvatar } from '../OrganizationAvatar';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';

export const validator = z.object({});

type MatchingOrganizationsFormProps = StepProps & {
  className?: string;
};

export const MatchingOrganizationsForm = ({
  onNext,
  // onBack,
  className,
}: MatchingOrganizationsFormProps): ReactNode => {
  const t = useTranslations();
  const router = useRouter();
  const [matchingOrgs] =
    trpc.account.listMatchingDomainOrganizations.useSuspenseQuery();

  const joinOrganization = trpc.organization.join.useMutation();
  const trpcUtil = trpc.useUtils();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | undefined
  >();

  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);

  // If no matching organizations, automatically proceed to next step
  // If there are organizations, select the first one by default
  useEffect(() => {
    if (matchingOrgs) {
      if (matchingOrgs.length === 0) {
        onNext({});
      } else if (matchingOrgs.length > 0 && !selectedOrganizationId) {
        setSelectedOrganizationId(matchingOrgs[0]?.id);
      }
    }
  }, [matchingOrgs]);

  const handleContinue = async () => {
    if (!selectedOrganizationId) {
      return;
    }

    try {
      await joinOrganization.mutateAsync({
        organizationId: selectedOrganizationId,
      });

      // Invalidate account data to refetch organization users
      await trpcUtil.account.getMyAccount.invalidate(undefined, {
        refetchType: 'all',
      });

      // Redirect to the main app with new org flag
      router.push(`/?new=1`);
    } catch (error) {
      console.error('Failed to join organization:', error);
      // Handle error (could show toast notification)
    }
  };

  // const handleContinueWithNoSelection = () => {
  // onNext({});
  // };

  // Don't render if no organizations (useEffect will handle navigation)
  if (!matchingOrgs || matchingOrgs.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className={cn('max-w-md', className)}>
      <FormContainer>
        <FormHeader text={t("We've found your organization")}>
          {t(
            "Based on your email domain, you have admin access to your organization's profile.",
          )}
        </FormHeader>
        <div className="flex flex-col items-center space-y-4">
          {matchingOrgs.map((org) => (
            <Surface className="w-full p-4">
              <label key={org.id} className="flex cursor-default gap-4">
                <input
                  type="radio"
                  name="selectedOrganization"
                  value={org.id}
                  checked={selectedOrganizationId === org.id}
                  onChange={(e) => {
                    setSelectedOrganizationId(e.target.value);
                  }}
                  className="hidden"
                />
                <OrganizationAvatar
                  organization={org}
                  withLink={false}
                  className="size-12"
                />
                <div className="flex flex-col gap-2">
                  <Header3 className="text-base text-neutral-charcoal">
                    {org.profile.name}
                  </Header3>
                  <div className="flex flex-col gap-1 text-teal">
                    {org.profile.website ? (
                      <ContactLink className="h-auto">
                        <LuGlobe className="size-4" />
                        <div>{org.profile.website}</div>
                      </ContactLink>
                    ) : null}
                    {org.profile.email ? (
                      <ContactLink className="h-auto">
                        <LuMail className="min-w-4" />
                        <div>{org.profile.email}</div>
                      </ContactLink>
                    ) : null}
                  </div>
                </div>
              </label>
            </Surface>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div>{t('Confirm Administrator Access')}</div>
          <div>
            {t(
              "For now, we're only supporting administrator accounts. In the future, we’ll be able to support member accounts.",
            )}
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <div className="flex items-center gap-1">
              <Checkbox
                size="small"
                value={'' + termsAccepted}
                onChange={setTermsAccepted}
              >
                I have read and accept
              </Checkbox>
              <a
                href="/info/tos"
                target="_blank"
                className="text-sm text-primary-teal hover:underline"
              >
                the Common Terms of Use
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Checkbox
                size="small"
                value={'' + privacyAccepted}
                onChange={setPrivacyAccepted}
              >
                I have read and accept
              </Checkbox>
              <a
                href="/info/tos"
                target="_blank"
                className="text-sm text-primary-teal hover:underline"
              >
                {' '}
                the Common Privacy Policy
              </a>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
            {/*
          <Button color="secondary" onPress={onBack}>
            {t('Back')}
          </Button>
      */}
            <Button
              className="w-full"
              onPress={handleContinue}
              isDisabled={
                !selectedOrganizationId ||
                joinOrganization.isPending ||
                !termsAccepted ||
                !privacyAccepted
              }
            >
              {joinOrganization.isPending ? (
                <LoadingSpinner />
              ) : (
                t('Get Started')
              )}
            </Button>
          </div>
          <a
            className="text-center text-teal hover:underline"
            href="mailto:support@oneproject.org"
            rel="noopener noreferrer"
          >
            {t('Whoops! This is not my organization.')}
          </a>
        </div>
      </FormContainer>
    </div>
  );
};

export const MatchingOrganizationsFormSuspense = (
  props: MatchingOrganizationsFormProps,
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
        <MatchingOrganizationsForm {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
