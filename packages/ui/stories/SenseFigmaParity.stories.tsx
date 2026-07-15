import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusBoard } from './senseParity/Parity';

// Scoreboard for the sense ↔ Figma restyle: every primitive's parity status,
// grouped by family. Family PRs add their own "<Family>" story next to this
// one (see senseParity/Parity.tsx for the building blocks) and flip their
// statuses in senseParity/parityStatus.ts.

const meta: Meta = {
  title: 'Sense Comparison/Figma Parity',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const Status: Story = { render: () => <StatusBoard /> };
