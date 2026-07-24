import { StatusDot } from '@op/sense/StatusDot';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { StatusDot as OldStatusDot } from '../../src/components/StatusDot';

const meta: Meta = {
  title: 'Sense Comparison/Composites/StatusDot',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const StatusDotComparison: Story = {
  name: 'StatusDot',
  render: () => (
    <div className="p-8">
      <Section title="StatusDot">
        <Pair
          label="Success"
          old={<OldStatusDot intent="success">Approved</OldStatusDot>}
          raw={<StatusDot intent="success">Approved</StatusDot>}
        />
        <Pair
          label="Danger"
          old={<OldStatusDot intent="danger">Rejected</OldStatusDot>}
          raw={<StatusDot intent="danger">Rejected</StatusDot>}
        />
        <Pair
          label="Warning"
          old={<OldStatusDot intent="warning">Needs review</OldStatusDot>}
          raw={<StatusDot intent="warning">Needs review</StatusDot>}
        />
        <Pair
          label="Neutral"
          old={<OldStatusDot intent="neutral">Draft</OldStatusDot>}
          raw={<StatusDot intent="neutral">Draft</StatusDot>}
        />
      </Section>
    </div>
  ),
};
