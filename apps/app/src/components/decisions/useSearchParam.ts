'use client';

import { SEARCH_MAX_LENGTH } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { parseAsString, useQueryState } from 'nuqs';
import { useDeferredValue } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

export const useSearchParam = ({
  key,
  maxLength = SEARCH_MAX_LENGTH,
}: {
  key: string;
  maxLength?: number;
}) => {
  const [urlSearch, setSearch] = useQueryState(
    key,
    parseAsString.withDefault(''),
  );
  const search = urlSearch.slice(0, maxLength);
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const appliedSearch = useDeferredValue(debouncedSearch);

  return {
    search,
    setSearch,
    debouncedSearch,
    appliedSearch,
    isSearchPending: appliedSearch !== debouncedSearch,
  };
};
