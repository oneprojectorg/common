'use client';

import type { LocationData } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { MapCanvas } from './dynamicMap';
import { MAP_STYLE_URL } from './mapConfig';

interface LocationMapViewProps {
  value: LocationData | null;
}

/**
 * Read-only location display for a submitted proposal: a map centered on the
 * pin with the resolved address beneath it. Same look as the editable picker
 * minus the search field and pin interactions. The proposal's council district
 * is already stored as a category and shown via the normal category display, so
 * this view needs no live boundary lookup.
 */
export function LocationMapView({ value }: LocationMapViewProps) {
  const t = useTranslations();

  if (!value || !MAP_STYLE_URL) {
    return <p className="text-sm text-neutral-gray3 italic">—</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-gray1">
      <MapCanvas
        styleUrl={MAP_STYLE_URL}
        center={{ lng: value.lng, lat: value.lat }}
        marker={{ lng: value.lng, lat: value.lat }}
        ariaLabel={t('Project location map')}
        className="border-b border-neutral-gray1"
      />
      <div className="flex flex-col gap-0.5 p-4">
        <span className="text-neutral-black" dir="auto">
          {value.address ?? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}
        </span>
      </div>
    </div>
  );
}
