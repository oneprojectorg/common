'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Spinner } from '@op/sense/Spinner';
import { cn } from '@op/sense/lib/utils';
import { useRef } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export const ListSearchField = ({
  value,
  onChange,
  isPending,
  className,
  label,
  maxLength,
}: {
  value: string;
  onChange: (next: string) => void;
  isPending?: boolean;
  className?: string;
  label: string;
  maxLength: number;
}) => {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <InputGroup className={cn('w-full shrink-0 md:w-64', className)}>
      <InputGroupAddon>
        {isPending ? <Spinner /> : <LuSearch />}
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        // WebKit paints its own cancel button beside ours.
        className="[&::-webkit-search-cancel-button]:hidden"
        value={value}
        maxLength={maxLength}
        placeholder={label}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t('admin.clearSearchAction')}
            onClick={() => {
              // This button unmounts on the empty value, so focus it away first
              // or it lands on `<body>` and the caller loses their place.
              inputRef.current?.focus();
              onChange('');
            }}
          >
            <LuX />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
};
