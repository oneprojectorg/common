'use client';

import { trpc } from '@op/api/client';
import type { LocationData } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { ComboBox, ComboBoxItem } from '@op/ui/ComboBox';
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface GeoOption {
  id: string;
  label: string;
  location: LocationData;
}

interface LocationSearchFieldProps {
  /** Called with the chosen place when the user selects a search result. */
  onSelect: (location: LocationData) => void;
}

/**
 * Address / landmark search backed by Google Places (`getGeoNames`). Selecting
 * a result hands a full {@link LocationData} (with `placeId` + `address`) back
 * to the picker, which drops the pin and recenters the map.
 *
 * The picker remounts this (via `key`) to reset it after a direct map
 * placement, so it stays uncontrolled here.
 */
export function LocationSearchField({ onSelect }: LocationSearchFieldProps) {
  const t = useTranslations();
  const [query, setQuery] = useState('');
  // Debounce so we hit Google Places once the user pauses, not on every
  // keystroke (each call is billable + rate-limited).
  const [debouncedQuery] = useDebounce(query, 300);

  const { data } = trpc.taxonomy.getGeoNames.useQuery(
    { q: debouncedQuery },
    { enabled: debouncedQuery.length >= 2, placeholderData: (prev) => prev },
  );

  const items: GeoOption[] = (data?.geonames ?? []).map((geoname) => ({
    id: geoname.placeId,
    label: geoname.address ?? geoname.name,
    location: {
      // A searched result has no separate pin — the place coordinate is both.
      lat: geoname.lat,
      lng: geoname.lng,
      address: geoname.address,
      placeId: geoname.placeId,
      placeLat: geoname.lat,
      placeLng: geoname.lng,
    },
  }));

  return (
    <ComboBox
      aria-label={t('Search for a location')}
      items={items}
      icon={<LuSearch aria-hidden className="size-4" />}
      placeholder={t('Address, cross streets, or landmark')}
      menuTrigger="input"
      allowsEmptyCollection
      onInputChange={setQuery}
      onSelectionChange={(key) => {
        const item = items.find((option) => option.id === key);
        if (item) {
          onSelect(item.location);
        }
      }}
    >
      {(item) => <ComboBoxItem id={item.id}>{item.label}</ComboBoxItem>}
    </ComboBox>
  );
}
