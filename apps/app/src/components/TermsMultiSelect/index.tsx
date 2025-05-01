'use client';

import { trpc } from '@op/trpc/client';
import { MultiSelectComboBox } from '@op/ui/MultiSelectComboBox';
import type {
  MultiSelectComboBoxProps,
  Option,
} from '@op/ui/MultiSelectComboBox';
import { useState } from 'react';

export const TermsMultiSelect = ({
  label,
  placeholder,
  value,
  onChange,
  taxonomy,
  isRequired = false,
  ...props
}: {
  label?: string;
  placeholder?: string;
  taxonomy: string;
  value: Array<Option>;
  onChange: (value: Array<Option>) => void;
  isRequired?: boolean;
} & Omit<MultiSelectComboBoxProps, 'items'>) => {
  const [termsQuery, setTermsQuery] = useState('');
  const { data: terms } = trpc.taxonomy.getTerms.useQuery({
    name: taxonomy,
    q: termsQuery.length >= 2 ? termsQuery : undefined,
  });

  return (
    <MultiSelectComboBox
      {...props}
      label={label}
      placeholder={placeholder ?? 'Select one or more…'}
      isRequired={isRequired}
      onChange={(value) => onChange(value)}
      onInputUpdate={(inputValue) => {
        setTermsQuery(inputValue);
      }}
      value={value ?? []}
      items={
        terms
          ?.map((item): Option | null => {
            if (typeof item.id !== 'string' || typeof item.label !== 'string') {
              return null;
            }
            return {
              id: item.id,
              label: item.label,
            };
          })
          .filter((o) => o !== null) ?? []
      }
    />
  );
};
