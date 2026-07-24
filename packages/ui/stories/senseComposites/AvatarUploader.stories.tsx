import { AvatarUploader } from '@op/sense/AvatarUploader';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { AvatarUploader as OldAvatarUploader } from '../../src/components/AvatarUploader';

const meta: Meta = {
  title: 'Sense Comparison/Composites/AvatarUploader',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const AvatarUploaderComparison: Story = {
  name: 'AvatarUploader',
  render: () => (
    <div className="p-8">
      <Section title="AvatarUploader">
        <Pair
          label="Empty"
          old={
            <div className="w-28">
              <OldAvatarUploader label="Profile photo" onChange={() => {}} />
            </div>
          }
          raw={
            <div className="w-28">
              <AvatarUploader label="Profile photo" onChange={() => {}} />
            </div>
          }
        />
      </Section>
    </div>
  ),
};
