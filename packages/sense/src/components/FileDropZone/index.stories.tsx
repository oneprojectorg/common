import { FileDropZone } from '@op/sense/FileDropZone';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof FileDropZone> = {
  title: 'Composites/FileDropZone',
  component: FileDropZone,
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
