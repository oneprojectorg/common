'use client';

import { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FormContainer } from '../form/FormContainer';
import { FormHeader } from '../form/FormHeader';

export type OrganizationSearchScreenProps = {
  onContinue: (selectedOrgs: Array<{ id: string; profileId: string }>) => void;
  onSkip: () => void;
};

export const OrganizationSearchScreen = ({
  onSkip,
}: OrganizationSearchScreenProps): ReactNode => {
  const t = useTranslations();

  void onSkip;

  return (
    <div className="flex w-full max-w-lg flex-col items-center">
      <FormContainer>
        <FormHeader text={t('Find organizations you belong to')}>
          {t(
            'Select the organization(s) you want to link to your Common profile. You can add more later from your profile.',
          )}
        </FormHeader>

        {/* Search input, dropdown, chips - implemented in US-002 through US-004 */}
        {/* Skip button - implemented in US-002 */}
      </FormContainer>
    </div>
  );
};
