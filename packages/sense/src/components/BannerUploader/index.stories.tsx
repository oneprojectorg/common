import { BannerUploader } from '@op/sense/BannerUploader';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof BannerUploader> = {
  title: 'Composites/BannerUploader',
  component: BannerUploader,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof BannerUploader>;

export const Default: Story = {
  render: () => (
    <div className="w-[28rem]">
      <BannerUploader label="Banner" onChange={() => {}} />
    </div>
  ),
};

export const Uploading: Story = {
  render: () => (
    <div className="w-[28rem]">
      <BannerUploader label="Banner" uploading onChange={() => {}} />
    </div>
  ),
};
