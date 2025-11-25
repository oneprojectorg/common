'use client';

import { trpc } from '@op/api/client';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { useEffect, useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTranslations } from '@/lib/i18n';

import { TermsMultiSelect } from '../../TermsMultiSelect';
import { getFieldErrorMessage } from '../../form/utils';

interface FocusAreasFieldProps {
  profileId: string;
  field: any; // TanStack form field
}

export const FocusAreasField = ({ profileId, field }: FocusAreasFieldProps) => {
  const t = useTranslations();

  const { data: individualTermsData } = useSuspenseQuery({
    queryKey: [['individual', 'getTermsByProfile'], { profileId }],
    queryFn: () => trpc.individual.getTermsByProfile.query({ profileId }),
  });

  // Transform individual terms into Options for the form
  const currentFocusAreas = useMemo((): Option[] => {
    if (!individualTermsData?.['necSimple:focusArea']) {
      return [];
    }

    return individualTermsData['necSimple:focusArea'].map((term: any) => ({
      id: term.id,
      label: term.label,
    }));
  }, [individualTermsData]);

  // Update form field when focus areas load
  useEffect(() => {
    if (
      currentFocusAreas.length > 0 &&
      (!field.state.value || field.state.value.length === 0)
    ) {
      field.handleChange(currentFocusAreas);
    }
  }, [currentFocusAreas, field]);

  return (
    <TermsMultiSelect
      label={t('Focus Areas')}
      taxonomy="necSimple:focusArea"
      value={(field.state.value as Array<Option>) ?? []}
      onChange={field.handleChange}
      errorMessage={getFieldErrorMessage(field)}
    />
  );
};
