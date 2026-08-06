'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { useEffect, useId, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { LabeledFieldSet } from '@/components/decisions/forms/LabeledFieldSet';
import { OptionBox } from '@/components/decisions/forms/OptionBox';

import { useCollaborativeDoc } from './CollaborativeDocContext';

const EMPTY_KEY = '__none__';

interface CollaborativeDropdownFieldProps {
  options: Array<{ value: string; label: string }>;
  initialValue?: string | null;
  onChange?: (value: string | null) => void;
  /** Yjs fragment name used to sync this field. Must be unique per instance. */
  fragmentName: string;
  /** Visible group legend. */
  title: string;
  description?: string;
  /** When true, appends a "None" option that clears the selection back to null. */
  allowEmpty?: boolean;
  /** When true, renders the asterisk and sets `required` on the radio group. */
  required?: boolean;
}

/**
 * Collaborative single-select field synced via Yjs XmlFragment, rendered as a
 * stack of bordered radio option boxes (Figma "Who would primarily benefit from
 * this project?"). When one user picks a value, all connected users see it
 * update in real time.
 *
 * Every option is always visible — no popup, no virtualisation, so a long
 * option vocabulary makes a long list. See `ProposalFormRenderer`.
 */
export function CollaborativeDropdownField({
  options,
  initialValue = null,
  onChange,
  fragmentName,
  title,
  description,
  allowEmpty = false,
  required = false,
}: CollaborativeDropdownFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const idPrefix = useId();
  const legendId = useId();

  const [syncedText, setSyncedText] = useCollaborativeFragment(
    ydoc,
    fragmentName,
    initialValue ?? '',
  );
  const selectedValue = syncedText || null;

  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (lastEmittedValueRef.current === selectedValue) {
      return;
    }

    lastEmittedValueRef.current = selectedValue;
    onChangeRef.current?.(selectedValue);
  }, [selectedValue]);

  if (options.length === 0) {
    return null;
  }

  const handleValueChange = (value: unknown) => {
    setSyncedText(value === EMPTY_KEY || value == null ? '' : String(value));
  };

  // No Figma counterpart, but it's the only way to un-answer an optional
  // question once a radio is picked.
  const radioOptions = allowEmpty
    ? [...options, { value: EMPTY_KEY, label: t('None') }]
    : options;

  return (
    <LabeledFieldSet
      legend={title}
      legendId={legendId}
      description={description}
      required={required}
      data-testid={`field-${fragmentName}`}
    >
      <RadioGroup
        // A <legend> does not name a nested role="radiogroup", so wire it by id.
        aria-labelledby={legendId}
        aria-required={required || undefined}
        required={required}
        value={selectedValue ?? EMPTY_KEY}
        onValueChange={handleValueChange}
        className="w-fit max-w-full"
      >
        {radioOptions.map((option) => {
          const optionId = `${idPrefix}-${option.value}`;
          return (
            <OptionBox
              key={option.value}
              htmlFor={optionId}
              label={option.label}
              control={<RadioGroupItem id={optionId} value={option.value} />}
            />
          );
        })}
      </RadioGroup>
    </LabeledFieldSet>
  );
}
