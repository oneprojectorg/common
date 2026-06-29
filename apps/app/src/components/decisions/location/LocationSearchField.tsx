'use client';

import { trpc } from '@op/api/client';
import type { LocationData } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { ComboBox, ComboBoxItem } from '@op/ui/ComboBox';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import type { LngLat } from '@op/ui/Map';
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
    <ComboBox
      aria-label={t('Search for a location')}
      items={items}
      // Mirrors the global profile search: the magnifying glass becomes a
      // spinner while a query is in flight so the user knows the picker is
      // still working before any results land.
      icon={
        isSearching ? (
          <LoadingSpinner className="size-4 text-neutral-gray4" />
        ) : (
          <LuSearch aria-hidden className="size-4" />
        )
      }
      placeholder={t('Address, cross streets, or landmark')}
      menuTrigger="input"
      // Keep the popover open as soon as the query passes the min length so a
      // "Searching…" / "No results" state can replace it once results land.
      // Closing it mid-flight (e.g. gating on `!isSearching`) wedges the
      // dropdown: react-aria does not auto-reopen when items arrive, so the
      // user only sees results after blurring and refocusing the input.
      allowsEmptyCollection={query.length >= MIN_QUERY_LENGTH}
      onInputChange={setQuery}
      onSelectionChange={(key) => {
        const item = items.find((option) => option.id === key);
        if (item) {
          onSelect(item.location);
        }
      }}
      renderEmptyState={() => (
        <div className="px-3 py-2 text-sm text-neutral-charcoal">
          {isSearching ? t('Searching…') : t('No results')}
        </div>
      )}
    >
      {(item) => (
        <ComboBoxItem
          id={item.id}
          textValue={item.name ? `${item.name} ${item.address}` : item.address}
        >
          {/* Two-line presentation so business / POI results read as
              "Starbucks" + "123 Main St", not as the bare street address. */}
          <div className="flex min-w-0 flex-col">
            {item.name && (
              <span className="truncate text-neutral-black" dir="auto">
                {item.name}
              </span>
            )}
            <span
              className={
                item.name
                  ? 'truncate text-sm text-neutral-charcoal'
                  : 'truncate text-neutral-black'
              }
              dir="auto"
            >
              {item.address}
            </span>
          </div>
        </ComboBoxItem>
      )}
    </ComboBox>
  );
}
