'use client';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@op/sense/InputGroup';
import { Spinner } from '@op/sense/Spinner';
import { LuSearch, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Title search for the proposals filter bar. Debounced by the caller. */
export const ProposalSearchField = ({
  value,
  onChange,
  isPending,
}: {
  value: string;
  onChange: (next: string) => void;
  /** A query is in flight — results on screen are for an earlier term. */
  isPending?: boolean;
}) => {
  const t = useTranslations();

  return (
    <InputGroup className="w-full shrink-0 md:w-52">
      <InputGroupAddon>
        {isPending ? <Spinner /> : <LuSearch />}
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        // WebKit paints its own cancel button beside ours.
        className="[&::-webkit-search-cancel-button]:hidden"
        value={value}
        placeholder={t('Search proposals')}
        aria-label={t('Search proposals')}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t('Clear search')}
            onClick={() => onChange('')}
          >
            <LuX />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
};
