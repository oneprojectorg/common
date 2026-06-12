'use client';

import { trpc } from '@op/api/client';
import type { LocationData } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { FieldError } from '@op/ui/Field';
import type { LngLat } from '@op/ui/Map';
import { useCallback, useState } from 'react';
import { LuLocate } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CouncilDistrictBadge } from './CouncilDistrictBadge';
import { LocationSearchField } from './LocationSearchField';
import { MapCanvas } from './dynamicMap';
import { DEFAULT_MAP_CENTER, MAP_STYLE_URL } from './mapConfig';
import { useProjectAreaCheck } from './useProjectAreaCheck';

interface LocationMapFieldProps {
  value: LocationData | null;
  onChange: (value: LocationData | null) => void;
}

/**
 * Editable map location picker for proposal submissions: address/landmark
 * search, click-to-place, drag-to-move, and "use my location" — each resolved
 * to an address + Google `placeId` via geocoding. Placements outside every
 * persisted boundary show an out-of-area error (see {@link useProjectAreaCheck}).
 *
 * `center` (camera) is tracked separately from `value` (the pin) so dragging
 * or clicking moves the pin without the camera lurching; only search and
 * "use my location" recenter.
 */
export function LocationMapField({ value, onChange }: LocationMapFieldProps) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [center, setCenter] = useState<LngLat>(
    value ? { lng: value.lng, lat: value.lat } : DEFAULT_MAP_CENTER,
  );
  // Bumped on every direct map placement to clear the search box.
  const [searchResetToken, setSearchResetToken] = useState(0);

  const { isWithinArea, boundaryName } = useProjectAreaCheck(
    value ? { lng: value.lng, lat: value.lat } : null,
  );

  const placeFromCoordinates = useCallback(
    async (lngLat: LngLat) => {
      // The user placed the pin directly — clear any stale search result.
      setSearchResetToken((token) => token + 1);

      // Commit the dropped coordinate immediately so the controlled marker
      // sticks at the new spot instead of snapping back to its prior position
      // while reverse geocoding is in flight.
      onChange({ lat: lngLat.lat, lng: lngLat.lng });

      try {
        const { geoname } = await utils.taxonomy.reverseGeocode.fetch({
          lat: lngLat.lat,
          lng: lngLat.lng,
        });
        // Enrich the already-committed pin with the resolved address/place.
        onChange({
          lat: lngLat.lat,
          lng: lngLat.lng,
          address: geoname?.address,
          placeId: geoname?.placeId,
          placeLat: geoname?.lat,
          placeLng: geoname?.lng,
        });
      } catch {
        // Reverse geocoding failed — the bare coordinate is already committed.
      }
    },
    [onChange, utils],
  );

  const handleSelect = useCallback(
    (location: LocationData) => {
      setCenter({ lng: location.lng, lat: location.lat });
      onChange(location);
    },
    [onChange],
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const lngLat = {
        lng: position.coords.longitude,
        lat: position.coords.latitude,
      };
      setCenter(lngLat);
      void placeFromCoordinates(lngLat);
    });
  }, [placeFromCoordinates]);

  if (!MAP_STYLE_URL) {
    return (
      <FieldError>
        {t('The map is unavailable because it has not been configured.')}
      </FieldError>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <LocationSearchField key={searchResetToken} onSelect={handleSelect} />

      <div
        className={`overflow-hidden rounded-lg border ${
          isWithinArea ? 'border-neutral-gray1' : 'border-functional-red'
        }`}
      >
        <MapCanvas
          styleUrl={MAP_STYLE_URL}
          center={center}
          marker={value ? { lng: value.lng, lat: value.lat } : null}
          draggable
          onMapClick={placeFromCoordinates}
          onMarkerDragEnd={placeFromCoordinates}
          ariaLabel={t('Project location map')}
        />

        <div className="flex flex-col justify-between gap-2.5 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={
                isWithinArea ? 'text-neutral-black' : 'text-functional-red'
              }
              dir="auto"
            >
              {/* While reverse geocoding is in flight `address` is undefined —
                  render nothing rather than exposing raw coordinates. */}
              {value ? value.address : t('No location selected')}
            </span>
            {!isWithinArea && (
              <span className="text-sm text-functional-red">
                {t('This address is outside the allowed proposal area.')}
              </span>
            )}
            {value && (
              <CouncilDistrictBadge
                boundaryName={boundaryName}
                resolvedFromMap
              />
            )}
          </div>
          <Button
            variant="icon"
            color="secondary"
            size="small"
            onPress={handleUseMyLocation}
            className="shrink-0"
          >
            <LuLocate aria-hidden className="size-4" />
            {t('Use my location')}
          </Button>
        </div>
      </div>
    </div>
  );
}
