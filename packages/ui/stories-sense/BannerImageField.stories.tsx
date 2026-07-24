import { BannerImageField } from '@op/sense/BannerImageField';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof BannerImageField> = {
  title: 'Sense/Composites/BannerImageField',
  component: BannerImageField,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof BannerImageField>;

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

export const Default: Story = {
  render: () => <BannerFieldDemo />,
};
