'use client';

import { Header4 } from '@op/sense/Header';
import { useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { MapCanvas } from '../../../location/dynamicMap';
import {
  DEFAULT_LOCATION_FIELD_MAP_VIEW,
  useMapStyleUrl,
} from '../../../location/mapConfig';
import type { FieldConfigProps } from './fieldRegistry';

/**
 * Field config component for the location field's "Map view": an interactive,
 * marker-less map the admin pans/zooms to set the default camera a participant
 * sees before they add a location. The settled center/zoom is persisted on the
 * field schema as the `x-map-default` vendor extension.
 *
 * The initial camera is captured once on mount (saved value, or the whole-globe
 * Columbus view the first time) so the map stays uncontrolled afterward — this
 * avoids a `flyTo` feedback loop from feeding the live camera back as `center`.
 */
export function FieldConfigLocation({
  fieldSchema,
  onUpdateJsonSchema,
}: FieldConfigProps) {
  const t = useTranslations();
  const styleUrl = useMapStyleUrl();

  const initialView = useRef(
    fieldSchema['x-map-default'] ?? DEFAULT_LOCATION_FIELD_MAP_VIEW,
  );

  return (
    <div className="space-y-2">
      <Header4>{t('Map view')}</Header4>
      <p className="text-sm text-muted-foreground">
        {t(
          'Pan and zoom to set the starting map position participants see before they add a location.',
        )}
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <MapCanvas
          styleUrl={styleUrl}
          center={initialView.current.center}
          zoom={initialView.current.zoom}
          marker={null}
          onMoveEnd={(view) => onUpdateJsonSchema({ 'x-map-default': view })}
          ariaLabel={t('Default map position')}
        />
      </div>
    </div>
  );
}
