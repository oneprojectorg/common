import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { FacePile, GrowingFacePile } from '@op/sense/FacePile';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { Avatar as OldAvatar } from '../../src/components/Avatar';
import { FacePile as OldFacePile } from '../../src/components/FacePile';
import { GrowingFacePile as OldGrowingFacePile } from '../../src/components/GrowingFacePile';

const meta: Meta = {
  title: 'Sense Comparison/Composites/FacePile',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const names = ['Frida Kahlo', 'Mark Rothko', 'Sonia Delaunay', 'Lee Krasner'];

const newFaces = names.map((name) => (
  <Avatar key={name} className="ring-2 ring-background">
    <AvatarFallback>
      {name
        .split(' ')
        .map((part) => part[0])
        .join('')}
    </AvatarFallback>
  </Avatar>
));

const oldFaces = names.map((name) => (
  <OldAvatar key={name} placeholder={name} />
));

export const FacePileComparison: Story = {
  name: 'FacePile',
  render: () => (
    <div className="p-8">
      <Section title="FacePile">
        <Pair
          label="Stack"
          old={<OldFacePile items={oldFaces} />}
          raw={<FacePile items={newFaces} />}
        />
        <Pair
          label="Growing (+N)"
          old={
            <div className="w-48">
              <OldGrowingFacePile items={oldFaces} totalCount={32} />
            </div>
          }
          raw={
            <div className="w-48">
              <GrowingFacePile items={newFaces} totalCount={32} />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
