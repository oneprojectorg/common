import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { FacePile, GrowingFacePile } from '@op/sense/FacePile';
import { getGradientForString } from '@op/styles/constants';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FacePile> = {
  title: 'Composites/FacePile',
  component: FacePile,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof FacePile>;

const names = [
  'Frida Kahlo',
  'Mark Rothko',
  'Sonia Delaunay',
  'Lee Krasner',
  'Paul Klee',
  'Agnes Martin',
  'Yayoi Kusama',
  'Hilma af Klint',
];

const faces = (count: number) =>
  names.slice(0, count).map((name) => (
    <Avatar key={name} className="ring-2 ring-background">
      <AvatarFallback className={`${getGradientForString(name)} text-white`}>
        {name
          .split(' ')
          .map((part) => part[0])
          .join('')}
      </AvatarFallback>
    </Avatar>
  ));

export const Default: Story = {
  render: () => <FacePile items={faces(4)} />,
};

export const WithLabel: Story = {
  render: () => (
    <FacePile items={faces(3)}>
      <span className="text-sm text-muted-foreground">
        3 members participating
      </span>
    </FacePile>
  ),
};

// Resize the container (drag the Storybook panel) — the pile grows and
// shrinks, keeping a "+N" bubble for the overflow.
export const Growing: Story = {
  render: () => (
    <div className="w-56 resize-x overflow-hidden rounded border border-dashed p-4">
      <GrowingFacePile items={faces(8)} maxItems={8} />
    </div>
  ),
};

export const GrowingWithTotal: Story = {
  render: () => (
    <div className="w-64">
      <GrowingFacePile items={faces(4)} totalCount={48} />
    </div>
  ),
};
