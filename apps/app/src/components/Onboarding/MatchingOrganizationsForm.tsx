import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ReactNode, useEffect, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { StepProps } from '../MultiStepForm';
import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';
import { OrganizationAvatar } from '../OrganizationAvatar';

export const validator = z.object({
  selectedOrganizationId: z.string().optional(),
});


export const MatchingOrganizationsForm = ({
  onNext,
  onBack,
  className,
}: StepProps & { className?: string }): ReactNode => {
  const t = useTranslations();
  const getMatchingDomainOrgs = trpc.account.listMatchingDomainOrganizations.useQuery();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | undefined>();

  // If no matching organizations, automatically proceed to next step
  useEffect(() => {
    if (!getMatchingDomainOrgs.isLoading && getMatchingDomainOrgs.data?.length === 0) {
      onNext({});
    }
  }, [getMatchingDomainOrgs.isLoading, getMatchingDomainOrgs.data, onNext]);

  const handleContinue = () => {
    onNext({ selectedOrganizationId });
  };

  // Show loading while fetching
  if (getMatchingDomainOrgs.isLoading) {
    return (
      <div className={className}>
        <FormContainer>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        </FormContainer>
      </div>
    );
  }

  // Don't render if no organizations (useEffect will handle navigation)
  if (!getMatchingDomainOrgs.data || getMatchingDomainOrgs.data.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <FormContainer>
        <FormHeader text={t('Found existing organizations')}>
          {t('We found organizations that match your email domain. Would you like to join one of them instead of creating a new organization?')}
        </FormHeader>

        <div className="space-y-4">
          {getMatchingDomainOrgs.data.map((org) => (
            <label
              key={org.id}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input
                type="radio"
                name="selectedOrganization"
                value={org.id}
                checked={selectedOrganizationId === org.id}
                onChange={(e) => {
                  setSelectedOrganizationId(e.target.value);
                }}
                className="w-4 h-4 text-blue-600"
              />
              <OrganizationAvatar 
                organization={org} 
                className="size-12"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{org.name}</h3>
                {org.bio && (
                  <p className="text-sm text-gray-600 mt-1">{org.bio}</p>
                )}
                {org.city && org.state && (
                  <p className="text-xs text-gray-500 mt-1">
                    {org.city}, {org.state}
                  </p>
                )}
              </div>
            </label>
          ))}

          <label className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="radio"
              name="selectedOrganization"
              value=""
              checked={selectedOrganizationId === undefined}
              onChange={() => {
                setSelectedOrganizationId(undefined);
              }}
              className="w-4 h-4 text-blue-600"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{t('Create a new organization')}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {t('None of these organizations match what I\'m looking for')}
              </p>
            </div>
          </label>
        </div>

        <div className="flex flex-col-reverse justify-between gap-4 sm:flex-row sm:gap-2">
          <Button color="secondary" onPress={onBack}>
            {t('Back')}
          </Button>
          <Button className="sm:w-full" onPress={handleContinue}>
            {t('Continue')}
          </Button>
        </div>
      </FormContainer>
    </div>
  );
};