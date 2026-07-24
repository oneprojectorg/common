import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { Sortable } from '@op/sense/Sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
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

// New cards are always sortable, so the new column wraps a one-item Sortable.
const NewCollapsibleDemo = () => {
  const [items, setItems] = useState([{ id: 'description' }]);

  return (
    <Sortable
      items={items}
      onChange={setItems}
      dragTrigger="handle"
      aria-label="Fields"
      className="w-80"
      getItemLabel={() => 'Description'}
    >
      {(_item, controls) => (
        <CollapsibleConfigCard
          label="Description"
          badgeLabel="Required"
          isCollapsible
          defaultExpanded
          controls={controls}
        >
          <p className="text-sm">Field configuration.</p>
        </CollapsibleConfigCard>
      )}
    </Sortable>
  );
};

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
          raw={<NewCollapsibleDemo />}
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
