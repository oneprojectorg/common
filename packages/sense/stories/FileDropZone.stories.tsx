import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FileDropZone } from '@/components/FileDropZone';

const meta: Meta<typeof FileDropZone> = {
  title: 'shadcn/FileDropZone',
  component: FileDropZone,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FileDropZone>;

export const Default: Story = {
  render: () => {
    const [files, setFiles] = useState<File[]>([]);
    return (
      <div className="flex flex-col gap-4">
        <FileDropZone
          onSelectFiles={setFiles}
          description="Any file, any size"
        />
        {files.length > 0 && (
          <ul className="text-sm text-muted-foreground">
            {files.map((f) => (
              <li key={f.name}>{f.name}</li>
            ))}
          </ul>
        )}
      </div>
    );
  },
};

export const ImageOnly: Story = {
  render: () => (
    <FileDropZone
      acceptedFileTypes={['image/*']}
      onSelectFiles={() => {}}
      label="Drop an image"
      description="PNG, JPG, GIF up to 5MB"
    />
  ),
};

export const Single: Story = {
  render: () => (
    <FileDropZone
      onSelectFiles={() => {}}
      allowsMultiple={false}
      description="One file"
    />
  ),
};

export const Disabled: Story = {
  render: () => (
    <FileDropZone onSelectFiles={() => {}} isDisabled description="Locked" />
  ),
};
