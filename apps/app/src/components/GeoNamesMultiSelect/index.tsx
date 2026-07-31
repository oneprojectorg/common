'use client';

import { trpc } from '@op/api/client';
import { useDebounce } from '@op/hooks';
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
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { Option } from '../multiSelectOption';

export type { Option };

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
  const [debouncedQuery] = useDebounce(whereWeWorkQuery, 300);
  const { data: geoNames, isLoading } = trpc.taxonomy.getGeoNames.useQuery(
    {
      q: debouncedQuery,
    },
    {
      enabled: debouncedQuery.length >= 2,
      placeholderData: (prev) => prev,
    },
  );

  const selectedOptions = value ?? [];

  // Server-side search already filters, so we disable local filtering below;
  // here we only hide options that are already selected (as the previous
  // MultiSelectComboBox did).
  const items: Option[] =
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
      .filter((o) => !selectedOptions.some((s) => s.id === o.id)) ?? [];

  const loading = isLoading && debouncedQuery.length >= 2;

  return (
    <div className="flex w-full flex-col gap-2">
      <Label>
        {label}
        {isRequired && <span className="text-functional-red"> *</span>}
      </Label>
      <Combobox
        multiple
        items={items}
        value={selectedOptions}
        onValueChange={(next) => onChange(next)}
        filter={null}
        onInputValueChange={(inputValue) => setWhereWeWorkQuery(inputValue)}
        itemToStringLabel={(option: Option) => option.label}
        isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      >
        <ComboboxChips>
          <LuSearch className="size-4 shrink-0 self-center text-muted-foreground" />
          {selectedOptions.map((option) => (
            <ComboboxChip key={option.id}>{option.label}</ComboboxChip>
          ))}
          <ComboboxChipsInput placeholder={t('Select locations')} />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>
            {loading ? (
              <Spinner className="size-4" />
            ) : debouncedQuery.length >= 2 ? (
              t('No results')
            ) : null}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.id} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};
