'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import type { LocationData, MapDefaultView } from '@op/common/client';
import { normalizeLocation } from '@op/common/client';
import { useEffect, useRef, useState } from 'react';

import { LocationMapField } from '@/components/decisions/location/LocationMapField';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeLocationFieldProps {
  initialValue?: LocationData | null;
  /** Default map camera shown before a location is chosen (from the template). */
  defaultMapView?: MapDefaultView;
  onChange?: (location: LocationData | null) => void;
}

/**
 * Serializes the persisted fields of a `LocationData` for the shared fragment.
 * Empty string represents "no location".
 */
function serializeLocation(location: LocationData | null): string {
  if (!location) {
    return '';
  }
  return JSON.stringify({
    lat: location.lat,
    lng: location.lng,
    address: location.address,
    placeId: location.placeId,
    placeLat: location.placeLat,
    placeLng: location.placeLng,
  });
}

/**
 * Parses a location fragment's text into `LocationData`.
 * Returns null for empty, malformed JSON, or out-of-bounds values.
 */
function parseLocationText(text: string): LocationData | null {
  if (!text) {
    return null;
  }

  try {
    return normalizeLocation(JSON.parse(text)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Collaborative location input synced via Yjs XmlFragment. Stores the full
 * `{ lat, lng, address, placeId }` as a JSON string in the shared doc,
 * mirroring the budget field's JSON-in-fragment pattern.
 *
 * The Yjs wiring lives here; the map UI itself is {@link LocationMapField}.
 */
export function CollaborativeLocationField({
  initialValue = null,
  defaultMapView,
  onChange,
}: CollaborativeLocationFieldProps) {
  const { ydoc } = useCollaborativeDoc();

  const [locationText, setLocationText] = useCollaborativeFragment(
    ydoc,
    'location',
    serializeLocation(initialValue),
  );

  const [location, setLocation] = useState<LocationData | null>(() =>
    parseLocationText(locationText),
  );

  // Sync remote fragment changes into local state. Local writes update the ref
  // first so this only fires for changes made elsewhere.
  const lastSeenTextRef = useRef(locationText);
  useEffect(() => {
    if (locationText === lastSeenTextRef.current) {
      return;
    }
    lastSeenTextRef.current = locationText;
    setLocation(parseLocationText(locationText));
  }, [locationText]);

  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const emitted = parseLocationText(locationText);
    // Key on the full location, not just lat/lng: dropping a pin commits the
    // bare coordinate first, then the reverse-geocoded address at the *same*
    // lat/lng. A lat/lng-only key would treat the enriched value as a no-op and
    // never emit it, so the address would never reach the draft / autosave.
    const key = emitted
      ? JSON.stringify([
          emitted.lat,
          emitted.lng,
          emitted.address ?? null,
          emitted.placeId ?? null,
        ])
      : null;

    if (lastEmittedRef.current === key) {
      return;
    }

    lastEmittedRef.current = key ?? undefined;
    onChangeRef.current?.(emitted);
  }, [locationText]);

  const handleChange = (next: LocationData | null) => {
    setLocation(next);
    const nextText = serializeLocation(next);
    if (nextText !== lastSeenTextRef.current) {
      lastSeenTextRef.current = nextText;
      setLocationText(nextText);
    }
  };

  return (
    <LocationMapField
      value={location}
      defaultMapView={defaultMapView}
      onChange={handleChange}
    />
  );
}
