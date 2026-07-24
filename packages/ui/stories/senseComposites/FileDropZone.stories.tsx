import { FileDropZone } from '@op/sense/FileDropZone';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { FileDropZone as OldFileDropZone } from '../../src/components/FileDropZone';

const meta: Meta = {
  title: 'Sense Comparison/Composites/FileDropZone',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const FileDropZoneComparison: Story = {
  name: 'FileDropZone',
  render: () => (
    <div className="p-8">
      <Section title="FileDropZone">
        <Pair
          label="Drop zone"
          old={
            <div className="w-96">
              <OldFileDropZone onSelectFiles={() => {}} />
            </div>
          }
          raw={
            <div className="w-96">
              <FileDropZone onSelectFiles={() => {}} />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
