'use client';

import { trpc } from '@op/api/client';
import type { TermWithChildren } from '@op/common';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import { Label } from '@op/sense/Label';
import { Spinner } from '@op/sense/Spinner';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { Option } from '../multiSelectOption';

export type { Option };

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
  showDefinitions = false,
}: {
  label?: string;
  placeholder?: string;
  taxonomy: string;
  value: Array<Option>;
  onChange: (value: Array<Option>) => void;
  isRequired?: boolean;
  errorMessage?: string;
  showDefinitions?: boolean;
}) => {
  const t = useTranslations();
  const [termsQuery, setTermsQuery] = useState('');
  const { data: terms, isLoading } = trpc.taxonomy.getTerms.useQuery({
    name: taxonomy,
    q: termsQuery.length >= 2 ? termsQuery : undefined,
  });

  const selectedOptions = value ?? [];

  // Hide already-selected options (as the previous MultiSelectComboBox did);
  // base-ui applies the local text filter on top of what remains.
  const items: Option[] = (terms ? flattenTermTree(terms) : []).filter(
    (o) => !selectedOptions.some((s) => s.id === o.id),
  );

  const loading = isLoading && termsQuery.length >= 2;

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <Label>
          {label}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}
      <Combobox
        multiple
        items={items}
        value={selectedOptions}
        onValueChange={(next) => onChange(next)}
        onInputValueChange={(inputValue) => setTermsQuery(inputValue)}
        itemToStringLabel={(option: Option) => option.label}
        isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      >
        <ComboboxChips>
          {selectedOptions.map((option) => (
            <ComboboxChip key={option.id}>{option.label}</ComboboxChip>
          ))}
          <ComboboxChipsInput
            placeholder={placeholder ?? t('Select one or more')}
            aria-invalid={errorMessage ? true : undefined}
          />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>
            {loading ? <Spinner className="size-4" /> : null}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: FlattenedTerm) => {
              // Parent terms (with children) are shown as non-selectable
              // section labels, matching disableParentSelection.
              const isParent = item.hasChildren;

              return (
                <ComboboxItem
                  key={item.id}
                  value={item}
                  disabled={isParent}
                  className={
                    isParent ? 'text-sm text-neutral-gray4' : undefined
                  }
                  style={{
                    paddingInlineStart: `${12 + (item.level ?? 0) * 12}px`,
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span>{item.label}</span>
                    {showDefinitions && item.definition && !isParent ? (
                      <span className="text-start text-sm text-neutral-charcoal">
                        {item.definition}
                      </span>
                    ) : null}
                  </div>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {errorMessage && (
        <p className="text-sm text-functional-red">{errorMessage}</p>
      )}
    </div>
  );
};
