import { AvatarUploader } from '@op/sense/AvatarUploader';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof AvatarUploader> = {
  title: 'Sense/Composites/AvatarUploader',
  component: AvatarUploader,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AvatarUploader>;

export const Default: Story = {
  render: () => (
    <div className="w-32">
      <AvatarUploader label="Profile photo" onChange={() => {}} />
    </div>
  ),
};

export const Uploading: Story = {
  render: () => (
    <div className="w-32">
      <AvatarUploader label="Profile photo" uploading onChange={() => {}} />
    </div>
  ),
};
