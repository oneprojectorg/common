import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AvatarUploader } from '@/components/AvatarUploader';

const meta: Meta<typeof AvatarUploader> = {
  title: 'shadcn/AvatarUploader',
  component: AvatarUploader,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="size-32">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AvatarUploader>;

export const Empty: Story = {
  args: { label: 'Profile photo' },
};

export const WithImage: Story = {
  args: {
    label: 'Profile photo',
    value: 'https://placehold.co/200x200',
  },
};

export const Uploading: Story = {
  args: { label: 'Uploading…', uploading: true },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    return (
      <AvatarUploader
        label="Profile photo"
        value={value}
        uploading={uploading}
        onChange={(file) => {
          setUploading(true);
          const reader = new FileReader();
          reader.onload = () => {
            setValue(reader.result as string);
            setUploading(false);
          };
          reader.readAsDataURL(file);
        }}
      />
    );
  },
};
