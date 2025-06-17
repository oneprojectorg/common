'use client';

import { trpc } from '@op/api/client';
import type { TermWithChildren } from '@op/common';
import { MultiSelectComboBox, type Option } from '@op/ui/MultiSelectComboBox';
import { useState } from 'react';

type FlattenedTerm = Option & {
  level: number;
  hasChildren: boolean;
};

const flattenTermTree = (
  terms: TermWithChildren[],
  level = 0,
): FlattenedTerm[] => {
  return terms.reduce<FlattenedTerm[]>((acc, term) => {
    const flatTerm: FlattenedTerm = {
      id: term.id,
      label: term.label,
      definition: term.definition,
      level,
      hasChildren: term.children.length > 0,
    };

    acc.push(flatTerm);

    if (term.children.length > 0) {
      acc.push(...flattenTermTree(term.children, level + 1));
    }

    return acc;
  }, []);
};

export const TermsMultiSelect = ({
  label,
  placeholder,
  value,
  onChange,
  taxonomy,
  isRequired = false,
  errorMessage,
}: {
  label?: string;
  placeholder?: string;
  taxonomy: string;
  value: Array<Option>;
  onChange: (value: Array<Option>) => void;
  isRequired?: boolean;
  errorMessage?: string;
}) => {
  const [termsQuery, setTermsQuery] = useState('');
  const { data: terms } = trpc.taxonomy.getTerms.useQuery({
    name: taxonomy,
    q: termsQuery.length >= 2 ? termsQuery : undefined,
  });

  const flattenedTerms = terms ? flattenTermTree(terms) : [];

  return (
    <MultiSelectComboBox
      label={label}
      placeholder={placeholder ?? 'Select one or more…'}
      isRequired={isRequired}
      onChange={(value) => onChange(value)}
      onInputUpdate={(inputValue) => {
        setTermsQuery(inputValue);
      }}
      value={value ?? []}
      items={flattenedTerms}
      errorMessage={errorMessage}
      allowAdditions
      enableLocalSearch
    />
  );
};
