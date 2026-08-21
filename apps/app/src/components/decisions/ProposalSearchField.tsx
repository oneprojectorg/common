'use client';

import { PROPOSAL_SEARCH_MAX_LENGTH } from '@op/common/client';
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

/** Title search for the proposals filter bar. Debounced by the caller. */
export const ProposalSearchField = ({
  value,
  onChange,
  isPending,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  /** A query is in flight — results on screen are for an earlier term. */
  isPending?: boolean;
  className?: string;
}) => {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    // Sized to hold the longest translated placeholder rather than the English
    // one — French runs to "Rechercher des propositions".
    <InputGroup className={cn('w-full shrink-0 md:w-96', className)}>
      <InputGroupAddon>
        {isPending ? <Spinner /> : <LuSearch />}
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="search"
        // WebKit paints its own cancel button beside ours.
        className="[&::-webkit-search-cancel-button]:hidden"
        value={value}
        // Matches the endpoint's cap: over it the query fails input validation
        // and the error boundary swallows the list — this field included.
        maxLength={PROPOSAL_SEARCH_MAX_LENGTH}
        placeholder={t('Search proposals')}
        aria-label={t('Search proposals')}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t('Clear search')}
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
