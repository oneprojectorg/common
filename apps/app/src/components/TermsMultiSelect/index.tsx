'use client';

import { trpc } from '@op/api/client';
import type { TermWithChildren } from '@op/common';
import {
  Combobox,
  ComboboxSeparator,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@op/sense/Combobox';
import { Label } from '@op/sense/Label';
import { Spinner } from '@op/sense/Spinner';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { Option } from '../multiSelectOption';

export type { Option };

type TermGroup = {
  id: string;
  // null label = leading bucket of top-level (ungrouped) selectable terms.
  label: string | null;
  items: Option[];
};

const toOption = (term: TermWithChildren): Option => ({
  id: term.id,
  label: term.label,
  definition: term.definition,
});

// All selectable leaves (terms with no children) under a term, at any depth —
// deeper nesting collapses into the top-level group.
const collectLeaves = (term: TermWithChildren): Option[] =>
  term.children.length === 0
    ? [toOption(term)]
    : term.children.flatMap(collectLeaves);

// Shape the taxonomy for base-ui's native grouping: each top-level category
// becomes a labelled group (its descendant leaves flattened in); any top-level
// selectable terms go in a leading unlabelled group. Already-selected options
// are removed and empty groups dropped. base-ui handles query filtering and
// hides groups whose items all filter out.
const buildTermGroups = (
  terms: TermWithChildren[],
  selectedIds: Set<string>,
): TermGroup[] => {
  const ungrouped: Option[] = [];
  const groups: TermGroup[] = [];

  for (const term of terms) {
    if (term.children.length === 0) {
      ungrouped.push(toOption(term));
    } else {
      groups.push({
        id: term.id,
        label: term.label,
        items: collectLeaves(term),
      });
    }
  }

  const withUngrouped = ungrouped.length
    ? [{ id: '__ungrouped__', label: null, items: ungrouped }, ...groups]
    : groups;

  return withUngrouped
    .map((group) => ({
      ...group,
      items: group.items.filter((option) => !selectedIds.has(option.id)),
    }))
    .filter((group) => group.items.length > 0);
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
  // Controlled vocabularies are small, so fetch the whole tree once and let
  // base-ui filter client-side (no server query needed).
  const { data: terms, isLoading } = trpc.taxonomy.getTerms.useQuery({
    name: taxonomy,
  });

  const selectedOptions = value ?? [];
  const selectedIds = new Set(selectedOptions.map((option) => option.id));
  const groups = buildTermGroups(terms ?? [], selectedIds);

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <Label>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <Combobox
        multiple
        items={groups}
        value={selectedOptions}
        onValueChange={(next) => onChange(next)}
        itemToStringLabel={(option: Option) => option.label}
        isItemEqualToValue={(a: Option, b: Option) => a.id === b.id}
      >
        <ComboboxChips>
          <LuSearch className="size-4 shrink-0 self-center text-muted-foreground" />
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
            {isLoading ? <Spinner className="size-4" /> : t('No results')}
          </ComboboxEmpty>
          <ComboboxList>
            {(group: TermGroup, index: number) => (
              <ComboboxGroup key={group.id} items={group.items}>
                {group.label ? (
                  <ComboboxLabel>{group.label}</ComboboxLabel>
                ) : null}
                <ComboboxCollection>
                  {(item: Option) => (
                    <ComboboxItem key={item.id} value={item}>
                      <div className="flex flex-col items-start">
                        <span>{item.label}</span>
                        {showDefinitions && item.definition ? (
                          <span className="text-start text-sm text-muted-foreground">
                            {item.definition}
                          </span>
                        ) : null}
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
                {index < groups.length - 1 && <ComboboxSeparator />}
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
};
