import { AvatarUploader } from '@op/sense/AvatarUploader';
import { BannerImageField } from '@op/sense/BannerImageField';
import { BannerUploader } from '@op/sense/BannerUploader';
import { FileDropZone } from '@op/sense/FileDropZone';
import { MediaDisplay } from '@op/sense/MediaDisplay';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

// The media & upload family shares one story file: each component is small
// and they're all exercised the same way (pick a file, watch state).

const meta: Meta<typeof FileDropZone> = {
  title: 'Sense/Composites/Media & upload',
  component: FileDropZone,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof FileDropZone>;

export const DropZone: Story = {
  render: () => (
    <div className="w-[28rem]">
      <FileDropZone
        acceptedFileTypes={['application/pdf', 'image/*']}
        description="PDF or images · max 25MB"
        onSelectFiles={() => {}}
      />
    </div>
  ),
};

export const DropZoneDisabled: Story = {
  render: () => (
    <div className="w-[28rem]">
      <FileDropZone disabled onSelectFiles={() => {}} />
    </div>
  ),
};

// Select a file to see the optimistic blob preview + uploading spinner.
const BannerFieldDemo = () => {
  const [value, setValue] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | undefined>(undefined);

  return (
    <div className="w-[28rem]">
      <BannerImageField
        value={value}
        fileName={fileName}
        copy={{
          label: 'Banner image',
          title: 'Upload banner image',
          description: 'PNG or JPG · max 25MB',
          chooseFile: 'Choose file',
          remove: 'Remove banner',
        }}
        onSelectFile={(file) => {
          setValue(URL.createObjectURL(file));
          setFileName(file.name);
        }}
        onRemove={() => {
          setValue(null);
          setFileName(undefined);
        }}
      />
    </div>
  );
};

export const BannerField: Story = {
  render: () => <BannerFieldDemo />,
};

export const Uploaders: Story = {
  render: () => (
    <div className="flex w-[28rem] flex-col gap-6">
      <div className="w-32">
        <AvatarUploader label="Profile photo" onChange={() => {}} />
      </div>
      <BannerUploader label="Banner" onChange={() => {}} />
      <div className="w-32">
        <AvatarUploader label="Uploading" uploading onChange={() => {}} />
      </div>
    </div>
  ),
};

export const MediaCard: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <MediaDisplay
        title="Community garden proposal"
        mimeType="application/pdf"
        size={1_240_000}
        url="#"
      >
        <div className="flex h-32 items-center justify-center bg-muted text-sm text-muted-foreground">
          PDF preview
        </div>
      </MediaDisplay>
      <MediaDisplay
        site="example.org"
        description="A shared collection of tools members can borrow instead of buying — drills, saws, ladders, and more."
        url="https://example.org/tool-library"
      />
    </div>
  ),
};
