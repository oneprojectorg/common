'use client';

import { trpc } from '@op/api/client';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export const GeoNamesMultiSelect = ({
  label,
  value,
  onChange,
  isRequired = false,
}: {
  label: string;
  value: Array<Option>;
  onChange: (value: Array<Option>) => void;
  isRequired?: boolean;
}) => {
  const t = useTranslations();
  const [whereWeWorkQuery, setWhereWeWorkQuery] = useState('');
  const { data: geoNames, isLoading } = trpc.taxonomy.getGeoNames.useQuery(
    {
      q: whereWeWorkQuery,
    },
    {
      enabled: whereWeWorkQuery.length >= 2,
      placeholderData: (prev) => prev,
    },
  );

  return (
    <MultiSelectComboBox
      placeholder={t('Select locations')}
      enableLocalSearch={false}
      label={label}
      isRequired={isRequired}
      onChange={(value) => onChange(value)}
      onInputUpdate={(inputValue) => {
        setWhereWeWorkQuery(inputValue);
      }}
      value={value ?? []}
      items={
        geoNames?.geonames
          .map((item) => {
            const { name } = item;
            // @ts-ignore
            item.placeId = item.id;

            return {
              id: item.id,
              label: item.address ?? name,
              data: { ...item, id: undefined },
            };
          })
          .filter((o) => !!o) ?? []
      }
      isLoading={isLoading && whereWeWorkQuery.length >= 2}
    />
  );
};
