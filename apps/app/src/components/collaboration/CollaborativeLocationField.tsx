'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import type { LocationData } from '@op/common/client';
import { normalizeLocation } from '@op/common/client';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeLocationFieldProps {
  initialValue?: LocationData | null;
  onChange?: (location: LocationData | null) => void;
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
 * Collaborative location input synced via Yjs XmlFragment.
 * Stores `{ lat, lng }` as a JSON string in the shared doc, mirroring the
 * budget field's JSON-in-fragment pattern.
 *
 * Interim experience: plain Latitude/Longitude number inputs. A map picker
 * and address search will replace these in a follow-up.
 *
 * Partial entry (only one coordinate) lives in local state — the fragment
 * only ever stores a complete pair, so validation and persistence never see
 * half a location.
 */
export function CollaborativeLocationField({
  initialValue = null,
  onChange,
}: CollaborativeLocationFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const [locationText, setLocationText] = useCollaborativeFragment(
    ydoc,
    'location',
    initialValue
      ? JSON.stringify({ lat: initialValue.lat, lng: initialValue.lng })
      : '',
  );

  const initialLocation = parseLocationText(locationText);
  const [lat, setLat] = useState<number | null>(initialLocation?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initialLocation?.lng ?? null);

  // Sync remote fragment changes into the local inputs. Local writes update
  // the ref first so this only fires for changes made elsewhere.
  const lastSeenTextRef = useRef(locationText);
  useEffect(() => {
    if (locationText === lastSeenTextRef.current) {
      return;
    }
    lastSeenTextRef.current = locationText;
    const remote = parseLocationText(locationText);
    setLat(remote?.lat ?? null);
    setLng(remote?.lng ?? null);
  }, [locationText]);

  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const emitted = parseLocationText(locationText);
    const key = emitted ? `${emitted.lat}:${emitted.lng}` : null;

    if (lastEmittedRef.current === key) {
      return;
    }

    lastEmittedRef.current = key ?? undefined;
    onChangeRef.current?.(emitted);
  }, [locationText]);

  const handleCoordinateChange = (
    nextLat: number | null,
    nextLng: number | null,
  ) => {
    setLat(nextLat);
    setLng(nextLng);

    const nextText =
      nextLat !== null && nextLng !== null
        ? JSON.stringify({ lat: nextLat, lng: nextLng })
        : '';

    if (nextText !== lastSeenTextRef.current) {
      lastSeenTextRef.current = nextText;
      setLocationText(nextText);
    }
  };

  return (
    <div className="flex max-w-md flex-col gap-4 sm:flex-row">
      <NumberField
        label={t('Latitude')}
        value={lat}
        onChange={(value) => handleCoordinateChange(value, lng)}
        minValue={-90}
        maxValue={90}
        className="min-w-0 flex-1"
      />
      <NumberField
        label={t('Longitude')}
        value={lng}
        onChange={(value) => handleCoordinateChange(lat, value)}
        minValue={-180}
        maxValue={180}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
