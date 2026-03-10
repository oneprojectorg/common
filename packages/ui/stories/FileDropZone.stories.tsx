import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileDropZone } from '../src/components/FileDropZone';

const meta: Meta<typeof FileDropZone> = {
  component: FileDropZone,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    description: 'Accepts PDF, DOCX, XLSX up to 10MB',
  },
  argTypes: {
    onSelectFiles: { action: 'onSelectFiles' },
  },
};

export default meta;
type Story = StoryObj<typeof FileDropZone>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[480px]">
      <FileDropZone {...args} />
    </div>
  ),
};

export const SingleFile: Story = {
  args: {
    allowsMultiple: false,
    description: 'Select a single file',
  },
  render: (args) => (
    <div className="w-[480px]">
      <FileDropZone {...args} />
    </div>
  ),
};

export const WithAcceptedFileTypes: Story = {
  args: {
    acceptedFileTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    description: 'Accepts PDF, DOCX, XLSX up to 10MB',
  },
  render: (args) => (
    <div className="w-[480px]">
      <FileDropZone {...args} />
    </div>
  ),
};
