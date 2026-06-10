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
 * to an address + Google `placeId` via geocoding. Out-of-area placements show
 * an error (currently stubbed in-area, see {@link useProjectAreaCheck}).
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

  const { isWithinArea } = useProjectAreaCheck(
    value ? { lng: value.lng, lat: value.lat } : null,
  );

  const placeFromCoordinates = useCallback(
    async (lngLat: LngLat) => {
      try {
        const { geoname } = await utils.taxonomy.reverseGeocode.fetch({
          lat: lngLat.lat,
          lng: lngLat.lng,
        });
        onChange({
          lat: lngLat.lat,
          lng: lngLat.lng,
          address: geoname?.address,
          placeId: geoname?.placeId,
          placeLat: geoname?.lat,
          placeLng: geoname?.lng,
        });
      } catch {
        // Reverse geocoding failed — keep the coordinate, drop the address.
        onChange({ lat: lngLat.lat, lng: lngLat.lng });
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
    // TODO red borders on search field and map/caption container on invalid
    // className={isWithinArea ? undefined : 'border-functional-red'}
    <div className="flex flex-col gap-2">
      <LocationSearchField onSelect={handleSelect} />

      <div className="rounded-lg overflow-hidden border border-neutral-gray1">
        <MapCanvas
          styleUrl={MAP_STYLE_URL}
          center={center}
          marker={value ? { lng: value.lng, lat: value.lat } : null}
          draggable
          onMapClick={placeFromCoordinates}
          onMarkerDragEnd={placeFromCoordinates}
          ariaLabel={t('Project location map')}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-neutral-black" dir="auto">
              {value
                ? (value.address ??
                  `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`)
                : t('No location selected')}
            </span>
            {value && <CouncilDistrictBadge resolvedFromMap />}
            {!isWithinArea && (
              <FieldError>
                {t(
                  'That location is outside the project area. Choose a spot within the project boundary.',
                )}
              </FieldError>
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
