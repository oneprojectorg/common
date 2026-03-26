'use client';

import { Button } from '@op/ui/Button';
import { TextField } from '@op/ui/TextField';
import { ReactNode, useState } from 'react';
import { LuSearch } from 'react-icons/lu';

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
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex w-full max-w-lg flex-col items-center">
      <FormContainer>
        <FormHeader text={t('Find organizations you belong to')}>
          {t(
            'Select the organization(s) you want to link to your Common profile. You can add more later from your profile.',
          )}
        </FormHeader>

        <div className="flex flex-col gap-6">
          {/* Search input */}
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            inputProps={{
              placeholder: t('Search or add your organization...'),
              icon: <LuSearch className="size-4 text-neutral-gray4" />,
            }}
            aria-label={t('Search or add your organization...')}
          />

          {/* Divider with "or" */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-neutral-gray1" />
            <span className="text-sm text-neutral-gray4">{t('or')}</span>
            <div className="h-px flex-1 bg-neutral-gray1" />
          </div>

          {/* Skip for now button */}
          <Button className="w-full" color="neutral" onPress={onSkip}>
            {t('Skip for now')}
          </Button>
        </div>
      </FormContainer>
    </div>
  );
};
