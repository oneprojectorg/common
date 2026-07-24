import { MediaDisplay } from '@op/sense/MediaDisplay';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { MediaDisplay as OldMediaDisplay } from '../../src/components/MediaDisplay';

const meta: Meta = {
  title: 'Sense Comparison/Composites/MediaDisplay',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const MediaDisplayComparison: Story = {
  name: 'MediaDisplay',
  render: () => (
    <div className="p-8">
      <Section title="MediaDisplay">
        <Pair
          label="PDF card"
          old={
            <div className="w-72">
              <OldMediaDisplay
                title="Proposal.pdf"
                mimeType="application/pdf"
                size={1_240_000}
                url="#"
              />
            </div>
          }
          raw={
            <div className="w-72">
              <MediaDisplay
                title="Proposal.pdf"
                mimeType="application/pdf"
                size={1_240_000}
                url="#"
              />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
