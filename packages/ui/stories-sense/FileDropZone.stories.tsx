import { FileDropZone } from '@op/sense/FileDropZone';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof FileDropZone> = {
  title: 'Sense/Composites/FileDropZone',
  component: FileDropZone,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof FileDropZone>;

export const Default: Story = {
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

export const Disabled: Story = {
  render: () => (
    <div className="w-[28rem]">
      <FileDropZone disabled onSelectFiles={() => {}} />
    </div>
  ),
};
