'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Search input with a leading magnifier and a trailing clear button, built on
 * `@op/sense` primitives. `value`/`onChange` are controlled by the caller
 * (which owns debouncing).
 */
export const TableSearchField = ({
  value,
  onChange,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) => {
  const t = useTranslations();

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <LuSearch />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t('Clear search')}
            onClick={() => onChange('')}
          >
            <LuX />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
};
