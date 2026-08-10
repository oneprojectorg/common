'use client';

import { trpc } from '@op/api/client';
import type { LocationData, MapDefaultView } from '@op/common/client';
import { Button } from '@op/sense/Button';
import type { LngLat } from '@op/sense/Map';
import { useCallback, useEffect, useState } from 'react';
import { LuLocate } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LocationSearchField } from './LocationSearchField';
import { MapCanvas } from './dynamicMap';
import { DEFAULT_MAP_CENTER, useMapStyleUrl } from './mapConfig';
import { useProjectAreaCheck } from './useProjectAreaCheck';

interface LocationMapFieldProps {
  value: LocationData | null;
  /**
   * Decision profile (== `processInstances.profileId`) that owns the boundary
   * set. When `null` the boundary overlay and out-of-area check are skipped —
   * legacy instances without a decision profile fall through cleanly.
   */
  profileId: string | null;
  /**
   * Default map camera (from the template's location field) used to position
   * the map before the participant has chosen a location.
   */
  defaultMapView?: MapDefaultView;
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
export function LocationMapField({
  value,
  profileId,
  defaultMapView,
  onChange,
}: LocationMapFieldProps) {
  const t = useTranslations();
  const styleUrl = useMapStyleUrl();
  const [center, setCenter] = useState<LngLat>(
    value
      ? { lng: value.lng, lat: value.lat }
      : (defaultMapView?.center ?? DEFAULT_MAP_CENTER),
  );
  // Bumped on every direct map placement to clear the search box.
  const [searchResetToken, setSearchResetToken] = useState(0);
  // Coordinate awaiting reverse geocoding after a direct map placement.
  const [pendingGeocode, setPendingGeocode] = useState<LngLat | null>(null);

  const { isWithinArea } = useProjectAreaCheck(
    value ? { lng: value.lng, lat: value.lat } : null,
    profileId,
  );

  // Boundaries are admin-managed and effectively immutable across a participant
  // session, so cache the fetched set for the page lifetime — `staleTime` keeps
  // react-query from re-fetching on tab focus / interval, and `gcTime` keeps
  // the payload around across navigations between proposals. Skipped entirely
  // when no decision profile is available (legacy instances) — the picker then
  // renders without the overlay, matching the out-of-area check's behavior.
  const boundaryShapesQuery = trpc.decision.listBoundaryShapes.useQuery(
    { profileId: profileId ?? '' },
    { enabled: profileId != null, staleTime: Infinity, gcTime: Infinity },
  );
  const boundaries = boundaryShapesQuery.data?.boundaries;

  // Reverse-geocode a freshly-placed pin through react-query, which caches by
  // coordinate and surfaces failures as query state (so no try/catch is needed).
  const reverseGeocodeQuery = trpc.taxonomy.reverseGeocode.useQuery(
    { lat: pendingGeocode?.lat ?? 0, lng: pendingGeocode?.lng ?? 0 },
    { enabled: pendingGeocode != null, staleTime: 60_000 },
  );

  const placeFromCoordinates = useCallback(
    (lngLat: LngLat) => {
      // The user placed the pin directly — clear any stale search result.
      setSearchResetToken((token) => token + 1);

      // Commit the dropped coordinate immediately so the controlled marker
      // sticks at the new spot instead of snapping back to its prior position
      // while reverse geocoding is in flight; the query below then enriches it.
      onChange({ lat: lngLat.lat, lng: lngLat.lng });
      setPendingGeocode(lngLat);
    },
    [onChange],
  );

  // Once reverse geocoding settles, enrich the already-committed pin with the
  // resolved address/place. A failed or empty lookup leaves the bare coordinate
  // as-is. `data` always matches `pendingGeocode` (the query is keyed on it).
  useEffect(() => {
    if (pendingGeocode == null || !reverseGeocodeQuery.isSuccess) {
      return;
    }
    const { geoname } = reverseGeocodeQuery.data;
    onChange({
      lat: pendingGeocode.lat,
      lng: pendingGeocode.lng,
      address: geoname?.address,
      placeId: geoname?.placeId,
      placeLat: geoname?.lat,
      placeLng: geoname?.lng,
    });
    setPendingGeocode(null);
  }, [
    pendingGeocode,
    reverseGeocodeQuery.isSuccess,
    reverseGeocodeQuery.data,
    onChange,
  ]);

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
      placeFromCoordinates(lngLat);
    });
  }, [placeFromCoordinates]);

  return (
    <div className="flex flex-col gap-2">
      {/* Bias address search toward the map's current center so a participant
          opening a Columbus-OH proposal from Stockholm still sees Columbus
          places — without hard-restricting to that area. */}
      <LocationSearchField
        key={searchResetToken}
        onSelect={handleSelect}
        center={center}
      />

      <div
        className={`overflow-hidden rounded-lg border ${
          isWithinArea ? 'border-border' : 'border-destructive'
        }`}
      >
        <MapCanvas
          styleUrl={styleUrl}
          center={center}
          zoom={value ? undefined : defaultMapView?.zoom}
          marker={value ? { lng: value.lng, lat: value.lat } : null}
          draggable
          boundaries={boundaries}
          onMapClick={placeFromCoordinates}
          onMarkerDragEnd={placeFromCoordinates}
          ariaLabel={t('Project location map')}
        />

        <div className="flex flex-col justify-between gap-2.5 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={isWithinArea ? 'text-foreground' : 'text-destructive'}
              dir="auto"
            >
              {/* While reverse geocoding is in flight `address` is undefined —
                  render nothing rather than exposing raw coordinates. */}
              {value ? value.address : t('No location selected')}
            </span>
            {!isWithinArea && (
              <span className="text-sm text-destructive">
                {t('This address is outside the allowed proposal area.')}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseMyLocation}
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
