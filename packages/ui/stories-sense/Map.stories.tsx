import { Map, MapMarker } from '@op/sense/Map';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

// Uses MapLibre's public demo style (no API key). App code passes a MapTiler
// style URL instead.
const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';

const meta: Meta<typeof Map> = {
  title: 'Sense/Composites/Map',
  component: Map,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Map>;

export const Default: Story = {
  render: () => (
    <div className="h-96 w-full overflow-hidden rounded-lg border">
      <Map
        styleUrl={DEMO_STYLE}
        center={{ lng: -122.27, lat: 37.8 }}
        zoom={4}
        ariaLabel="Example map"
      >
        <MapMarker longitude={-122.27} latitude={37.8} />
      </Map>
    </div>
  ),
};

// Hover the pins: active pin swaps to the coral gradient and raises; the
// hovercard portals out of the map and re-scopes with .sense.
const MarkersDemo = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const spots = [
    { id: 'oakland', lng: -122.27, lat: 37.8, label: 'Oakland tool library' },
    { id: 'sf', lng: -122.42, lat: 37.77, label: 'SF community garden' },
    { id: 'berkeley', lng: -122.29, lat: 37.87, label: 'Berkeley mutual aid' },
  ];

  return (
    <div className="h-96 w-full overflow-hidden rounded-lg border">
      <Map
        styleUrl={DEMO_STYLE}
        center={{ lng: -122.32, lat: 37.82 }}
        zoom={9}
        ariaLabel="Project locations"
      >
        {spots.map((spot) => (
          <MapMarker
            key={spot.id}
            longitude={spot.lng}
            latitude={spot.lat}
            isActive={activeId === spot.id}
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

export const WithMarkers: Story = {
  render: () => <MarkersDemo />,
};

const DraggableDemo = () => {
  const [position, setPosition] = useState({ lng: -122.27, lat: 37.8 });

  return (
    <div className="flex flex-col gap-2">
      <div className="h-96 w-full overflow-hidden rounded-lg border">
        <Map
          styleUrl={DEMO_STYLE}
          center={{ lng: -122.27, lat: 37.8 }}
          zoom={6}
          ariaLabel="Location picker"
        >
          <MapMarker
            longitude={position.lng}
            latitude={position.lat}
            draggable
            onDragEnd={setPosition}
          />
        </Map>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        {position.lng.toFixed(4)}, {position.lat.toFixed(4)}
      </p>
    </div>
  );
};

export const DraggablePin: Story = {
  render: () => <DraggableDemo />,
};
