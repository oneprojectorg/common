'use client';

import { useState } from 'react';

import { DropdownFieldSelect } from '@/components/form/DropdownFieldSelect';
import { MultiSelectPopoverField } from '@/components/form/MultiSelectPopoverField';

import { FieldHeader } from '../forms/FieldHeader';

type Option = { value: string; label: string };

/**
 * Interactive (uncontrolled, local-only) dropdown for the template builder
 * preview. Renders the same `DropdownFieldSelect` participants see, reset
 * whenever the authored option set changes.
 */
export function PreviewDropdownField({
  options,
  title,
  description,
  required,
  placeholder,
}: {
  options: Option[];
  title?: string;
  description?: string;
  required?: boolean;
  placeholder: string;
}) {
  const optionsKey = options.map((opt) => opt.value).join('|');
  const content = (
    <DropdownFieldSelect
      key={optionsKey}
      options={options}
      placeholder={placeholder}
      allowEmpty={!required}
      required={required}
    />
  );

  if (!title && !description) {
    return content;
  }

  return (
    <div className="flex flex-col gap-2">
      <FieldHeader
        title={title}
        description={description}
        required={required}
      />
      {content}
    </div>
  );
}

/**
 * Interactive (local-only) multi-select popover for the template builder
 * preview. Selection is never persisted or reported to the parent form.
 */
export function PreviewMultiSelectField({
  options,
  placeholder,
}: {
  options: Option[];
  placeholder: string;
}) {
  const optionsKey = options.map((opt) => opt.value).join('|');
  // Reset the local selection when the authored option set changes, without
  // needing the caller to key this component instance.
  const [state, setState] = useState({ optionsKey, values: [] as string[] });
  if (state.optionsKey !== optionsKey) {
    setState({ optionsKey, values: [] });
  }

  return (
    <div className="min-w-0">
      <MultiSelectPopoverField
        options={options}
        selectedValues={state.values}
        onSelectionChange={(values) => setState({ optionsKey, values })}
        placeholder={placeholder}
      />
    </div>
  );
}
