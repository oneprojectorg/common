'use client';

import { trpc } from '@op/api/client';
import type { LocationData } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import { InputGroupAddon } from '@op/sense/InputGroup';
import type { LngLat } from '@op/sense/Map';
import { Spinner } from '@op/sense/Spinner';
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

const MIN_QUERY_LENGTH = 2;

interface GeoOption {
  id: string;
  /**
   * Place / business name (e.g. "Starbucks"). Empty when the result is a pure
   * street address whose display name is just the address itself — the option
   * then renders the address alone instead of duplicating it.
   */
  name: string;
  address: string;
  location: LocationData;
}

interface LocationSearchFieldProps {
  /** Called with the chosen place when the user selects a search result. */
  onSelect: (location: LocationData) => void;
  /**
   * Map camera target used to bias search results toward this point — so a
   * participant in Stockholm searching a Columbus-OH process still sees
   * Columbus places. Omit for an unbiased global search.
   */
  center?: LngLat;
}

/**
 * Address / landmark search backed by Google Places (`getGeoNames`). Selecting
 * a result hands a full {@link LocationData} (with `placeId` + `address`) back
 * to the picker, which drops the pin and recenters the map.
 *
 * The picker remounts this (via `key`) to reset it after a direct map
 * placement, so it stays uncontrolled here.
 */
export function LocationSearchField({
  onSelect,
  center,
}: LocationSearchFieldProps) {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  // Debounce so we hit Google Places once the user pauses, not on every
  // keystroke (each call is billable + rate-limited).
  const [debouncedQuery] = useDebounce(query, 300);

  const { data, isFetching } = trpc.taxonomy.getGeoNames.useQuery(
    { q: debouncedQuery, center },
    {
      enabled: debouncedQuery.length >= MIN_QUERY_LENGTH,
      placeholderData: (prev) => prev,
    },
  );

  // A search is in flight whenever the query is enabled and react-query is
  // fetching, OR the user has typed past the min length but the debounce
  // window is still open (so the new query hasn't started yet) — without the
  // second leg the indicator flickers off between keystrokes.
  const isSearching =
    query.length >= MIN_QUERY_LENGTH &&
    (isFetching || query !== debouncedQuery);

  const items: GeoOption[] = (data?.geonames ?? []).map((geoname) => {
    const address = geoname.address ?? geoname.name;
    // Hide the name when it just echoes the address (pure street-address
    // results) so we don't render "123 Main St" twice.
    const name = geoname.name && geoname.name !== address ? geoname.name : '';
    return {
      id: geoname.placeId,
      name,
      address,
      location: {
        // A searched result has no separate pin — the place coordinate is both.
        lat: geoname.lat,
        lng: geoname.lng,
        address: geoname.address,
        placeId: geoname.placeId,
        placeLat: geoname.lat,
        placeLng: geoname.lng,
      },
    };
  });

  return (
    <Combobox
      aria-label={t('Search for a location')}
      items={items}
      // Server-side search already filters, so disable base-ui's local filter
      // and drive the option list purely off the debounced query result.
      filter={null}
      onInputValueChange={setQuery}
      itemToStringLabel={(item: GeoOption) =>
        item.name ? `${item.name} ${item.address}` : item.address
      }
      isItemEqualToValue={(a: GeoOption, b: GeoOption) => a.id === b.id}
      onValueChange={(item: GeoOption | null) => {
        if (item) {
          onSelect(item.location);
        }
      }}
    >
      {/* Leading search affordance mirrors the global profile search: the
          magnifying glass becomes a spinner while a query is in flight so the
          user knows the picker is still working before any results land. */}
      <ComboboxInput
        placeholder={t('Address, cross streets, or landmark')}
        showTrigger={false}
      >
        <InputGroupAddon align="inline-start">
          {isSearching ? (
            <Spinner className="size-4 text-muted-foreground" />
          ) : (
            <LuSearch aria-hidden className="size-4" />
          )}
        </InputGroupAddon>
      </ComboboxInput>
      <ComboboxContent>
        <ComboboxEmpty>
          {isSearching
            ? t('Searching…')
            : query.length >= MIN_QUERY_LENGTH
              ? t('No results')
              : null}
        </ComboboxEmpty>
        <ComboboxList>
          {(item: GeoOption) => (
            <ComboboxItem key={item.id} value={item}>
              {/* Two-line presentation so business / POI results read as
                  "Starbucks" + "123 Main St", not as the bare street address. */}
              <div className="flex min-w-0 flex-col">
                {item.name && (
                  <span className="truncate text-foreground" dir="auto">
                    {item.name}
                  </span>
                )}
                <span
                  className={
                    item.name
                      ? 'truncate text-sm text-foreground'
                      : 'truncate text-foreground'
                  }
                  dir="auto"
                >
                  {item.address}
                </span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
