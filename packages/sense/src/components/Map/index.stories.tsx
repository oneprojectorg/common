import { Button } from '@op/sense/Button';
import { Input } from '@op/sense/Input';
import { Layer, Map, MapMarker, Source } from '@op/sense/Map';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';

import { nycBoroughs } from './nycBoroughs';

// Ray-casting point-in-polygon over the borough rings — the story's stand-in
// for the app's server-side "is this inside a district?" check.
const insideDistricts = (lng: number, lat: number) =>
  nycBoroughs.features.some((feature) => {
    if (feature.geometry.type !== 'Polygon') {
      return false;
    }
    const ring = feature.geometry.coordinates[0] ?? [];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi = 0, yi = 0] = ring[i] ?? [];
      const [xj = 0, yj = 0] = ring[j] ?? [];
      if (
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    return inside;
  });

// OpenFreeMap's Liberty style — the same key-less tiles the app falls back to
// (mapConfig OPENFREEMAP_STYLE_URL). App code prefers a MapTiler style when a
// key is present; these stories always use the open fallback.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const meta: Meta<typeof Map> = {
  title: 'Composites/Map',
  component: Map,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Map>;

// Simplest read-only view: one static pin (e.g. a proposal's location view).
export const Default: Story = {
  render: () => (
    <div className="w-full overflow-hidden rounded-lg border">
      <Map
        styleUrl={STYLE_URL}
        center={{ lng: -122.27, lat: 37.8 }}
        zoom={11}
        ariaLabel="Proposal location"
      >
        <MapMarker longitude={-122.27} latitude={37.8} />
      </Map>
    </div>
  ),
};

const SPOTS = [
  { id: 'oakland', lng: -122.27, lat: 37.8, label: 'Oakland tool library' },
  { id: 'sf', lng: -122.42, lat: 37.77, label: 'SF community garden' },
  { id: 'berkeley', lng: -122.29, lat: 37.87, label: 'Berkeley mutual aid' },
];

// Mirrors ProposalsMapCanvas: many pins, camera fit to their bounds, pins
// that highlight + open a hovercard on hover and fire onClick on tap.
const ProposalsMapDemo = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const bounds = useMemo(() => {
    const lngs = SPOTS.map((s) => s.lng);
    const lats = SPOTS.map((s) => s.lat);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <Map
        styleUrl={STYLE_URL}
        center={{ lng: -122.32, lat: 37.82 }}
        zoom={9}
        bounds={bounds}
        ariaLabel="Proposal locations"
        onClick={() => setActiveId(null)}
      >
        {SPOTS.map((spot) => (
          <MapMarker
            key={spot.id}
            longitude={spot.lng}
            latitude={spot.lat}
            isActive={activeId === spot.id}
            onClick={() => setActiveId(spot.id)}
            onMouseEnter={() => setActiveId(spot.id)}
            onMouseLeave={() => setActiveId(null)}
            hoverContent={
              <div className="rounded-lg border bg-popover p-3 text-sm shadow-md">
                {spot.label}
              </div>
            }
          />
        ))}
      </Map>
    </div>
  );
};

export const ProposalsMap: Story = {
  render: () => <ProposalsMapDemo />,
};

// Recreates the decision location picker (MapCanvas + LocationSearchField):
// search an address (OpenStreetMap Nominatim), use current location, or
// click/drag the pin — and if the point lands outside the process's district
// boundaries it errors, same as the Columbus flow. NYC boroughs stand in for
// districts, styled like the app's boundary layers.
const OUT_OF_BOUNDS = 'That location is outside the district boundaries.';

const LocationPickerDemo = () => {
  const [center, setCenter] = useState({ lng: -73.97, lat: 40.7 });
  const [position, setPosition] = useState<{ lng: number; lat: number } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const place = (lng: number, lat: number) => {
    setPosition({ lng, lat });
    setCenter({ lng, lat });
    setError(insideDistricts(lng, lat) ? null : OUT_OF_BOUNDS);
  };

  const geocode = async () => {
    if (!query.trim()) {
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      );
      const [hit] = (await res.json()) as Array<{ lon: string; lat: string }>;
      if (hit) {
        place(Number(hit.lon), Number(hit.lat));
      } else {
        setError('No match for that address.');
      }
    } catch {
      setError('Address lookup failed.');
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => place(pos.coords.longitude, pos.coords.latitude),
      () => setError('Could not get your current location.'),
    );
  };

  return (
    <div className="flex w-[34rem] flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && geocode()}
          placeholder="Search an address"
        />
        <Button onClick={geocode} disabled={searching}>
          Search
        </Button>
        <Button variant="outline" onClick={useMyLocation}>
          Use my location
        </Button>
      </div>
      <div className="w-full overflow-hidden rounded-lg border">
        <Map
          styleUrl={STYLE_URL}
          center={center}
          zoom={9}
          ariaLabel="Pick a location"
          onClick={(lngLat) => place(lngLat.lng, lngLat.lat)}
        >
          <Source id="districts" type="geojson" data={nycBoroughs}>
            <Layer
              id="districts-fill"
              type="fill"
              paint={{ 'fill-color': '#eff7f9', 'fill-opacity': 0.32 }}
            />
            <Layer
              id="districts-outline"
              type="line"
              paint={{ 'line-color': '#387582', 'line-width': 1.5 }}
            />
          </Source>
          {position ? (
            <MapMarker
              longitude={position.lng}
              latitude={position.lat}
              draggable
              onDragEnd={(lngLat) => place(lngLat.lng, lngLat.lat)}
            />
          ) : null}
        </Map>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : position ? (
        <p className="font-mono text-xs text-muted-foreground">
          {position.lng.toFixed(4)}, {position.lat.toFixed(4)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Search, use your location, or click the map to drop a pin.
        </p>
      )}
    </div>
  );
};

export const LocationPicker: Story = {
  render: () => <LocationPickerDemo />,
};
