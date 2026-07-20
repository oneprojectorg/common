import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuText } from 'react-icons/lu';

import { Pair, Section } from '../../src/comparison/Comparison';
import { CollapsibleConfigCard as OldCollapsibleConfigCard } from '../../src/components/CollapsibleConfigCard';

// Port swaps the unstyled-AccordionItem hack for the Collapsible primitive;
// same header anatomy (leading element, label pill, badge, chevron).

const meta: Meta = {
  title: 'Sense Comparison/Composites/CollapsibleConfigCard',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const CollapsibleConfigCardComparison: Story = {
  name: 'CollapsibleConfigCard',
  render: () => (
    <div className="p-8">
      <Section title="CollapsibleConfigCard">
        <Pair
          label="Collapsible"
          old={
            <div className="w-80">
              <OldCollapsibleConfigCard
                icon={LuText}
                label="Description"
                badgeLabel="Required"
                isCollapsible
                defaultExpanded
              >
                <p className="text-sm">Field configuration.</p>
              </OldCollapsibleConfigCard>
            </div>
          }
          raw={
            <div className="w-80">
              <CollapsibleConfigCard
                icon={LuText}
                label="Description"
                badgeLabel="Required"
                isCollapsible
                defaultExpanded
              >
                <p className="text-sm">Field configuration.</p>
              </CollapsibleConfigCard>
            </div>
          }
        />
        <Pair
          label="Locked"
          old={
            <div className="w-80">
              <OldCollapsibleConfigCard icon={LuText} label="Votes" locked />
            </div>
          }
          raw={
            <div className="w-80">
              <CollapsibleConfigCard icon={LuText} label="Votes" locked />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
