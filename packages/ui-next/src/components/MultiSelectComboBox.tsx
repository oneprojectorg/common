// Compat wrapper for @op/ui's MultiSelectComboBox. Composes vanilla shadcn
// Combobox primitives with selectionMode="multiple" + chip rendering.
//
// API map:
//   value/onChange        -> value/onValueChange (Option[])
//   onInputUpdate         -> onInputValueChange (server-side filter hook)
//   enableLocalSearch     -> filter prop (custom no-op when false)
//   items                 -> items prop
//   allowAdditions        -> Enter key creates isNewValue item
//   showDefinitions       -> renders option.definition under label
//   disableParentSelection-> disables items with hasChildren
//   level                 -> indent padding on ComboboxItem

'use client';

import * as React from 'react';
import { LuSearch } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { FieldLabel } from './Field';
import { LoadingSpinner } from './LoadingSpinner';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from './ui/combobox';

export interface Option {
  id: string;
  label: string;
  definition?: string | null;
  isNewValue?: boolean;
  level?: number;
  hasChildren?: boolean;
}

export type MultiSelectComboBoxProps = {
  items: Array<Option>;
  label?: string;
  placeholder?: string;
  isRequired?: boolean;
  value?: Array<Option>;
  onChange?: (value: Array<Option>) => void;
  onInputUpdate?: (value: string) => void;
  errorMessage?: string;
  allowAdditions?: boolean;
  showDefinitions?: boolean;
  disableParentSelection?: boolean;
  enableLocalSearch?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
};

export const MultiSelectComboBox = ({
  items = [],
  label,
  placeholder,
  isRequired,
  value,
  onChange,
  onInputUpdate,
  errorMessage,
  allowAdditions,
  showDefinitions = false,
  disableParentSelection = true,
  enableLocalSearch = true,
  isLoading = false,
  isDisabled = false,
}: MultiSelectComboBoxProps) => {
  const [inputValue, setInputValue] = React.useState('');
  const selectedOptions = value ?? [];
  const anchorRef = useComboboxAnchor();

  const handleValueChange = (next: unknown) => {
    onChange?.(next as Option[]);
  };

  const handleInputValueChange = (next: string) => {
    setInputValue(next);
    onInputUpdate?.(next);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!allowAdditions) return;
    if (e.key !== 'Enter') return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (selectedOptions.some((item) => item.label === trimmed)) return;
    e.preventDefault();
    onChange?.([
      ...selectedOptions,
      { id: trimmed, label: trimmed, isNewValue: true },
    ]);
    setInputValue('');
    onInputUpdate?.('');
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <FieldLabel>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}

      <Combobox<Option, true>
        items={items}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.id}
        multiple
        value={selectedOptions}
        onValueChange={handleValueChange}
        inputValue={inputValue}
        onInputValueChange={handleInputValueChange}
        filter={enableLocalSearch ? undefined : () => true}
        disabled={isDisabled}
      >
        <div className="relative">
          <ComboboxChips
            ref={anchorRef}
            className={cn(
              'pr-8',
              errorMessage && 'border-destructive ring-destructive/20',
            )}
          >
            {selectedOptions.map((option) => (
              <ComboboxChip
                key={option.isNewValue ? `new-${option.label}` : option.id}
              >
                {option.label}
              </ComboboxChip>
            ))}
            <ComboboxChipsInput
              placeholder={placeholder}
              onKeyDown={handleInputKeyDown}
            />
          </ComboboxChips>
          <span className="text-muted-foreground pointer-events-none absolute top-2 right-2.5 flex size-4 items-center justify-center">
            {isLoading ? (
              <LoadingSpinner className="size-4" color="gray" />
            ) : (
              <LuSearch className="size-4" />
            )}
          </span>
        </div>
        <ComboboxContent anchor={anchorRef}>
          <ComboboxEmpty>No options</ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => {
              const isParent = disableParentSelection && item.hasChildren;
              return (
                <ComboboxItem
                  key={item.id}
                  value={item}
                  disabled={isParent}
                  className={cn(
                    'flex-col items-start',
                    isParent && 'text-muted-foreground',
                  )}
                  style={{
                    paddingLeft: `${6 + (item.level ?? 0) * 12}px`,
                  }}
                >
                  <span>{item.label}</span>
                  {showDefinitions && item.definition && !isParent ? (
                    <span className="text-muted-foreground text-left text-sm text-wrap">
                      {item.definition}
                    </span>
                  ) : null}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {errorMessage && (
        <p className="text-destructive text-sm">{errorMessage}</p>
      )}
    </div>
  );
};
