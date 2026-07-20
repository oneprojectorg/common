import {
  GradientHeader,
  Header1,
  Header2,
  Header3,
  Header4,
} from '@op/sense/Header';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import {
  GradientHeader as OldGradientHeader,
  Header1 as OldHeader1,
  Header2 as OldHeader2,
  Header3 as OldHeader3,
  Header4 as OldHeader4,
} from '../../src/components/Header';

// Old headings ride @op/ui's title tokens (title-lg 24px fixed); the port
// moves to the sense semantic scale, which is larger and responsive.

const meta: Meta = {
  title: 'Sense Comparison/Composites/Header',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const HeaderComparison: Story = {
  name: 'Header',
  render: () => (
    <div className="p-8">
      <Section title="Header">
        <Pair
          label="Header1"
          old={<OldHeader1>Community decisions</OldHeader1>}
          raw={<Header1>Community decisions</Header1>}
        />
        <Pair
          label="Header2"
          old={<OldHeader2>Open proposals</OldHeader2>}
          raw={<Header2>Open proposals</Header2>}
        />
        <Pair
          label="Header3"
          old={<OldHeader3>Voting closes Friday</OldHeader3>}
          raw={<Header3>Voting closes Friday</Header3>}
        />
        <Pair
          label="Header4"
          old={<OldHeader4>12 members participating</OldHeader4>}
          raw={<Header4>12 members participating</Header4>}
        />
        <Pair
          label="GradientHeader"
          old={<OldGradientHeader>Common Sense</OldGradientHeader>}
          raw={<GradientHeader>Common Sense</GradientHeader>}
        />
      </Section>
    </div>
  ),
};
