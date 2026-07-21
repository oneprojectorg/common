import { AvatarUploader } from '@op/sense/AvatarUploader';
import { FileDropZone } from '@op/sense/FileDropZone';
import { MediaDisplay } from '@op/sense/MediaDisplay';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { AvatarUploader as OldAvatarUploader } from '../../src/components/AvatarUploader';
import { FileDropZone as OldFileDropZone } from '../../src/components/FileDropZone';
import { MediaDisplay as OldMediaDisplay } from '../../src/components/MediaDisplay';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Media & upload',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const MediaUploadComparison: Story = {
  name: 'Media & upload',
  render: () => (
    <div className="p-8">
      <Section title="FileDropZone">
        <Pair
          label="Drop zone"
          old={<OldFileDropZone onSelectFiles={() => {}} />}
          raw={<FileDropZone onSelectFiles={() => {}} />}
        />
      </Section>
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
