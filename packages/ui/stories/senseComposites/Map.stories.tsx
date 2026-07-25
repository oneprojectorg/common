import { Map, MapMarker } from '@op/sense/Map';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { Map as OldMap } from '../../src/components/Map';
import { MapMarker as OldMapMarker } from '../../src/components/MapMarker';

// Same key-less tiles the app falls back to (OpenFreeMap Liberty).
const DEMO_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Map',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const MapComparison: Story = {
  name: 'Map',
  render: () => (
    <div className="p-8">
      <Section title="Map">
        <Pair
          label="Map + pin"
          old={
            <div className="h-64 w-full overflow-hidden rounded-lg border">
              <OldMap
                styleUrl={DEMO_STYLE}
                center={{ lng: -122.27, lat: 37.8 }}
                zoom={5}
              >
                <OldMapMarker longitude={-122.27} latitude={37.8} />
              </OldMap>
            </div>
          }
          raw={
            <div className="h-64 w-full overflow-hidden rounded-lg border">
              <Map
                styleUrl={DEMO_STYLE}
                center={{ lng: -122.27, lat: 37.8 }}
                zoom={5}
              >
                <MapMarker longitude={-122.27} latitude={37.8} />
              </Map>
            </div>
          }
        />
      </Section>
    </div>
  ),
};
