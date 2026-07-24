import { BannerUploader } from '@op/sense/BannerUploader';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { BannerUploader as OldBannerUploader } from '../../src/components/BannerUploader';

const meta: Meta = {
  title: 'Sense Comparison/Composites/BannerUploader',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const BannerUploaderComparison: Story = {
  name: 'BannerUploader',
  render: () => (
    <div className="p-8">
      <Section title="BannerUploader">
        <Pair
          label="Empty"
          old={
            <div className="w-96">
              <OldBannerUploader label="Banner" onChange={() => {}} />
            </div>
          }
          raw={
            <div className="w-96">
              <BannerUploader label="Banner" onChange={() => {}} />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
