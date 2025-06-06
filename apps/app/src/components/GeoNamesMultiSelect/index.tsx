'use client';

import { trpc } from '@op/api/client';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import type { Option } from '@op/ui/MultiSelectComboBox';
import { useState } from 'react';

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
  const [whereWeWorkQuery, setWhereWeWorkQuery] = useState('');
  const { data: geoNames } = trpc.taxonomy.getGeoNames.useQuery(
    {
      q: whereWeWorkQuery,
    },
    {
      enabled: whereWeWorkQuery.length >= 2,
    },
  );

  return (
    <MultiSelectComboBox
      placeholder="Select locations…"
      allowAdditions
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
            const entries = Object.entries(item)[0];

            if (!entries?.length) {
              return null;
            }

            const [name, data] = entries;

            return {
              id: name,
              label: name,
              data,
            };
          })
          .filter((o) => !!o) ?? []
      }
    />
  );
};
