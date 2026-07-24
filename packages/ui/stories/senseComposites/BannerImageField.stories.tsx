import { BannerImageField } from '@op/sense/BannerImageField';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { BannerImageField as OldBannerImageField } from '../../src/components/BannerImageField';

const meta: Meta = {
  title: 'Sense Comparison/Composites/BannerImageField',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const copy = {
  label: 'Banner image',
  title: 'Upload banner image',
  description: 'PNG or JPG · max 25MB',
  chooseFile: 'Choose file',
  remove: 'Remove banner',
};

export const BannerImageFieldComparison: Story = {
  name: 'BannerImageField',
  render: () => (
    <div className="p-8">
      <Section title="BannerImageField">
        <Pair
          label="Empty"
          old={
            <div className="w-96">
              <OldBannerImageField
                value={null}
                copy={copy}
                onSelectFile={() => {}}
                onRemove={() => {}}
              />
            </div>
          }
          raw={
            <div className="w-96">
              <BannerImageField
                value={null}
                copy={copy}
                onSelectFile={() => {}}
                onRemove={() => {}}
              />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
